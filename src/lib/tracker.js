import Clutter from 'gi://Clutter';

// Clutter gesture signals the tracker binds on every key button.
const Signal = Object.freeze({
    PRESS: 'button-press-event',
    RELEASE: 'button-release-event',
    TOUCH: 'touch-event',
});

// Mirrors stock OSK key handling: the first touch claims the slot,
// EVENT_STOP suppresses emulated pointer events so touch and mouse paths cannot both fire.
// EVENT_STOP also bypasses St.Button's click, so highlight is applied by hand.
// Caller owns the pseudo-class and click cue; this layer holds no keyboard state.
/**
 * @param {import('gi://St').default.Button} button
 * @param {{onDown: () => void, onUp: (x: number, y: number) => void, onMove?: (x: number, y: number) => void, click: () => void, active: string}} context
 * @returns {() => void} cancel: drop the press without firing onUp.
 */
export function track(button, {onDown, onUp, onMove, click, active}) {
    let slot = /** @type {number | null} */ (null);
    let pressed = false;
    let x = 0;
    let y = 0;
    const press = () => {
        if (pressed)
            return;
        pressed = true;
        button.add_style_pseudo_class(active);
        // Actuate before the click sound so audio rendering never delays the keystroke.
        onDown();
        click();
    };
    const release = () => {
        if (!pressed)
            return;
        pressed = false;
        button.remove_style_pseudo_class(active);
        onUp(x, y);
    };
    // Forget an in-flight press without committing it (no onUp):
    // used when a reset pulls the keyboard from under a held finger, whose TOUCH_END never arrives.
    const cancel = () => {
        if (pressed) {
            pressed = false;
            button.remove_style_pseudo_class(active);
        }
        slot = null;
    };
    button.connect(Signal.PRESS, (/** @type {Clutter.Actor} */ _actor, /** @type {Clutter.Event} */ event) => {
        [x, y] = event.get_coords();
        press();
        return Clutter.EVENT_STOP;
    });
    button.connect(Signal.RELEASE, (/** @type {Clutter.Actor} */ _actor, /** @type {Clutter.Event} */ event) => {
        [x, y] = event.get_coords();
        release();
        return Clutter.EVENT_STOP;
    });
    button.connect(Signal.TOUCH, (/** @type {Clutter.Actor} */ _actor, /** @type {Clutter.Event} */ event) => {
        const type = event.type();
        const sequence = event.get_event_sequence();
        const id = sequence ? sequence.get_slot() : -1;
        if (type === Clutter.EventType.TOUCH_BEGIN) {
            if (slot === null) {
                slot = id;
                [x, y] = event.get_coords();
                press();
            }
        } else if (type === Clutter.EventType.TOUCH_UPDATE) {
            if (slot === id) {
                [x, y] = event.get_coords();
                if (onMove)
                    onMove(x, y);
            }
        } else if (type === Clutter.EventType.TOUCH_END || type === Clutter.EventType.TOUCH_CANCEL) {
            if (slot === null || slot === id) {
                [x, y] = event.get_coords();
                release();
            }
            if (slot === id)
                slot = null;
        }
        return Clutter.EVENT_STOP;
    });
    return cancel;
}
