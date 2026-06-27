import * as InputSourceManager from 'resource:///org/gnome/shell/ui/status/keyboard.js';

const Event = Object.freeze({CHANGED: 'current-source-changed'});
const Fallback = Object.freeze({LAYOUT: 'us'});

// Mirrors GNOME Shell's active input source. Subscribing to InputSourceManager
// rather than the input-sources gsetting gives a real-time switch signal and a
// reliable xkb id (the gsetting's `current` lags under Wayland).
export class Language {
    constructor() {
        /** @type {InputSourceManager.InputSourceManager | null} */
        this.manager = InputSourceManager.getInputSourceManager();
        this.handler = 0;
    }

    /** @returns {string} */
    currentId() {
        const source = this.manager?.currentSource;
        return source?.xkbId || Fallback.LAYOUT;
    }

    // True when the active source is an IBus engine. Keyed on source type, so it
    // holds for any engine: an engine reports its underlying xkb id (jp/us/kr), not
    // ja/zh/ko. Such a source composes through the engine (see Keyboard._compose).
    /** @returns {boolean} */
    composing() {
        return this.manager?.currentSource?.type === InputSourceManager.INPUT_SOURCE_TYPE_IBUS;
    }

    /** @param {() => void} callback */
    connect(callback) {
        this.handler = this.manager?.connect(Event.CHANGED, callback) ?? 0;
    }

    destroy() {
        if (this.handler) {
            this.manager?.disconnect(this.handler);
            this.handler = 0;
        }
        this.manager = null;
    }
}
