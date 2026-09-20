import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

export class Injector {
    constructor() {
        const seat = Clutter.get_default_backend().get_default_seat();
        this.device = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    }

    time() {
        const event = Clutter.get_current_event_time();
        return event ? event * 1000 : GLib.get_monotonic_time();
    }

    press(code) {
        this.device.notify_key(this.time(), code, Clutter.KeyState.PRESSED);
    }

    release(code) {
        this.device.notify_key(this.time(), code, Clutter.KeyState.RELEASED);
    }

    tap(code) {
        this.press(code);
        this.release(code);
    }

    keysym(keyval) {
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
