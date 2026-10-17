import Clutter from 'gi://Clutter';

export function defaultSeat() {
    const backend = Clutter.get_default_backend
        ? Clutter.get_default_backend()
        : global.stage.context.get_backend();
    return backend.get_default_seat();
}
