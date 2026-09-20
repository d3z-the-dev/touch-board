import GLib from 'gi://GLib';

import {Key, Mode} from './settings.js';

const Hold = Object.freeze({DELAY: 360});

const Double = Object.freeze({DELAY: 320});

const State = Object.freeze({OFF: 0, SHOT: 1, LOCK: 2});

export class FnLayer {
    constructor({settings, track, tint, repaint}) {
        this._settings = settings;
        this._track = track;
        this._tint = tint;
        this._repaint = repaint;
        this._fn = State.OFF;
        this._key = null;
    }

    wire(button) {
        this._key = button;
        let pressedAt = 0;
        let lastTapAt = 0;

        const down = () => {
            pressedAt = GLib.get_monotonic_time();
        };

        const up = () => {
            const mode = this._settings.get_string(Key.MODE);
            const now = GLib.get_monotonic_time();
            const state = this._fn;
            if (mode === Mode.TOGGLE) {
                this._set(state === State.OFF ? State.LOCK : State.OFF);
            } else if (mode === Mode.LATCH) {
                if (state === State.LOCK)
                    this._set(State.OFF);
                else if (state === State.SHOT && (now - lastTapAt) / 1000 < Double.DELAY)
                    this._set(State.LOCK);
                else if (state === State.SHOT)
                    this._set(State.OFF);
                else
                    this._set(State.SHOT);
                lastTapAt = now;
            } else if (state !== State.OFF) {
                this._set(State.OFF);
            } else if ((now - pressedAt) / 1000 >= Hold.DELAY) {
                this._set(State.LOCK);
            } else {
                this._set(State.SHOT);
            }
        };

        return this._track(button, down, up);
    }

    active() {
        return this._fn !== State.OFF;
    }

    shot() {
        return this._fn === State.SHOT;
    }

    off() {
        if (this._fn !== State.OFF)
            this._set(State.OFF);
    }

    clear() {
        this._fn = State.OFF;
        this._key = null;
    }

    tint() {
        if (this.active() && this._key)
            this._tint(this._key, this._fn === State.LOCK);
    }

    _set(state) {
        this._fn = state;
        const key = this._key;
        if (key) {
            if (state === State.OFF)
                key.set_style(null);
            else
                this._tint(key, state === State.LOCK);
        }
        this._repaint();
    }
}
