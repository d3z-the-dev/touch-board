import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

export class Injector {
    constructor() {
        const seat = Clutter.get_default_backend().get_default_seat();
        /** @type {Clutter.VirtualInputDevice | null} */
        this.device = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    }

    // notify_key fired from a timer (a modifier lock) runs outside event dispatch
    // where Clutter's event time is stale; fall back to monotonic.
    time() {
        const event = Clutter.get_current_event_time();
        return event ? event * 1000 : GLib.get_monotonic_time();
    }

    /** @param {number} code */
    press(code) {
        this.device.notify_key(this.time(), code, Clutter.KeyState.PRESSED);
    }

    /** @param {number} code */
    release(code) {
        this.device.notify_key(this.time(), code, Clutter.KeyState.RELEASED);
    }

    /** @param {number} code */
    tap(code) {
        this.press(code);
        this.release(code);
    }

    /** @param {number} keyval */
    keysym(keyval) {
        // The composer's async commit can resolve after teardown disposed the device.
        if (!this.device)
            return;
        const moment = this.time();
        this.device.notify_keyval(moment, keyval, Clutter.KeyState.PRESSED);
        this.device.notify_keyval(moment, keyval, Clutter.KeyState.RELEASED);
    }

    destroy() {
        this.device = null;
    }
}
