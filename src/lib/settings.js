import {Code} from './codes.js';

// Shared GSettings identifiers for the extension and its preferences.
export const Key = Object.freeze({
    FONT: 'font',
    FKEYS: 'fkeys',
    COLOR: 'active-color',
    CASE: 'case',
    CORNER: 'corner',
    ROUNDED: 'rounded',
    HEIGHT: 'height',
    SPACING: 'spacing',
    GLYPH_SIZE: 'glyph-size',
    LAYOUT: 'layout',
    MODE: 'modifier-mode',
    ACCENTS: 'accents',
    CLICK: 'click-enabled',
    SOUND: 'click-sound',
    VOLUME: 'click-volume',
});

// Fallbacks when a settings read yields no value.
// COLOR mirrors the gschema default for active-color, so an empty read cannot diverge from it.
export const Default = Object.freeze({COLOR: '#8a8a8e'});

// Clamp bounds for the integer percent settings (height of the display,
// key spacing, glyph size and click volume). Must mirror the gschema <range> on each key.
export const Bound = Object.freeze({
    HEIGHT_MIN: 18,
    HEIGHT_MAX: 60,
    SPACING_MIN: 0,
    SPACING_MAX: 100,
    GLYPH_MIN: 75,
    GLYPH_MAX: 135,
    VOLUME_MIN: 0,
    VOLUME_MAX: 100,
});

// Values mirror the gschema enum nicks; player.js keys its synthesis table on them,
// and prefs maps the dropdown index to the same order.
export const Click = Object.freeze({
    THOCK: 'thock',
    CLICK: 'click',
    TAP: 'tap',
    POP: 'pop',
});

// gschema enum nicks. Affects static key faces only;
// typed glyphs follow the active layout and Shift.
export const Case = Object.freeze({
    LOWER: 'lowercase',
    TITLE: 'titlecase',
    UPPER: 'uppercase',
});

// gschema enum nicks for the key-corner roundness. Soft is the stylesheet's 6px base;
// sharp and round are root-class overrides applied by keyboard.js _applyShape.
export const Corner = Object.freeze({
    SHARP: 'sharp',
    SOFT: 'soft',
    ROUND: 'round',
});

// gschema enum nicks indexing the geometry profile map.
// Alphabetic nicks (not bare percentages) keep the schema compiler happy.
export const Layout = Object.freeze({
    COMPACT: 'compact',
    STANDARD: 'standard',
    FULL: 'full',
});

// How a soft modifier responds to a tap (gschema enum nicks).
// HOLD: tap = one keystroke (lone Super opens the overview), long press = lock,
// tap on a lock clears it.
// LATCH (Gboard): tap = one-shot on the next keystroke, double tap = lock,
// tap on either clears it.
// TOGGLE: every tap flips a lock.
export const Mode = Object.freeze({
    HOLD: 'hold',
    LATCH: 'latch',
    TOGGLE: 'toggle',
});

// Reassignable function-row slots, left to right: each slot's default evdev code and face.
// Only F1-F12 are remappable; Esc, PrtSc, Del and the hide key stay fixed.
/** @typedef {{id: string, label: string, code: number}} Slot */
/** @type {readonly Slot[]} */
export const Slots = Object.freeze([
    {id: 'f1', label: 'F1', code: Code.F1},
    {id: 'f2', label: 'F2', code: Code.F2},
    {id: 'f3', label: 'F3', code: Code.F3},
    {id: 'f4', label: 'F4', code: Code.F4},
    {id: 'f5', label: 'F5', code: Code.F5},
    {id: 'f6', label: 'F6', code: Code.F6},
    {id: 'f7', label: 'F7', code: Code.F7},
    {id: 'f8', label: 'F8', code: Code.F8},
    {id: 'f9', label: 'F9', code: Code.F9},
    {id: 'f10', label: 'F10', code: Code.F10},
    {id: 'f11', label: 'F11', code: Code.F11},
    {id: 'f12', label: 'F12', code: Code.F12},
]);

// Functions a slot can be reassigned to. `name` labels the prefs dropdown,
// `face` draws on the key.
/** @typedef {{id: string, name: string, face: string, code: number}} FunctionSpec */
/** @type {readonly FunctionSpec[]} */
export const Functions = Object.freeze([
    {id: 'volume-up', name: 'Volume up', face: 'Vol+', code: Code.VOLUMEUP},
    {id: 'volume-down', name: 'Volume down', face: 'Vol−', code: Code.VOLUMEDOWN},
    {id: 'mute', name: 'Mute', face: 'Mute', code: Code.MUTE},
    {id: 'play-pause', name: 'Play / Pause', face: 'Play', code: Code.PLAYPAUSE},
    {id: 'next', name: 'Next track', face: 'Next', code: Code.NEXTSONG},
    {id: 'previous', name: 'Previous track', face: 'Prev', code: Code.PREVIOUSSONG},
    {id: 'brightness-up', name: 'Brightness up', face: 'Bri+', code: Code.BRIGHTNESSUP},
    {id: 'brightness-down', name: 'Brightness down', face: 'Bri−', code: Code.BRIGHTNESSDOWN},
    {id: 'mic-mute', name: 'Microphone mute', face: 'Mic', code: Code.MICMUTE},
    {id: 'home', name: 'Home', face: 'Home', code: Code.HOME},
    {id: 'end', name: 'End', face: 'End', code: Code.END},
    {id: 'page-up', name: 'Page up', face: 'pgup', code: Code.PAGEUP},
    {id: 'page-down', name: 'Page down', face: 'pgdn', code: Code.PAGEDOWN},
    {id: 'insert', name: 'Insert', face: 'Ins', code: Code.INSERT},
    {id: 'delete', name: 'Delete', face: 'Del', code: Code.DELETE},
    {id: 'print', name: 'Print screen', face: 'PrtSc', code: Code.PRINT},
]);

/**
 * @param {string} id
 * @returns {FunctionSpec | undefined}
 */
export function functionFor(id) {
    return Functions.find(entry => entry.id === id);
}

// What each slot taps while Fn is engaged (Keychron media row).
// A slot with no entry keeps its F-key under Fn; a user override beats Fn entirely.
// Mctl/Srch have no universal Linux action and may be inert.
/** @typedef {{slot: string, face: string, code: number}} MediaSpec */
/** @type {readonly MediaSpec[]} */
export const Media = Object.freeze([
    {slot: 'f1', face: 'Bri−', code: Code.BRIGHTNESSDOWN},
    {slot: 'f2', face: 'Bri+', code: Code.BRIGHTNESSUP},
    {slot: 'f3', face: 'Mctl', code: Code.SCALE},
    {slot: 'f4', face: 'Srch', code: Code.SEARCH},
    {slot: 'f5', face: 'Kbd−', code: Code.KBDILLUMDOWN},
    {slot: 'f6', face: 'Kbd+', code: Code.KBDILLUMUP},
    {slot: 'f7', face: 'Prev', code: Code.PREVIOUSSONG},
    {slot: 'f8', face: 'Play', code: Code.PLAYPAUSE},
    {slot: 'f9', face: 'Next', code: Code.NEXTSONG},
    {slot: 'f10', face: 'Mute', code: Code.MUTE},
    {slot: 'f11', face: 'Vol−', code: Code.VOLUMEDOWN},
    {slot: 'f12', face: 'Vol+', code: Code.VOLUMEUP},
]);

/**
 * @param {string} slot
 * @returns {MediaSpec | undefined}
 */
export function mediaFor(slot) {
    return Media.find(entry => entry.slot === slot);
}
