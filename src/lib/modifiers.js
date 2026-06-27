import GLib from 'gi://GLib';

import {Code} from './codes.js';
import {Key, Mode} from './settings.js';

/** @typedef {import('gi://St').default.Button} Button */
/** @typedef {import('gi://Gio').default.Settings} Settings */
/** @typedef {import('./injector.js').Injector} Injector */
/** @typedef {import('./geometry.js').KeySpec} KeySpec */
/** @typedef {{button: Button, lock: boolean}} ModifierState */

const Style = Object.freeze({
    ACTIVE: 'touch-board-active',
    LOCKED: 'touch-board-locked',
});

// Press-hold threshold (ms): a held modifier locks instead of arming a one-shot.
const Hold = Object.freeze({DELAY: 360});

// Double-tap window (ms): a second tap promotes a Latch one-shot to a lock.
const Double = Object.freeze({DELAY: 320});

// Owns the soft modifiers (Shift/Ctrl/Alt/Super) the keyboard wraps around a keystroke:
// the latched map, a modifier key's tap/latch/lock gesture,
// and the actuation spine that presses the latched set around an injected key then drops the one-shots.
// Depends one way on its injected context (settings, injector, the key tracker,
// and the keyboard's tint/close/paint/Fn callbacks); it holds no back-reference to the keyboard.
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

    // Judged at release, not touch-down: injecting on down disturbed press tracking,
    // mislatching the lock. See settings.Mode for per-mode semantics.
    /**
     * @param {KeySpec} spec
     * @param {Button} button
     * @returns {() => void} cancel: drop the in-flight press without arming.
     */
    wire(spec, button) {
        const code = spec.code;
        if (code === undefined)
            return () => {};
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

    // Engage a modifier so it holds across the keystrokes it wraps (see tap).
    // A lock holds until cleared and lights the locked shade; a one-shot lasts one keystroke.
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

    // Type a key under any armed modifiers: press them so the keystroke carries them,
    // tap the key, release them, then drop the one-shots and keep the locks.
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

    // After a keystroke (or an accent pick): drop the armed one-shots, keep locks.
    consume() {
        for (const [code, state] of this._latched) {
            if (!state.lock)
                this.disarm(code);
        }
        // A one-shot Fn applies to this keystroke only; clear and repaint the layer now,
        // leaving a Fn lock. clearFn repaints in place of the bare paint one-shots need.
        if (this._fnShot())
            this._clearFn();
        else
            this._paint();
    }

    // Faces preview the next keystroke, so they follow any armed Shift.
    // Reading membership (not the lock flag) gives a Latch one-shot the case preview, not just a lock.
    /** @returns {boolean} */
    shifted() {
        return this._latched.has(Code.LSHIFT) || this._latched.has(Code.RSHIFT);
    }

    /** @returns {boolean} */
    altgr() {
        return this._latched.has(Code.RALT);
    }

    // True when no shortcut modifier (Ctrl/Alt/Super) is latched; a lone Shift,
    // which folds into a forwarded keyval, is fine. The compose and stub paths need a bare key.
    /** @returns {boolean} */
    shortcutFree() {
        for (const modifier of this._latched.keys()) {
            if (modifier !== Code.LSHIFT && modifier !== Code.RSHIFT)
                return false;
        }
        return true;
    }

    // Drop all modifier state without touching faces: the rows are being rebuilt,
    // so the lit buttons are about to be destroyed.
    clear() {
        this._latched.clear();
    }

    // Clear every engaged modifier and its lit face (keyboard hide / teardown).
    clearAll() {
        for (const state of this._latched.values()) {
            state.button.remove_style_class_name(Style.ACTIVE);
            state.button.remove_style_class_name(Style.LOCKED);
            state.button.set_style(null);
        }
        this._latched.clear();
    }

    // Re-tint every engaged modifier when the colour setting changes.
    tintAll() {
        for (const state of this._latched.values())
            this._tint(state.button, state.lock);
    }
}
