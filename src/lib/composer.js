import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {position, cjk} from './labels.js';

/** @typedef {import('./injector.js').Injector} Injector */
/** @typedef {import('./language.js').Language} Language */

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

    /** @returns {boolean} */
    composes() {
        if (!Main.inputMethod.currentFocus)
            return false;
        if (!this._language.composing())
            return false;
        return this._shortcutFree();
    }

    /** @param {number} code */
    compose(code) {
        this._close();
        const keyval = position(code, this._shifted()).codePointAt(0);
        if (!keyval) {
            this._tap(code);
            return;
        }
        const injector = this._injector;
        Main.inputMethod.handleVirtualKey(keyval).then((/** @type {boolean} */ handled) => {
            if (!handled)
                injector.keysym(keyval);
        }).catch(() => injector.keysym(keyval));
        this._consume();
    }

    /** @returns {boolean} */
    stub() {
        const language = this._language;
        if (language.composing() || !cjk(language.currentId()))
            return false;
        return this._shortcutFree();
    }

    /** @param {number} code */
    stubKey(code) {
        const keyval = position(code, this._shifted()).codePointAt(0);
        if (!keyval) {
            this._tap(code);
            return;
        }
        this._injector.keysym(keyval);
    }
}
