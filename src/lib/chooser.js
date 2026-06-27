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
    // Backstop (ms): the injected BACKSPACE may be swallowed by a grab (e.g. no stage capture)
    // and never re-surface; this ensures the accent is committed regardless.
    GUARD_MS: 60,
});

// The accent-variant popup floated above a held letter key.
// The keyboard owns one chooser, driven by a key's gesture stream:
// open on long press, focus the variant under the finger, select on release;
// a stage capture dismisses it on any press outside.
// The base glyph is committed by the keyboard on press.
// A pick only replaces it (delete the base, insert the variant);
// a release off the row leaves it.
// Depends one way on its injected context (injector, the key tracker,
// the press pseudo-class); it holds no back-reference to the keyboard.
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
    }

    // Float a row of accent buttons above the held key (uiGroup, drawn over the board).
    // Two gestures pick a variant:
    // hold-slide-release from the base key's own stream (see keyboard _wireKey move/up),
    // or lift-then-tap. A stage capture dismisses on an outside press.
    /**
     * @param {St.Button} button
     * @param {Accent[]} accents
     */
    open(button, accents) {
        this.close();
        const popup = new St.BoxLayout({style_class: Style.POPUP, reactive: true});
        const choices = /** @type {Choice[]} */ ([]);
        for (const accent of accents) {
            const choice = new St.Button({style_class: Style.POPUP_KEY, label: accent.label, can_focus: false});
            this._track(choice, () => {}, () => this._select(accent));
            choices.push({button: choice, accent});
            popup.add_child(choice);
        }
        Main.layoutManager.uiGroup.add_child(popup);
        this._popup = popup;
        this._choices = choices;
        // The base key stays held while the popup is up.
        // Drop its highlight so only the focused variant lights.
        button.remove_style_pseudo_class(this._active);

        const [x, y] = button.get_transformed_position();
        const place = () => {
            const left = Math.round((x ?? 0) + button.width / 2 - popup.width / 2);
            popup.set_position(Math.max(0, left), Math.round((y ?? 0) - popup.height));
        };
        place();
        const placedId = popup.connect(Signal.HEIGHT, place);
        popup.connect(Signal.DESTROY, () => popup.disconnect(placedId));

        // A fresh press outside the popup dismisses it; slide and tap commit elsewhere.
        // Always propagate so the underlying key still receives the event.
        this._captureId = global.stage.connect(Signal.CAPTURED, (/** @type {Clutter.Actor} */ _stage, /** @type {Clutter.Event} */ event) => {
            const type = event.type();
            if (type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.TOUCH_BEGIN) {
                const [ex, ey] = event.get_coords();
                if (!this._withinPopup(ex, ey))
                    this.close();
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    // The variant under a stage coordinate, or null off the row; read live.
    /**
     * @param {number} x
     * @param {number} y
     * @returns {Choice | null}
     */
    _choiceAt(x, y) {
        for (const entry of this._choices) {
            const [cx, cy] = entry.button.get_transformed_position();
            if (x >= cx && x <= cx + entry.button.width && y >= cy && y <= cy + entry.button.height)
                return entry;
        }
        return null;
    }

    // Light the variant under the point, clearing the rest.
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

    // Commit the variant under the point, if any; off the row leaves the popup open.
    /**
     * @param {number} x
     * @param {number} y
     */
    selectAt(x, y) {
        const target = this._choiceAt(x, y);
        if (target)
            this._select(target.accent);
    }

    // The base was typed on press; swap it for the chosen variant and close the popup.
    /** @param {Accent} accent */
    _select(accent) {
        this._replace(accent);
        this.close();
    }

    // Inject an evdev BACKSPACE to delete the base glyph,
    // then commit the accent through the IM. The channels are unordered:
    // a plain idle defer is not a real barrier;
    // the IM commit can arrive first and insert the accent before the backspace fires,
    // leaving the base behind (the intermittent "base stays" on tap).
    // Instead, watch for the BACKSPACE returning through the stage capture;
    // Mutter has already queued it to the client by then,
    // so the commit arrives strictly after.
    // A timeout backstops a BACKSPACE that never surfaces.
    // (delete_surrounding crashes the compositor without an active IBus surrounding-text handshake.)
    /** @param {Accent} accent */
    _replace(accent) {
        const stage = global.stage;
        let observerId = 0;
        let guardId = 0;
        const commit = () => {
            if (!observerId && !guardId)
                return;
            if (observerId) {
                stage.disconnect(observerId);
                observerId = 0;
            }
            if (guardId) {
                GLib.source_remove(guardId);
                guardId = 0;
            }
            this._commit(accent);
        };
        observerId = stage.connect(Signal.CAPTURED, (/** @type {Clutter.Actor} */ _stage, /** @type {Clutter.Event} */ event) => {
            if (event.type() === Clutter.EventType.KEY_RELEASE && event.get_key_symbol() === Clutter.KEY_BackSpace)
                commit();
            return Clutter.EVENT_PROPAGATE;
        });
        guardId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Replace.GUARD_MS, () => {
            guardId = 0;
            commit();
            return GLib.SOURCE_REMOVE;
        });
        this._injector.tap(Code.BACKSPACE);
    }

    // Insert the accent: prefer the input method (commits the string regardless of layout,
    // as the stock OSK does), else a layout-neutral keysym for a client with no IM focus.
    /** @param {Accent} accent */
    _commit(accent) {
        const inputMethod = /** @type {any} */ (Main.inputMethod);
        if (inputMethod?.currentFocus)
            inputMethod.commit(accent.label);
        else
            this._injector.keysym(accent.keyval);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    _withinPopup(x, y) {
        const popup = this._popup;
        if (!popup)
            return false;
        const [px, py] = popup.get_transformed_position();
        return x >= px && x <= px + popup.width && y >= py && y <= py + popup.height;
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
}
