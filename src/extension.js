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
        // The `unlock-dialog` session mode keeps the keyboard alive on the lock screen:
        // without it a touch-only device cannot type the password to unlock.
        this._bridge.deactivate();
        this._bridge = null;
    }
}
