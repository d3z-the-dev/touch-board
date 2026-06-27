import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Bridge} from './lib/bridge.js';

export default class TouchBoard extends Extension {
    /** @type {Bridge | null} */
    _bridge = null;

    enable() {
        this._bridge = new Bridge(this.getSettings());
        this._bridge.activate();
    }

    disable() {
        // `unlock-dialog` session mode lets the keyboard run on the lock screen,
        // so a touch-only user can type their password to unlock. disable() tears it down;
        // nothing keeps running while the session is locked.
        this._bridge?.deactivate();
        this._bridge = null;
    }
}
