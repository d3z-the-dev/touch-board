import * as InputSourceManager from 'resource:///org/gnome/shell/ui/status/keyboard.js';

const Event = Object.freeze({CHANGED: 'current-source-changed'});
const Fallback = Object.freeze({LAYOUT: 'us'});

export class Language {
    constructor() {
        this.manager = InputSourceManager.getInputSourceManager();
        this.handler = 0;
    }

    /** @returns {string} */
    currentId() {
        return this.manager.currentSource?.xkbId || Fallback.LAYOUT;
    }

    /** @returns {boolean} */
    composing() {
        return this.manager.currentSource?.type === InputSourceManager.INPUT_SOURCE_TYPE_IBUS;
    }

    /** @param {() => void} callback */
    connect(callback) {
        this.handler = this.manager.connect(Event.CHANGED, callback);
    }

    destroy() {
        this.manager.disconnect(this.handler);
        this.handler = 0;
    }
}
