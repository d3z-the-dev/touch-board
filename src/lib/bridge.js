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
    DESTROY: 'destroy',
    VISIBLE: 'notify::visible',
    FOCUS: 'notify::key-focus',
    FOCUS_WINDOW: 'notify::focus-window',
    HEIGHT: 'notify::height',
    TOUCH: 'notify::touch-mode',
    Y: 'notify::y',
    DISMISS: 'dismiss',
    MOVED: 'position-changed',
    MONITORS: 'monitors-changed',
    UNMANAGED: 'unmanaged',
    CARET: 'cursor-location-changed',
    IBUS_CARET: 'set-cursor-location',
});

const Indicator = Object.freeze({ROLE: 'touch-board'});

const Lift = Object.freeze({DURATION: 150});

const Settle = Object.freeze({DELAY: 3000});

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
    _ready = false;
    _showing = false;
    _pinned = false;
    /** @type {{source: any, id: number}[]} */
    _connections = [];
    _movedId = 0;
    _readyId = 0;
    /** @type {Meta.Window | null} */
    _focusWindow = null;
    /** @type {Meta.Window | null} */
    _movedWindow = null;
    /** @type {number | null} */
    _focusWindowStartY = null;
    /** @type {Clutter.Actor | null} */
    _restoring = null;
    /** @type {{x: number, y: number, width: number, height: number} | null} */
    _caret = null;

    /** @param {import('gi://Gio').default.Settings} settings */
    constructor(settings) {
        this._settings = settings;
    }

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

        this._box = Main.layoutManager.keyboardBox;
        this._box.add_child(this._keyboard);
        this._keyboard.hide();
        this._keyboard.reactive = false;

        this._foreign = new Map();
        for (const child of this._box.get_children()) {
            if (child !== this._keyboard)
                this._suppress(child);
        }
        this._track(this._box, Signal.ADDED, (_box, actor) => {
            if (actor !== this._keyboard)
                this._suppress(actor);
        });

        this._track(this._box, Signal.VISIBLE, () => {
            if (!this._box.visible) {
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

        this._track(this._seat, Signal.TOUCH, () => this._onTouchMode());

        this._track(Main.layoutManager, Signal.MONITORS, () => this._onMonitorsChanged());

        this._track(this._keyboard, Signal.HEIGHT, () => {
            if (this._box.visible && !this._dismissed) {
                this._positionKeyboard();
                this._evaluate();
            }
        });

        this._track(global.display, Signal.FOCUS_WINDOW, () => this._onFocusWindow());

        this._track(Main.inputMethod, Signal.CARET, (_im, rect) => this._onCaret({
            x: rect.get_x(),
            y: rect.get_y(),
            width: rect.get_width(),
            height: rect.get_height(),
        }));

        // Caret source for X11/XWayland clients via IBus (a plain struct). Consumed only
        // when no Wayland input method holds focus, so the two sources never fight.
        this._track(getIBusManager(), Signal.IBUS_CARET, (_ibus, rect) => {
            if (!Main.inputMethod.currentFocus)
                this._onCaret(rect);
        });

        this._track(global.stage, Signal.FOCUS, () => this._onStageFocus());

        this._panel = new Panel();
        this._panel.bind(() => this._toggleKeyboard());
        Main.panel.addToStatusArea(Indicator.ROLE, this._panel);

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
        if (global.stage.get_key_focus() instanceof Clutter.Text)
            this._show(false);
    }

    _touch() {
        return this._seat.get_touch_mode();
    }

    _onTouchMode() {
        if (!this._seat.get_touch_mode() && this._keyboard.visible)
            this._hide();
    }

    _onMonitorsChanged() {
        this._keyboard.refit();
        if (this._box.visible && !this._dismissed) {
            this._positionKeyboard();
            this._evaluate();
        }
    }

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

    _lower() {
        this._dismissed = true;
        this._setFocusWindow(null);
        this._caret = null;
        this._keyboard.reset();
        this._keyboard.reactive = false;
        this._keyboard.translation_y = 0;
        this._keyboard.hide();
    }

    _lifted() {
        return this._keyboard.visible && !this._dismissed;
    }

    _onFocusWindow() {
        this._caret = null;
        this._evaluate();
    }

    /** @param {{x: number, y: number, width: number, height: number}} rect */
    _onCaret(rect) {
        this._caret = rect.height > 0 ? rect : null;
        this._evaluate();
    }

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

    /** @param {Meta.Window | null} window */
    _setFocusWindow(window) {
        if (this._focusWindow === window)
            return;
        if (this._focusWindow)
            this._animateWindow(this._focusWindow, false);
        this._disconnectMoved();
        const actor = window ? window.get_compositor_private() : null;
        if (actor && this._restoring === actor)
            actor.remove_transition('y');
        this._focusWindowStartY = actor ? actor.y : null;
        if (window && actor) {
            this._animateWindow(window, true);
            this._connectMoved(window);
        }
        this._focusWindow = window;
    }

    /**
     * @param {Meta.Window} window
     * @param {boolean} show
     */
    _animateWindow(window, show) {
        const actor = window.get_compositor_private();
        if (!actor)
            return;
        const finalY = show
            ? this._focusWindowStartY - this._keyboard.height
            : this._focusWindowStartY;
        let unmanaged = false;
        const unmanagedId = window.connect(Signal.UNMANAGED, () => {
            unmanaged = true;
        });
        const refreshId = actor.connect(Signal.Y, () => this._keyboard.queue_redraw());
        if (!show)
            this._restoring = actor;
        actor.ease({
            y: finalY,
            duration: Lift.DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: isFinished => {
                actor.disconnect(refreshId);
                window.disconnect(unmanagedId);
                if (this._restoring === actor)
                    this._restoring = null;
                if (unmanaged || (show && !isFinished))
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

    // Instant counterpart of the lift release: no animation may outlive disable().
    _restoreLift() {
        if (this._restoring)
            this._restoring.remove_transition('y');
        const window = this._focusWindow;
        this._focusWindow = null;
        this._disconnectMoved();
        if (!window || this._focusWindowStartY === null)
            return;
        const actor = window.get_compositor_private();
        if (actor) {
            actor.remove_transition('y');
            actor.y = this._focusWindowStartY;
            this._sync(window, this._focusWindowStartY);
        }
        this._focusWindowStartY = null;
    }

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
        const destroyId = actor.connect(Signal.DESTROY, () => {
            actor.disconnect(visibleId);
            this._foreign.delete(actor);
        });
        this._foreign.set(actor, {visibleId, destroyId});
    }

    deactivate() {
        this._panel.destroy();
        this._panel = null;
        if (this._readyId) {
            GLib.source_remove(this._readyId);
            this._readyId = 0;
        }
        for (const {source, id} of this._connections)
            source.disconnect(id);
        this._connections = [];
        this._restoreLift();
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
        this._keyboard = null;

        this._language.destroy();
        this._language = null;
        this._injector.destroy();
        this._injector = null;
        this._player.destroy();
        this._player = null;
    }
}
