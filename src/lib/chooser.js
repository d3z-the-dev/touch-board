import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Code} from './codes.js';

const Style = Object.freeze({
    POPUP: 'touch-board-popup',
    POPUP_KEY: 'touch-board-popup-key',
});

const Signal = Object.freeze({
    HEIGHT: 'notify::height',
    CAPTURED: 'captured-event',
});

const Replace = Object.freeze({
    GUARD_MS: 60,
});

export function within(actor, x, y) {
    const [left, top] = actor.get_transformed_position();
    return x >= left && x <= left + actor.width && y >= top && y <= top + actor.height;
}

export class Chooser {
    constructor({injector, track, pressed, look}) {
        this._injector = injector;
        this._track = track;
        this._pressed = pressed;
        this._look = look;
        this._popup = null;
        this._owner = null;
        this._choices = [];
        this._captureId = 0;
        this._observerId = 0;
        this._guardId = 0;
        this._queue = [];
    }

    open(button, accents) {
        this.close();
        this._owner = button;
        const popup = new St.BoxLayout({style_class: [Style.POPUP, ...this._look()].join(' '), reactive: true});
        Main.layoutManager.uiGroup.add_child(popup);
        this._popup = popup;
        for (const accent of accents) {
            const choice = new St.Button({style_class: Style.POPUP_KEY, label: accent.label, can_focus: false});
            this._track(choice, () => {}, () => this._select(accent));
            this._choices.push({button: choice, accent});
            popup.add_child(choice);
        }
        button.remove_style_pseudo_class(this._pressed);

        const [x, y] = button.get_transformed_position();
        const monitor = Main.layoutManager.findMonitorForActor(button);
        const place = () => {
            const left = Math.round(x + button.width / 2 - popup.width / 2);
            const right = monitor.x + monitor.width - popup.width;
            popup.set_position(Math.max(monitor.x, Math.min(left, right)), Math.round(y - popup.height));
        };
        place();
        popup.connect(Signal.HEIGHT, place);

        this._captureId = global.stage.connect(Signal.CAPTURED, (_stage, event) => {
            const type = event.type();
            if (type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.TOUCH_BEGIN) {
                const [ex, ey] = event.get_coords();
                if (!this._withinPopup(ex, ey))
                    this.close();
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _choiceAt(x, y) {
        return this._choices.find(entry => within(entry.button, x, y)) ?? null;
    }

    focus(button, x, y) {
        if (button !== this._owner)
            return;
        const target = this._choiceAt(x, y);
        for (const entry of this._choices) {
            if (entry === target)
                entry.button.add_style_pseudo_class(this._pressed);
            else
                entry.button.remove_style_pseudo_class(this._pressed);
        }
    }

    selectAt(button, x, y) {
        if (button !== this._owner)
            return;
        const target = this._choiceAt(x, y);
        if (target)
            this._select(target.accent);
    }

    _select(accent) {
        this._replace(accent);
        this.close();
    }

    after(inject) {
        if (this._guardId)
            this._queue.push(inject);
        else
            inject();
    }

    _replace(accent) {
        this._cancelReplace();
        const commit = () => {
            this._cancelReplace();
            this._commit(accent);
            const queue = this._queue;
            this._queue = [];
            for (const inject of queue)
                inject();
        };
        this._observerId = global.stage.connect(Signal.CAPTURED, (_stage, event) => {
            if (event.type() === Clutter.EventType.KEY_RELEASE && event.get_key_symbol() === Clutter.KEY_BackSpace)
                commit();
            return Clutter.EVENT_PROPAGATE;
        });
        this._guardId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Replace.GUARD_MS, () => {
            this._guardId = 0;
            commit();
            return GLib.SOURCE_REMOVE;
        });
        this._injector.tap(Code.BACKSPACE);
    }

    _cancelReplace() {
        if (this._observerId) {
            global.stage.disconnect(this._observerId);
            this._observerId = 0;
        }
        if (this._guardId) {
            GLib.source_remove(this._guardId);
            this._guardId = 0;
        }
    }

    _commit(accent) {
        if (Main.inputMethod.currentFocus)
            Main.inputMethod.commit(accent.label);
        else
            this._injector.keysym(accent.keyval);
    }

    owns(actor) {
        return this._popup !== null && this._popup.contains(actor);
    }

    _withinPopup(x, y) {
        return this._popup !== null && within(this._popup, x, y);
    }

    close() {
        if (this._captureId) {
            global.stage.disconnect(this._captureId);
            this._captureId = 0;
        }
        if (this._popup) {
            this._popup.destroy();
            this._popup = null;
        }
        this._owner = null;
        this._choices = [];
    }

    destroy() {
        this._cancelReplace();
        this._queue = [];
        this.close();
    }
}
