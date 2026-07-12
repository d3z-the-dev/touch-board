import GLib from 'gi://GLib';

import {Key, Mode} from './settings.js';

/** @typedef {import('gi://St').default.Button} Button */
/** @typedef {import('gi://Gio').default.Settings} Settings */

const Style = Object.freeze({
    ACTIVE: 'touch-board-active',
    LOCKED: 'touch-board-locked',
});

const Hold = Object.freeze({DELAY: 360});

const Double = Object.freeze({DELAY: 320});

const State = Object.freeze({OFF: 0, SHOT: 1, LOCK: 2});

export class FnLayer {
    /**
     * @param {{
     *   settings: Settings,
     *   track: (button: Button, onDown: () => void, onUp: () => void) => (() => void),
     *   tint: (button: Button, locked: boolean) => void,
     *   repaint: () => void,
     * }} context
     */
    constructor({settings, track, tint, repaint}) {
        this._settings = settings;
        this._track = track;
        this._tint = tint;
        this._repaint = repaint;
        /** @type {number} */
        this._fn = State.OFF;
        /** @type {Button | null} */
        this._key = null;
    }

    /**
     * @param {Button} button
     * @returns {() => void} cancel: drop the in-flight press without arming.
     */
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

    /** @returns {boolean} */
    active() {
        return this._fn !== State.OFF;
    }

    /** @returns {boolean} */
    shot() {
        return this._fn === State.SHOT;
    }

    off() {
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

    /** @param {number} state */
    _set(state) {
        this._fn = state;
        const key = this._key;
        if (key) {
            if (state === State.OFF) {
                key.remove_style_class_name(Style.ACTIVE);
                key.remove_style_class_name(Style.LOCKED);
                key.set_style(null);
            } else {
                const lock = state === State.LOCK;
                key.add_style_class_name(Style.ACTIVE);
                if (lock)
                    key.add_style_class_name(Style.LOCKED);
                else
                    key.remove_style_class_name(Style.LOCKED);
                this._tint(key, lock);
            }
        }
        this._repaint();
    }
}
