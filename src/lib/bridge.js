import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {KeyboardManager} from 'resource:///org/gnome/shell/ui/keyboard.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {getIBusManager} from 'resource:///org/gnome/shell/misc/ibusManager.js';
import {InputSourcePopup} from 'resource:///org/gnome/shell/ui/status/keyboard.js';

import {Keyboard} from './keyboard.js';
import {Injector} from './injector.js';
import {Player} from './player.js';
import {Language} from './language.js';
import {Panel} from './panel.js';

const Signal = Object.freeze({
    ADDED: 'child-added',
    FOCUS: 'notify::key-focus',
    FOCUS_WINDOW: 'notify::focus-window',
    HEIGHT: 'notify::height',
    Y: 'notify::y',
    DISMISS: 'dismiss',
    MOVED: 'position-changed',
    MONITORS: 'monitors-changed',
    UNMANAGED: 'unmanaged',
    PANEL: 'input-panel-state',
    DEVICE: 'last-device-changed',
    TEXT: 'surrounding-text-set',
    CARET: 'cursor-location-changed',
    IBUS_CARET: 'set-cursor-location',
    ACCELERATOR: 'accelerator-activated',
    SOURCE: 'current-source-changed',
});

const Stock = Object.freeze({
    SYNC: '_syncEnabled',
    TOUCHSCREEN: '_lastDeviceIsTouchscreen',
    EVENT: 'maybeHandleEvent',
});

const A11y = Object.freeze({SCHEMA: 'org.gnome.desktop.a11y.applications', KEYBOARD: 'screen-keyboard-enabled'});

const State = Object.freeze({HIDDEN: 0, AUTO: 1, PINNED: 2});

const Indicator = Object.freeze({ROLE: 'touch-board'});

const Lift = Object.freeze({DURATION: 150});

const Switch = Object.freeze({GRACE: 250});

const Property = Object.freeze({Y: 'y'});

const Direct = Object.freeze({CAPS: Clutter.InputCapabilities.TOUCH | Clutter.InputCapabilities.TABLET_TOOL});

function direct(device) {
    return (device.get_capabilities() & Direct.CAPS) !== 0;
}

export class Bridge {
    _settings;
    _panel = null;
    _injector = null;
    _player = null;
    _language = null;
    _keyboard;
    _box;
    _a11y = null;
    _injections = null;
    _state = State.HIDDEN;
    _direct = false;
    _armed = false;
    _accelerated = null;
    _switched = false;
    _switchId = 0;
    _sequences = new Map();
    _connections = [];
    _movedId = 0;
    _requestId = 0;
    _syncId = 0;
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
        this._injector = new Injector();
        this._player = new Player(this._settings);
        this._language = new Language();
        this._keyboard = new Keyboard(this._injector, this._language, this._settings, this._player);
        this._keyboard.connect(Signal.DISMISS, () => this._hide());

        this._box = Main.layoutManager.keyboardBox;
        this._box.track_hover = false;
        this._box.add_child(this._keyboard);
        this._keyboard.hide();

        this._a11y = new Gio.Settings({schema_id: A11y.SCHEMA});
        this._injections = new InjectionManager();
        this._injections.overrideMethod(KeyboardManager.prototype, Stock.SYNC, () => function () {
            if (!this._keyboard)
                return;
            this._keyboard.close(true);
            this._keyboard.setCursorLocation(null);
            this._keyboard.destroy();
            this._keyboard = null;
        });
        this._injections.overrideMethod(KeyboardManager.prototype, Stock.TOUCHSCREEN, () => () => false);
        this._injections.overrideMethod(KeyboardManager.prototype, Stock.EVENT, () => event => this._forward(event));
        Main.keyboard._syncEnabled();
        const last = Main.keyboard._lastDevice;
        this._direct = last !== null && direct(last);

        this._track(this._box, Signal.ADDED, (_box, actor) => {
            if (actor !== this._keyboard)
                this._resync();
        });

        this._track(Main.inputMethod, Signal.PANEL, (_im, state) => this._onPanel(state));
        this._track(global.backend, Signal.DEVICE, (_backend, device) => this._onDevice(device));
        this._track(global.display, Signal.ACCELERATOR, (_display, _action, device) => this._onAccelerator(device));
        this._track(Main.inputMethod, Signal.TEXT, () => this._onText());
        this._track(this._language.manager, Signal.SOURCE, () => this._onSource());

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

        this._track(Main.inputMethod, Signal.CARET, (_im, rect) => {
            this._onText();
            this._onCaret({
                x: rect.get_x(),
                y: rect.get_y(),
                width: rect.get_width(),
                height: rect.get_height(),
            });
        });

        this._track(getIBusManager(), Signal.IBUS_CARET, (_ibus, rect) => {
            if (Main.inputMethod.currentFocus)
                return;
            this._onText();
            this._onCaret(rect);
        });

        this._track(global.stage, Signal.FOCUS, () => this._evaluate());

        this._panel = new Panel(() => this._toggleKeyboard());
        Main.panel.addToStatusArea(Indicator.ROLE, this._panel);
    }

    _resync() {
        if (this._syncId)
            return;
        this._syncId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._syncId = 0;
            Main.keyboard._syncEnabled();
            if (this._lifted())
                this._box.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    _forward(event) {
        const actor = this._target(event);
        if (!this._lifted() || !actor || !(this._box.contains(actor) || this._keyboard.owns(actor)))
            return false;
        actor.event(event, true);
        actor.event(event, false);
        return true;
    }

    _target(event) {
        const actor = global.stage.get_event_actor(event);
        const sequence = event.get_event_sequence();
        if (!sequence)
            return actor;
        const slot = sequence.get_slot();
        const type = event.type();
        if (type === Clutter.EventType.TOUCH_BEGIN) {
            this._sequences.set(slot, actor);
            return actor;
        }
        const owner = this._sequences.get(slot) ?? actor;
        if (type === Clutter.EventType.TOUCH_END || type === Clutter.EventType.TOUCH_CANCEL)
            this._sequences.delete(slot);
        return owner;
    }

    _onPanel(state) {
        if (state === Clutter.InputPanelState.OFF) {
            if (this._state === State.AUTO && !this._switched && !this._switcher())
                this._hide();
        } else if (state === Clutter.InputPanelState.TOGGLE) {
            const event = Clutter.get_current_event();
            this._request(event !== null && direct(event.get_source_device()));
        } else if (!this._requestId) {
            this._requestId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._requestId = 0;
                this._request(this._direct);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _request(tapped) {
        if (tapped || this._a11y.get_boolean(A11y.KEYBOARD))
            this._show(State.AUTO);
    }

    _onDevice(device) {
        if (direct(device)) {
            this._direct = true;
            this._armed = false;
        } else if (device.get_capabilities() & Clutter.InputCapabilities.KEYBOARD) {
            this._armed = device.get_device_node() !== null && device !== this._accelerated;
        } else {
            this._direct = false;
        }
        this._accelerated = null;
    }

    _onAccelerator(device) {
        this._armed = false;
        this._accelerated = device;
    }

    _switcher() {
        return global.stage.get_grab_actor() instanceof InputSourcePopup;
    }

    _onSource() {
        this._armed = false;
        if (!this._lifted())
            return;
        this._switched = true;
        if (this._switchId)
            GLib.source_remove(this._switchId);
        this._switchId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Switch.GRACE, () => {
            this._switchId = 0;
            this._switched = false;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onText() {
        if (this._switcher())
            return;
        if (this._armed && this._lifted())
            this._hide();
    }

    _toggleKeyboard() {
        if (this._state === State.HIDDEN)
            this._show(State.PINNED);
        else
            this._hide();
    }

    _onMonitorsChanged() {
        this._keyboard.refit();
        if (this._lifted()) {
            this._positionKeyboard();
            this._evaluate();
        }
    }

    _show(state) {
        if (this._state !== State.PINNED)
            this._state = state;
        this._armed = false;
        Main.layoutManager.keyboardIndex = Main.layoutManager.focusIndex;
        this._box.show();
        if (this._fitIndex !== Main.layoutManager.keyboardIndex) {
            this._fitIndex = Main.layoutManager.keyboardIndex;
            this._keyboard.refit();
        }
        this._keyboard.show();
        this._positionKeyboard();
        this._evaluate();
    }

    _hide() {
        this._state = State.HIDDEN;
        this._setFocusWindow(null);
        this._caret = null;
        this._keyboard.reset();
        this._keyboard.translation_y = 0;
        this._keyboard.hide();
        this._box.hide();
    }

    _lifted() {
        return this._state !== State.HIDDEN;
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

    deactivate() {
        this._panel.destroy();
        this._panel = null;
        if (this._requestId)
            GLib.source_remove(this._requestId);
        if (this._syncId)
            GLib.source_remove(this._syncId);
        if (this._switchId)
            GLib.source_remove(this._switchId);
        this._requestId = 0;
        this._syncId = 0;
        this._switchId = 0;
        for (const {source, id} of this._connections)
            source.disconnect(id);
        this._connections = [];
        this._restoreLift();

        this._keyboard.release();
        this._box.remove_child(this._keyboard);
        this._keyboard.destroy();
        this._keyboard = null;
        this._injections.clear();
        this._injections = null;
        Main.keyboard._syncEnabled();
        this._box.visible = Boolean(Main.keyboard.visible);
        this._box.track_hover = true;
        this._a11y = null;
        this._accelerated = null;
        this._sequences.clear();

        this._language = null;
        this._injector.destroy();
        this._injector = null;
        this._player.destroy();
        this._player = null;
    }
}
