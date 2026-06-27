import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const Style = Object.freeze({ICON: 'system-status-icon'});
const Icon = Object.freeze({NAME: 'input-keyboard-symbolic'});
const Role = Object.freeze({NAME: 'touch-board'});

// Top-bar indicator that toggles the keyboard. Lives in the panel status area,
// reachable under any window's pointer grab; the press is consumed and forwarded to the toggle callback.
export const Panel = GObject.registerClass(
class Panel extends PanelMenu.Button {
    _init() {
        super._init(0.0, Role.NAME, true);
        // No key focus: grabbing it would pull focus off the text field,
        // and KeyboardController drops the shared box on that change.
        this.can_focus = false;
        this._toggle = /** @type {() => void} */ (() => {});
        this.add_child(new St.Icon({icon_name: Icon.NAME, style_class: Style.ICON}));
    }

    /** @param {() => void} toggle */
    bind(toggle) {
        this._toggle = toggle;
    }

    /** @param {Clutter.Event} event */
    vfunc_event(event) {
        const type = event.type();
        if (type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.TOUCH_BEGIN) {
            /** @type {() => void} */ (this._toggle)();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
});
