import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {position, cjk} from './labels.js';

/** @typedef {import('./injector.js').Injector} Injector */
/** @typedef {import('./language.js').Language} Language */
/** @typedef {import('./geometry.js').KeySpec} KeySpec */

// Actuates a glyph key under a CJK source, where the output is not the bare evdev code.
// Two paths: IBus-focused, the keystroke composes via handleVirtualKey;
// with no engine, a us-position keysym is used so the face matches output on any xkb.
// Either path stands down when a shortcut modifier (Ctrl/Alt/Super) is latched,
// leaving the keyboard's plain evdev tap. Depends one way on its injected context;
// it holds no back-reference to the keyboard.
export class Composer {
    /**
     * @param {{
     *   language: Language,
     *   injector: Injector,
     *   shifted: () => boolean,
     *   shortcutFree: () => boolean,
     *   tap: (code: number) => void,
     *   consume: () => void,
     *   close: () => void,
     * }} context
     */
    constructor({language, injector, shifted, shortcutFree, tap, consume, close}) {
        this._language = language;
        this._injector = injector;
        this._shifted = shifted;
        this._shortcutFree = shortcutFree;
        this._tap = tap;
        this._consume = consume;
        this._close = close;
    }

    // Whether this actuation composes through the input method instead of a key code:
    // true for an IBus engine with focus and no shortcut modifier latched (Ctrl/Alt/
    // Super take the evdev path; a lone Shift folds into the forwarded keyval).
    /** @returns {boolean} */
    composes() {
        const inputMethod = /** @type {any} */ (Main.inputMethod);
        if (!inputMethod?.currentFocus)
            return false;
        if (!this._language.composing())
            return false;
        return this._shortcutFree();
    }

    // Compose one keystroke through the input method via handleVirtualKey,
    // the path the stock OSK uses for IBus (an evdev code is not composed).
    // The keyval is the US one for the held level (Shift folds in).
    // If the engine rejects it, keysym falls back.
    /** @param {KeySpec} spec */
    compose(spec) {
        const code = spec.code;
        if (code === undefined)
            return;
        this._close();
        const symbol = position(code, this._shifted());
        const keyval = symbol ? symbol.codePointAt(0) ?? 0 : 0;
        if (!keyval) {
            this._tap(code);
            return;
        }
        const inputMethod = /** @type {any} */ (Main.inputMethod);
        const injector = this._injector;
        if (inputMethod?.handleVirtualKey) {
            inputMethod.handleVirtualKey(keyval)
                .then((/** @type {boolean} */ handled) => {
                    if (!handled)
                        injector.keysym(keyval);
                })
                .catch(() => injector.keysym(keyval));
        } else {
            injector.keysym(keyval);
        }
        this._consume();
    }

    // Whether to inject a bare us keysym instead of an evdev code:
    // a CJK layout with no engine stands in as plain us. A shortcut modifier stands it down, as composes().
    /** @returns {boolean} */
    stub() {
        const language = this._language;
        if (language.composing() || !cjk(language.currentId()))
            return false;
        return this._shortcutFree();
    }

    // Inject the us-position keysym for a bare CJK stub: layout-neutral,
    // so the face's us glyph matches output on any underlying xkb (jp JIS would mistranslate the symbol row).
    /** @param {KeySpec} spec */
    stubKey(spec) {
        const code = spec.code;
        if (code === undefined)
            return;
        const symbol = position(code, this._shifted());
        const keyval = symbol ? symbol.codePointAt(0) ?? 0 : 0;
        if (!keyval) {
            this._tap(code);
            return;
        }
        this._injector.keysym(keyval);
    }
}
