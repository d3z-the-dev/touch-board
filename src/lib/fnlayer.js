import GLib from 'gi://GLib';

import {Key, Mode} from './settings.js';

/** @typedef {import('gi://St').default.Button} Button */
/** @typedef {import('gi://Gio').default.Settings} Settings */

const Style = Object.freeze({
    ACTIVE: 'touch-board-active',
    LOCKED: 'touch-board-locked',
});

// Press-hold threshold (ms): a held Fn key locks the layer instead of arming a one-shot.
const Hold = Object.freeze({DELAY: 360});

// Double-tap window (ms): a second tap promotes a one-shot to a lock.
const Double = Object.freeze({DELAY: 320});

// Fn layer state: SHOT is a one-shot (cleared by the soft modifier's consume),
// LOCK holds across keys, OFF is the base. Unlike a soft modifier,
// the layer injects no code; it only reshapes the glyph faces and the row.
const State = Object.freeze({OFF: 0, SHOT: 1, LOCK: 2});

// Owns the local Fn layer: its OFF/SHOT/LOCK state,
// the Fn key's tap/latch/lock gesture (judged at release on the configured mode,
// like a soft modifier), and the repaint of everything the layer governs.
// Depends one way on its injected context (settings, the key tracker,
// and the keyboard's tint/repaint callbacks); it holds no back-reference to the keyboard.
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

    // The Fn layer key, judged at release on the configured mode like a soft modifier,
    // but engaging a local layer instead of injecting a code (see settings.Mode).
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

    // Whether the Fn layer is engaged (one-shot or locked).
    /** @returns {boolean} */
    active() {
        return this._fn !== State.OFF;
    }

    // Whether the layer is a one-shot. A soft modifier's consume clears the shot on the next keystroke,
    // leaving a lock standing.
    /** @returns {boolean} */
    shot() {
        return this._fn === State.SHOT;
    }

    // Drop the layer to OFF and repaint (the keyboard stays shown).
    // Used for the one-shot clear after a keystroke, and a reset on hide.
    off() {
        this._set(State.OFF);
    }

    // Drop layer state and the key reference without repainting:
    // the rows are being rebuilt or torn down, so the lit key is about to be destroyed.
    clear() {
        this._fn = State.OFF;
        this._key = null;
    }

    // Re-tint the engaged Fn key when the colour setting changes.
    tint() {
        if (this.active() && this._key)
            this._tint(this._key, this._fn === State.LOCK);
    }

    // Switch the layer and repaint everything it governs (its key tint,
    // then the faces and function row through the injected repaint).
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
