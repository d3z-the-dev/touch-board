import GLib from 'gi://GLib';

import {Code} from './codes.js';
import {Key, Mode} from './settings.js';

const Hold = Object.freeze({DELAY: 360});

const Double = Object.freeze({DELAY: 320});

export class Modifiers {
    constructor({settings, injector, track, tint, untint, close, after, paint, fnShot, clearFn}) {
        this._settings = settings;
        this._injector = injector;
        this._track = track;
        this._tint = tint;
        this._untint = untint;
        this._close = close;
        this._after = after;
        this._paint = paint;
        this._fnShot = fnShot;
        this._clearFn = clearFn;
        this._latched = new Map();
    }

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
                return;
            }
            this._paint();
        };

        return this._track(button, down, up);
    }

    arm(code, button, lock) {
        this._latched.set(code, {button, lock});
        this._tint(button, lock);
    }

    disarm(code) {
        const state = this._latched.get(code);
        if (!state)
            return;
        this._untint(state.button);
        this._latched.delete(code);
    }

    tap(code) {
        this._close();
        const injector = this._injector;
        const held = [...this._latched.keys()];
        this._after(() => {
            for (const modifier of held)
                injector.press(modifier);
            injector.tap(code);
            for (const modifier of held)
                injector.release(modifier);
        });
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

    shifted() {
        return this._latched.has(Code.LSHIFT) || this._latched.has(Code.RSHIFT);
    }

    altgr() {
        return this._latched.has(Code.RALT);
    }

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
        for (const state of this._latched.values())
            this._untint(state.button);
        this._latched.clear();
    }

    tintAll() {
        for (const state of this._latched.values())
            this._tint(state.button, state.lock);
    }
}
