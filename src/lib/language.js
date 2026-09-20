import * as InputSourceManager from 'resource:///org/gnome/shell/ui/status/keyboard.js';

const Event = Object.freeze({CHANGED: 'current-source-changed'});
const Fallback = Object.freeze({LAYOUT: 'us'});

export class Language {
    constructor() {
        this.manager = InputSourceManager.getInputSourceManager();
    }

    currentId() {
        return this.manager.currentSource?.xkbId || Fallback.LAYOUT;
    }

    composing() {
        return this.manager.currentSource?.type === InputSourceManager.INPUT_SOURCE_TYPE_IBUS;
    }

    connect(callback) {
        return this.manager.connect(Event.CHANGED, callback);
    }

    disconnect(id) {
        this.manager.disconnect(id);
    }
}
