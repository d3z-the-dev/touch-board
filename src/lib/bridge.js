import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getIBusManager} from 'resource:///org/gnome/shell/misc/ibusManager.js';

import {Keyboard} from './keyboard.js';
import {Injector} from './injector.js';
import {Player} from './player.js';
import {Language} from './language.js';
import {Panel} from './panel.js';

const Signal = Object.freeze({
    ADDED: 'child-added',
    DESTROYED: 'destroy',
    VISIBLE: 'notify::visible',
    FOCUS: 'notify::key-focus',
    FOCUS_WINDOW: 'notify::focus-window',
    HEIGHT: 'notify::height',
    TOUCH: 'notify::touch-mode',
    DISMISS: 'dismiss',
    MOVED: 'position-changed',
    MONITORS: 'monitors-changed',
    UNMANAGED: 'unmanaged',
    CARET: 'cursor-location-changed',
    IBUS_CARET: 'set-cursor-location',
});

const Indicator = Object.freeze({ROLE: 'touch-board'});

// Duration (ms) of the focused-window lift slide.
const Lift = Object.freeze({DURATION: 150});

// Delay (ms) before auto-shows are honoured. At login a field can grab focus,
// causing a premature pop; the panel button is explicit and ignores this delay.
const Settle = Object.freeze({DELAY: 3000});

// keyboardBox is anchored below screen (y = monitor.height);
// widgets inside offset by -ownHeight to show. Cooperative apps/prompts reveal it via text-input-v3,
// so we react on notify::visible rather than patch the manager. Others use the panel indicator.
export class Bridge {
    /** @type {import('gi://Gio').default.Settings} */
    _settings;
    /** @type {InstanceType<typeof Panel> | null} */
    _panel = null;
    /** @type {import('./injector.js').Injector | null} */
    _injector = null;
    /** @type {import('./player.js').Player | null} */
    _player = null;
    /** @type {import('./language.js').Language | null} */
    _language = null;
    /** @type {InstanceType<typeof import('./keyboard.js').Keyboard>} */
    _keyboard;
    /** @type {import('gi://St').default.Widget} */
    _box;
    /** @type {Map<Clutter.Actor, {visibleId: number, destroyId: number}>} */
    _foreign;
    /** @type {Clutter.Seat} */
    _seat;
    _dismissed = false;
    // False during the post-activation settle window (see Settle.DELAY),
    // so a field grabbing focus at login cannot pop the keyboard. The panel button bypasses it.
    _ready = false;
    // True only while our own _show() forces the shared box visible,
    // so the box's visibility handler does not re-gate (and re-hide) an explicit open.
    _showing = false;
    // True while the keyboard is up by explicit request (the panel button), not an auto-show.
    // GNOME drops the shared box on focus changes;
    // a pinned keyboard re-asserts it instead of being torn down.
    _pinned = false;
    /** @type {{source: any, id: number}[]} */
    _connections = [];
    _caretId = 0;
    _ibusId = 0;
    _movedId = 0;
    _readyId = 0;
    /** @type {Meta.Window | null} */
    _focusWindow = null;
    /** @type {Meta.Window | null} */
    _movedWindow = null;
    /** @type {number | null} */
    _focusWindowStartY = null;
    /** @type {{x: number, y: number, width: number, height: number} | null} */
    _caret = null;

    /** @param {import('gi://Gio').default.Settings} settings */
    constructor(settings) {
        this._settings = settings;
    }

    // Caret and IBus singletons need a guarded disconnect; they stay out of _connections.
    /**
     * @param {any} source
     * @param {string} signal
     * @param {(...args: any[]) => any} callback
     * @returns {number}
     */
    _track(source, signal, callback) {
        const id = source.connect(signal, callback);
        this._connections.push({source, id});
        return id;
    }

    activate() {
        this._seat = Clutter.get_default_backend().get_default_seat();
        this._injector = new Injector();
        this._player = new Player(this._settings);
        this._language = new Language();
        this._keyboard = new Keyboard(this._injector, this._language, this._settings, this._player);
        this._keyboard.connect(Signal.DISMISS, () => this._hide());

        this._dismissed = false;

        this._box = Main.layoutManager.keyboardBox;
        this._box.add_child(this._keyboard);
        this._keyboard.hide();
        this._keyboard.reactive = false;

        this._foreign = new Map();
        for (const child of this._box.get_children()) {
            if (child !== this._keyboard)
                this._suppress(child);
        }
        this._track(this._box, Signal.ADDED,(/** @type {Clutter.Actor} */ _box, /** @type {Clutter.Actor} */ actor) => {
            if (actor !== this._keyboard)
                this._suppress(actor);
        });

        // Box made visible by a standard trigger (cooperative app/prompt): slide in,
        // but only on a settled touch session (a tap, not a click or login-settle focus grab).
        // Our _show() raises `_showing`, so an explicit open is not re-gated.
        this._track(this._box, Signal.VISIBLE,() => {
            if (!this._box.visible) {
                // Box hidden by something other than our close (GNOME drops it on focus changes).
                // A pinned keyboard re-asserts it; an auto-show follows it down.
                if (this._pinned)
                    this._show(true);
                else if (this._lifted())
                    this._lower();
                return;
            }
            if (this._showing)
                return;
            if (this._dismissed || !this._ready || !this._touch()) {
                this._box.hide();
                return;
            }
            this._show(false);
        });

        // Mirror the stock OSK: when touch mode ends (a physical keystroke),
        // the keyboard hides, however it was opened.
        this._track(this._seat, Signal.TOUCH, () => this._onTouchMode());

        // An orientation or monitor change re-solves the geometry.
        // layoutManager emits this after its own primaryMonitor is updated,
        // so the refit reads the new dimensions. It runs whether the keyboard is shown or hidden,
        // so a rotation while closed leaves the next open already sized for the display.
        this._track(Main.layoutManager, Signal.MONITORS, () => this._onMonitorsChanged());

        // On first layout the keyboard has height 0 when notify::visible fires;
        // once allocated, reposition and re-evaluate the lift against the known height.
        this._track(this._keyboard, Signal.HEIGHT, () => {
            if (this._box.visible && !this._dismissed) {
                this._positionKeyboard();
                this._evaluate();
            }
        });

        // A fresh focus window has not reported a caret yet;
        // drop the stale one and re-evaluate. The frame fallback holds until an input method emits a rect.
        this._track(global.display, Signal.FOCUS_WINDOW, () => this._onFocusWindow());

        // Caret source for cooperative Wayland clients (input method, stage coords).
        // Guarded: a build without the signal stays on the frame fallback.
        try {
            this._caretId = Main.inputMethod?.connect?.(Signal.CARET,
                (/** @type {unknown} */ _im, /** @type {unknown} */ rect) => this._onCaret(rect)) ?? 0;
        } catch {
            this._caretId = 0;
        }

        // Caret source for X11/XWayland clients (terminals, legacy apps) via IBus.
        // Consume the IBus rect only when no Wayland input method holds focus,
        // so the two sources never fight over the same caret.
        try {
            this._ibusId = getIBusManager()?.connect?.(Signal.IBUS_CARET,
                (/** @type {unknown} */ _ibus, /** @type {{x: number, y: number, width: number, height: number}} */ rect) => {
                    if (/** @type {any} */ (Main.inputMethod)?.currentFocus)
                        return;
                    this._onCaret(rect);
                }) ?? 0;
        } catch {
            this._ibusId = 0;
        }

        // Shell-internal Clutter.Text fields (overview search, auth dialogs)
        // bypass text-input-v3; catch them via stage key-focus.
        this._track(global.stage, Signal.FOCUS, () => this._onStageFocus());

        // Panel toggle: reachable under any pointer grab.
        this._panel = new Panel();
        this._panel.bind(() => this._toggleKeyboard());
        Main.panel.addToStatusArea(Indicator.ROLE, this._panel);

        // Hold off automatic shows until the shell settles (see Settle).
        this._ready = false;
        this._readyId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Settle.DELAY, () => {
            this._ready = true;
            this._readyId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _toggleKeyboard() {
        if (this._keyboard.visible && !this._dismissed)
            this._hide();
        else
            this._show(true);
    }

    _onStageFocus() {
        if (!this._ready || !this._touch())
            return;
        let actor = global.stage.get_key_focus();
        while (actor) {
            if (actor instanceof Clutter.Text) {
                this._show(false);
                return;
            }
            actor = actor.get_parent();
        }
    }

    // True while the last input came from a touchscreen. Auto-show honours it;
    // a mouse click is skipped, and the panel button bypasses it.
    _touch() {
        return /** @type {Clutter.Seat} */ (this._seat).get_touch_mode();
    }

    _onTouchMode() {
        if (!/** @type {Clutter.Seat} */ (this._seat).get_touch_mode() && this._keyboard.visible)
            this._hide();
    }

    // Re-solve the keyboard geometry for the new monitor/orientation. When it is up,
    // re-anchor it against the refreshed height and re-evaluate the focused-window lift;
    // when it is down, the refit alone readies the next open.
    _onMonitorsChanged() {
        this._keyboard.refit();
        if (this._box.visible && !this._dismissed) {
            this._positionKeyboard();
            this._evaluate();
        }
    }

    // `_showing` is raised across box.show() so the visibility handler does not re-gate the open;
    // `_pinned` records an explicit open (see the field docs).
    /** @param {boolean} pinned */
    _show(pinned) {
        this._pinned = pinned;
        this._dismissed = false;
        this._showing = true;
        this._box.show();
        this._showing = false;
        this._keyboard.show();
        this._keyboard.reactive = true;
        this._positionKeyboard();
        this._evaluate();
    }

    _hide() {
        this._pinned = false;
        this._lower();
        this._box.hide();
    }

    // Drop the keyboard and release the lifted window without touching the shared box.
    // Shared by the manual close and the external hide path.
    _lower() {
        this._dismissed = true;
        this._setFocusWindow(null);
        this._caret = null;
        this._keyboard.reset();
        this._keyboard.reactive = false;
        this._keyboard.translation_y = 0;
        this._keyboard.hide();
    }

    // True while the keyboard is up, so the focused window should carry its lift.
    _lifted() {
        return this._keyboard.visible && !this._dismissed;
    }

    _onFocusWindow() {
        this._caret = null;
        this._evaluate();
    }

    // A fresh caret from either source; store it (empty rects fall back to the frame)
    // and re-evaluate.
    /** @param {unknown} rect */
    _onCaret(rect) {
        this._caret = this._rectOf(rect);
        this._evaluate();
    }

    // Decide whether the focused window must be lifted clear of the keyboard.
    // Lift by the keyboard height when its input would be occluded, drop once it rises clear.
    // Input bottom is the caret bottom when known (Wayland/IBus), else the window frame bottom.
    // When already lifted, the reported position is shifted up by height, so add it back first.
    _evaluate() {
        const monitor = Main.layoutManager.primaryMonitor;
        const window = global.display.get_focus_window();
        if (!window || !monitor || !this._lifted()) {
            this._setFocusWindow(null);
            return;
        }
        const height = this._keyboard.height;
        if (height <= 0)
            return;
        const top = monitor.y + monitor.height - height;
        const caret = this._caret;
        const frame = window.get_frame_rect();
        const bottom = caret && caret.height > 0
            ? caret.y + caret.height
            : frame.y + frame.height;
        if (this._focusWindow === window) {
            if (bottom + height < top)
                this._setFocusWindow(null);
            return;
        }
        if (bottom >= top)
            this._setFocusWindow(window);
        else
            this._setFocusWindow(null);
    }

    // Real actor position, not a paint-time translation, so a relayout cannot snap it back.
    // Capture the new window's resting y before sliding.
    /** @param {Meta.Window | null} window */
    _setFocusWindow(window) {
        if (this._focusWindow === window)
            return;
        if (this._focusWindow)
            this._animateWindow(this._focusWindow, false);
        this._disconnectMoved();
        const actor = window ? /** @type {Clutter.Actor | null} */ (window.get_compositor_private()) : null;
        this._focusWindowStartY = actor ? actor.y : null;
        if (window && actor) {
            this._animateWindow(window, true);
            this._connectMoved(window);
        }
        this._focusWindow = window;
    }

    // Reads the baseline from _setFocusWindow; must run before that baseline is cleared.
    /**
     * @param {Meta.Window} window
     * @param {boolean} show
     */
    _animateWindow(window, show) {
        const actor = /** @type {Clutter.Actor | null} */ (window.get_compositor_private());
        if (!actor || this._focusWindowStartY === null)
            return;
        const finalY = show
            ? this._focusWindowStartY - this._keyboard.height
            : this._focusWindowStartY;
        let unmanaged = false;
        const unmanagedId = window.connect(Signal.UNMANAGED, () => {
            unmanaged = true;
        });
        // The tray's rounded top corners are transparent and reveal this window as it slides;
        // repaint the tray each frame so the corners track it.
        const refreshId = actor.connect('notify::y', () => this._keyboard.queue_redraw());
        // ease() is gnome-shell's actor animation helper, not in the Clutter type surface;
        // hence the cast.
        /** @type {any} */ (actor).ease({
            y: finalY,
            duration: Lift.DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                actor.disconnect(refreshId);
                window.disconnect(unmanagedId);
                if (unmanaged)
                    return;
                actor.y = finalY;
                this._sync(window, finalY);
            },
        });
    }

    // Disconnect across the call to avoid re-entering the move handler;
    // reconnect only if this is still the lifted window.
    /**
     * @param {Meta.Window} window
     * @param {number} finalY
     */
    _sync(window, finalY) {
        const frame = window.get_frame_rect();
        const buffer = window.get_buffer_rect();
        const y = finalY + (frame.y - buffer.y);
        this._disconnectMoved();
        window.move_frame(true, frame.x, y);
        if (this._focusWindow === window)
            this._connectMoved(window);
    }

    // The user moved or grabbed the lifted window:
    // drop the baseline so we neither re-lift it nor snap it back.
    _onMoved() {
        this._disconnectMoved();
        this._focusWindow = null;
        this._focusWindowStartY = null;
    }

    /** @param {Meta.Window} window */
    _connectMoved(window) {
        this._disconnectMoved();
        this._movedWindow = window;
        this._movedId = window.connect(Signal.MOVED, () => this._onMoved());
    }

    _disconnectMoved() {
        if (this._movedId && this._movedWindow)
            this._movedWindow.disconnect(this._movedId);
        this._movedId = 0;
        this._movedWindow = null;
    }

    // Normalise a caret rectangle (a boxed Mtk/Graphene rect with accessors,
    // an origin/size struct, or a plain struct). An empty rect is treated as no caret.
    /**
     * @param {unknown} rect
     * @returns {{x: number, y: number, width: number, height: number} | null}
     */
    _rectOf(rect) {
        if (!rect)
            return null;
        const box = /** @type {any} */ (rect);
        let out;
        if (typeof box.get_y === 'function')
            out = {x: box.get_x(), y: box.get_y(), width: box.get_width(), height: box.get_height()};
        else if (box.origin && box.size)
            out = {x: box.origin.x, y: box.origin.y, width: box.size.width, height: box.size.height};
        else
            out = {x: box.x, y: box.y, width: box.width, height: box.height};
        return out.height > 0 ? out : null;
    }

    // Offset the keyboard up by its own height so it sits at the bottom of the display.
    _positionKeyboard() {
        const h = this._keyboard.height;
        if (h > 0)
            this._keyboard.translation_y = -h;
    }

    // GNOME destroys and recreates the stock Keyboard on a11y/touch-mode changes;
    // drop the handlers then so a queued notify::visible never hits a disposed actor.
    /** @param {Clutter.Actor} actor */
    _suppress(actor) {
        actor.hide();
        const visibleId = actor.connect(Signal.VISIBLE, () => {
            if (actor.visible)
                actor.hide();
        });
        const destroyId = actor.connect(Signal.DESTROYED, () => {
            actor.disconnect(visibleId);
            this._foreign.delete(actor);
        });
        this._foreign.set(actor, {visibleId, destroyId});
    }

    deactivate() {
        if (this._panel) {
            this._panel.destroy();
            this._panel = null;
        }
        if (this._readyId) {
            GLib.source_remove(this._readyId);
            this._readyId = 0;
        }
        this._ready = false;
        for (const {source, id} of this._connections)
            source.disconnect(id);
        this._connections = [];
        if (this._caretId) {
            try {
                Main.inputMethod?.disconnect?.(this._caretId);
            } catch {
                // The input method singleton may already be gone on teardown.
            }
            this._caretId = 0;
        }
        if (this._ibusId) {
            try {
                getIBusManager()?.disconnect?.(this._ibusId);
            } catch {
                // The IBus manager singleton may already be gone on teardown.
            }
            this._ibusId = 0;
        }
        this._setFocusWindow(null);
        this._disconnectMoved();
        for (const [actor, ids] of this._foreign) {
            actor.disconnect(ids.visibleId);
            actor.disconnect(ids.destroyId);
            actor.show();
        }
        this._foreign.clear();

        this._keyboard.translation_y = 0;
        this._keyboard.release();
        this._box.remove_child(this._keyboard);
        this._keyboard.destroy();
        this._keyboard = /** @type {never} */ (null);

        this._language?.destroy();
        this._language = null;
        this._injector?.destroy();
        this._injector = null;
        this._player?.destroy();
        this._player = null;
    }
}
