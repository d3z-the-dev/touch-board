import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Code} from './codes.js';

/** @typedef {import('./injector.js').Injector} Injector */
/** @typedef {import('./accents.js').Accent} Accent */
/** @typedef {{button: St.Button, accent: Accent}} Choice */

const Style = Object.freeze({
    POPUP: 'touch-board-popup',
    POPUP_KEY: 'touch-board-popup-key',
});

const Signal = Object.freeze({
    HEIGHT: 'notify::height',
    CAPTURED: 'captured-event',
    DESTROY: 'destroy',
});

const Replace = Object.freeze({
    GUARD_MS: 60,
});

/**
 * @param {Clutter.Actor} actor
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function within(actor, x, y) {
    const [left, top] = actor.get_transformed_position();
    return x >= left && x <= left + actor.width && y >= top && y <= top + actor.height;
}

export class Chooser {
    /**
     * @param {{
     *   injector: Injector,
     *   track: (button: St.Button, onDown: () => void, onUp: (x: number, y: number) => void) => (() => void),
     *   active: string,
     * }} context
     */
    constructor({injector, track, active}) {
        this._injector = injector;
        this._track = track;
        this._active = active;
        /** @type {St.Widget | null} */
        this._popup = null;
        /** @type {Choice[]} */
        this._choices = [];
        this._captureId = 0;
        this._observerId = 0;
        this._guardId = 0;
    }

    /**
     * @param {St.Button} button
     * @param {Accent[]} accents
     */
    open(button, accents) {
        this.close();
        const popup = new St.BoxLayout({style_class: Style.POPUP, reactive: true});
        Main.layoutManager.uiGroup.add_child(popup);
        this._popup = popup;
        for (const accent of accents) {
            const choice = new St.Button({style_class: Style.POPUP_KEY, label: accent.label, can_focus: false});
            this._track(choice, () => {}, () => this._select(accent));
            this._choices.push({button: choice, accent});
            popup.add_child(choice);
        }
        button.remove_style_pseudo_class(this._active);

        const [x, y] = button.get_transformed_position();
        const place = () => {
            const left = Math.round(x + button.width / 2 - popup.width / 2);
            popup.set_position(Math.max(0, left), Math.round(y - popup.height));
        };
        place();
        const placedId = popup.connect(Signal.HEIGHT, place);
        popup.connect(Signal.DESTROY, () => popup.disconnect(placedId));

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

    /**
     * @param {number} x
     * @param {number} y
     * @returns {Choice | null}
     */
    _choiceAt(x, y) {
        return this._choices.find(entry => within(entry.button, x, y)) ?? null;
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    focus(x, y) {
        const target = this._choiceAt(x, y);
        for (const entry of this._choices) {
            if (entry === target)
                entry.button.add_style_pseudo_class(this._active);
            else
                entry.button.remove_style_pseudo_class(this._active);
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    selectAt(x, y) {
        const target = this._choiceAt(x, y);
        if (target)
            this._select(target.accent);
    }

    /** @param {Accent} accent */
    _select(accent) {
        this._replace(accent);
        this.close();
    }

    // Inject an evdev BACKSPACE to delete the base glyph, then commit the accent
    // through the IM. The channels are unordered: the IM commit can land before the
    // backspace and leave the base behind, so wait for the BACKSPACE returning through
    // the stage capture — Mutter has queued it to the client by then. A timeout
    // backstops a BACKSPACE that never surfaces.
    // (delete_surrounding crashes the compositor without an active IBus surrounding-text handshake.)
    /** @param {Accent} accent */
    _replace(accent) {
        this._cancelReplace();
        const commit = () => {
            this._cancelReplace();
            this._commit(accent);
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

    /** @param {Accent} accent */
    _commit(accent) {
        if (Main.inputMethod.currentFocus)
            Main.inputMethod.commit(accent.label);
        else
            this._injector.keysym(accent.keyval);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
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
        this._choices = [];
    }

    destroy() {
        this._cancelReplace();
        this.close();
    }
}
