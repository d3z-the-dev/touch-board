import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {position, cjk} from './labels.js';

export class Composer {
    constructor({language, injector, shifted, shortcutFree, tap, consume, close}) {
        this._language = language;
        this._injector = injector;
        this._shifted = shifted;
        this._shortcutFree = shortcutFree;
        this._tap = tap;
        this._consume = consume;
        this._close = close;
    }

    composes() {
        if (!Main.inputMethod.currentFocus)
            return false;
        if (!this._language.composing())
            return false;
        return this._shortcutFree();
    }

    compose(code) {
        this._close();
        const keyval = position(code, this._shifted()).codePointAt(0);
        if (!keyval) {
            this._tap(code);
            return;
        }
        const injector = this._injector;
        Main.inputMethod.handleVirtualKey(keyval).then((handled) => {
            if (!handled)
                injector.keysym(keyval);
        });
        this._consume();
    }

    stub() {
        const language = this._language;
        if (language.composing() || !cjk(language.currentId()))
            return false;
        return this._shortcutFree();
    }

    stubKey(code) {
        const keyval = position(code, this._shifted()).codePointAt(0);
        if (!keyval) {
            this._tap(code);
            return;
        }
        this._injector.keysym(keyval);
        this._consume();
    }
}
