import GLib from 'gi://GLib';

import {Code} from './codes.js';
import {Key, Mode} from './settings.js';

/** @typedef {import('gi://St').default.Button} Button */
/** @typedef {import('gi://Gio').default.Settings} Settings */
/** @typedef {import('./injector.js').Injector} Injector */
/** @typedef {{button: Button, lock: boolean}} ModifierState */

const Style = Object.freeze({
    ACTIVE: 'touch-board-active',
    LOCKED: 'touch-board-locked',
});

const Hold = Object.freeze({DELAY: 360});

const Double = Object.freeze({DELAY: 320});

export class Modifiers {
    /**
     * @param {{
     *   settings: Settings,
     *   injector: Injector,
     *   track: (button: Button, onDown: () => void, onUp: () => void) => (() => void),
     *   tint: (button: Button, locked: boolean) => void,
     *   close: () => void,
     *   paint: () => void,
     *   fnShot: () => boolean,
     *   clearFn: () => void,
     * }} context
     */
    constructor({settings, injector, track, tint, close, paint, fnShot, clearFn}) {
        this._settings = settings;
        this._injector = injector;
        this._track = track;
        this._tint = tint;
        this._close = close;
        this._paint = paint;
        this._fnShot = fnShot;
        this._clearFn = clearFn;
        /** @type {Map<number, ModifierState>} */
        this._latched = new Map();
    }

    /**
     * @param {number} code
     * @param {Button} button
     * @returns {() => void} cancel: drop the in-flight press without arming.
     */
    wire(code, button) {
        let pressedAt = 0;
        let lastTapAt = 0;

        const down = () => {
            pressedAt = GLib.get_monotonic_time();
        };

        const up = () => {
            const mode = this._settings.get_string(Key.MODE);
            const now = GLib.get_monotonic_time();
            const state = this._latched.get(code);
            if (mode === Mode.TOGGLE) {
                if (state)
                    this.disarm(code);
                else
                    this.arm(code, button, true);
            } else if (mode === Mode.LATCH) {
                if (state?.lock)
                    this.disarm(code);
                else if (state && (now - lastTapAt) / 1000 < Double.DELAY)
                    this.arm(code, button, true);
                else if (state)
                    this.disarm(code);
                else
                    this.arm(code, button, false);
                lastTapAt = now;
            } else if (state) {
                this.disarm(code);
            } else if ((now - pressedAt) / 1000 >= Hold.DELAY) {
                this.arm(code, button, true);
            } else {
                this.tap(code);
            }
            this._paint();
        };

        return this._track(button, down, up);
    }

    /**
     * @param {number} code
     * @param {Button} button
     * @param {boolean} lock
     */
    arm(code, button, lock) {
        this._latched.set(code, {button, lock});
        button.add_style_class_name(Style.ACTIVE);
        if (lock)
            button.add_style_class_name(Style.LOCKED);
        else
            button.remove_style_class_name(Style.LOCKED);
        this._tint(button, lock);
    }

    /** @param {number} code */
    disarm(code) {
        const state = this._latched.get(code);
        if (!state)
            return;
        state.button.remove_style_class_name(Style.ACTIVE);
        state.button.remove_style_class_name(Style.LOCKED);
        state.button.set_style(null);
        this._latched.delete(code);
    }

    /** @param {number} code */
    tap(code) {
        this._close();
        const injector = this._injector;
        for (const modifier of this._latched.keys())
            injector.press(modifier);
        injector.tap(code);
        for (const modifier of this._latched.keys())
            injector.release(modifier);
        this.consume();
    }

    consume() {
        for (const [code, state] of this._latched) {
            if (!state.lock)
                this.disarm(code);
        }
        if (this._fnShot())
            this._clearFn();
        else
            this._paint();
    }

    /** @returns {boolean} */
    shifted() {
        return this._latched.has(Code.LSHIFT) || this._latched.has(Code.RSHIFT);
    }

    /** @returns {boolean} */
    altgr() {
        return this._latched.has(Code.RALT);
    }

    /** @returns {boolean} */
    shortcutFree() {
        for (const modifier of this._latched.keys()) {
            if (modifier !== Code.LSHIFT && modifier !== Code.RSHIFT)
                return false;
        }
        return true;
    }

    clear() {
        this._latched.clear();
    }

    clearAll() {
        for (const state of this._latched.values()) {
            state.button.remove_style_class_name(Style.ACTIVE);
            state.button.remove_style_class_name(Style.LOCKED);
            state.button.set_style(null);
        }
        this._latched.clear();
    }

    tintAll() {
        for (const state of this._latched.values())
            this._tint(state.button, state.lock);
    }
}
