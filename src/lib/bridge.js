import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
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

const Property = Object.freeze({Y: 'y'});

const Settle = Object.freeze({DELAY: 3000});

export class Bridge {
    _settings;
    _panel = null;
    _injector = null;
    _player = null;
    _language = null;
    _keyboard;
    _box;
    _foreign;
    _seat;
    _dismissed = false;
    _ready = false;
    _showing = false;
    _pinned = false;
    _connections = [];
    _movedId = 0;
    _readyId = 0;
    _reshowId = 0;
    _fitIndex = -1;
    _focusWindow = null;
    _movedWindow = null;
    _focusWindowStartY = null;
    _easing = new Set();
    _caret = null;

    constructor(settings) {
        this._settings = settings;
    }

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
        this._box.track_hover = false;
        this._box.add_child(this._keyboard);
        this._keyboard.hide();

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
                    this._reshow();
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
            if (!this._lifted())
                return;
            this._positionKeyboard();
            if (this._focusWindow)
                this._animateWindow(this._focusWindow, true);
            this._evaluate();
        });

        this._track(global.display, Signal.FOCUS_WINDOW, () => this._onFocusWindow());

        this._track(Main.inputMethod, Signal.CARET, (_im, rect) => this._onCaret({
            x: rect.get_x(),
            y: rect.get_y(),
            width: rect.get_width(),
            height: rect.get_height(),
        }));

        this._track(getIBusManager(), Signal.IBUS_CARET, (_ibus, rect) => {
            if (!Main.inputMethod.currentFocus)
                this._onCaret(rect);
        });

        this._track(global.stage, Signal.FOCUS, () => this._onStageFocus());

        this._panel = new Panel(() => this._toggleKeyboard());
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
        if (this._ready && this._touch() && global.stage.get_key_focus() instanceof Clutter.Text)
            this._show(false);
        else
            this._evaluate();
    }

    _touch() {
        return this._seat.get_touch_mode();
    }

    _onTouchMode() {
        if (!this._touch() && this._keyboard.visible)
            this._hide();
    }

    _onMonitorsChanged() {
        this._keyboard.refit();
        if (this._lifted()) {
            this._positionKeyboard();
            this._evaluate();
        }
    }

    _reshow() {
        if (this._reshowId)
            return;
        this._reshowId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._reshowId = 0;
            this._show(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelReshow() {
        if (this._reshowId)
            GLib.source_remove(this._reshowId);
        this._reshowId = 0;
    }

    _show(pinned) {
        this._cancelReshow();
        this._pinned = pinned;
        this._dismissed = false;
        this._showing = true;
        this._box.show();
        this._showing = false;
        if (this._fitIndex !== Main.layoutManager.keyboardIndex) {
            this._fitIndex = Main.layoutManager.keyboardIndex;
            this._keyboard.refit();
        }
        this._keyboard.show();
        this._positionKeyboard();
        this._evaluate();
    }

    _hide() {
        this._pinned = false;
        this._cancelReshow();
        this._lower();
        this._box.hide();
    }

    _lower() {
        this._dismissed = true;
        this._setFocusWindow(null);
        this._caret = null;
        this._keyboard.reset();
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

    _onCaret(rect) {
        this._caret = rect.height > 0 ? rect : null;
        this._evaluate();
    }

    _evaluate() {
        const monitor = Main.layoutManager.keyboardMonitor;
        const window = global.display.get_focus_window();
        if (!window || !monitor || !this._lifted() || global.stage.key_focus ||
            window.get_monitor() !== Main.layoutManager.keyboardIndex) {
            this._setFocusWindow(null);
            return;
        }
        const height = this._keyboard.height;
        if (height <= 0)
            return;
        const top = monitor.y + monitor.height - height;
        const caret = this._caret;
        const frame = window.get_frame_rect();
        const bottom = caret ? caret.y + caret.height : frame.y + frame.height;
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

    _setFocusWindow(window) {
        const actor = window ? window.get_compositor_private() : null;
        const target = actor ? window : null;
        if (this._focusWindow === target)
            return;
        if (this._focusWindow)
            this._animateWindow(this._focusWindow, false);
        this._disconnectMoved();
        if (this._easing.has(actor))
            actor.remove_transition(Property.Y);
        this._focusWindowStartY = actor ? actor.y : null;
        if (target) {
            this._animateWindow(target, true);
            this._connectMoved(target);
        }
        this._focusWindow = target;
    }

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
        actor.ease({
            y: finalY,
            duration: Lift.DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: isFinished => {
                actor.disconnect(refreshId);
                window.disconnect(unmanagedId);
                this._easing.delete(actor);
                if (unmanaged || (show && !isFinished))
                    return;
                actor.y = finalY;
                this._sync(window, finalY);
            },
        });
        if (actor.get_transition(Property.Y))
            this._easing.add(actor);
    }

    _sync(window, finalY) {
        if (window.maximized_vertically || window.is_fullscreen())
            return;
        const frame = window.get_frame_rect();
        const buffer = window.get_buffer_rect();
        const y = finalY + (frame.y - buffer.y);
        const own = window === this._movedWindow;
        if (own)
            this._disconnectMoved();
        window.move_frame(true, frame.x, y);
        if (own && this._focusWindow === window)
            this._connectMoved(window);
    }

    _onMoved() {
        this._disconnectMoved();
        this._focusWindow = null;
        this._focusWindowStartY = null;
    }

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

    _restoreLift() {
        for (const actor of this._easing)
            actor.remove_transition(Property.Y);
        const window = this._focusWindow;
        this._focusWindow = null;
        this._disconnectMoved();
        if (!window)
            return;
        const actor = window.get_compositor_private();
        if (actor) {
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
        this._cancelReshow();
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

        this._keyboard.release();
        this._box.remove_child(this._keyboard);
        this._keyboard.destroy();
        this._keyboard = null;
        this._box.visible = Boolean(Main.keyboard.visible);
        this._box.track_hover = true;

        this._language = null;
        this._injector.destroy();
        this._injector = null;
        this._player.destroy();
        this._player = null;
    }
}
