import {Code} from './codes.js';

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
    LOOK: 'style',
    LAYOUT: 'layout',
    MODE: 'modifier-mode',
    ACCENTS: 'accents',
    CLICK: 'click-enabled',
    SOUND: 'click-sound',
    VOLUME: 'click-volume',
});

export const Default = Object.freeze({FAMILY: 'IBM Plex Sans', ACCENT: '#3584e4'});

export const Look = Object.freeze({
    MODERN: 'modern',
    CLASSIC: 'classic',
});

export const Click = Object.freeze({
    THOCK: 'thock',
    CLICK: 'click',
    TAP: 'tap',
});

export const Case = Object.freeze({
    LOWER: 'lowercase',
    TITLE: 'titlecase',
    UPPER: 'uppercase',
});

export const Corner = Object.freeze({
    SHARP: 'sharp',
    SOFT: 'soft',
    ROUND: 'round',
});

export const Layout = Object.freeze({
    COMPACT: 'compact',
    STANDARD: 'standard',
    FULL: 'full',
});

export const Mode = Object.freeze({
    HOLD: 'hold',
    LATCH: 'latch',
    TOGGLE: 'toggle',
});

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

export const Functions = Object.freeze([
    {id: 'volume-up', name: 'Volume up', face: 'Vol+', symbol: '♪+', code: Code.VOLUMEUP},
    {id: 'volume-down', name: 'Volume down', face: 'Vol−', symbol: '♪−', code: Code.VOLUMEDOWN},
    {id: 'mute', name: 'Mute', face: 'Mute', symbol: '⊗', code: Code.MUTE},
    {id: 'play-pause', name: 'Play / Pause', face: 'Play', symbol: '▶', code: Code.PLAYPAUSE},
    {id: 'next', name: 'Next track', face: 'Next', symbol: '▶▶', code: Code.NEXTSONG},
    {id: 'previous', name: 'Previous track', face: 'Prev', symbol: '◀◀', code: Code.PREVIOUSSONG},
    {id: 'brightness-up', name: 'Brightness up', face: 'Bri+', symbol: '☼+', code: Code.BRIGHTNESSUP},
    {id: 'brightness-down', name: 'Brightness down', face: 'Bri−', symbol: '☼−', code: Code.BRIGHTNESSDOWN},
    {id: 'mic-mute', name: 'Microphone mute', face: 'Mic', code: Code.MICMUTE},
    {id: 'home', name: 'Home', face: 'Home', symbol: '⇱', code: Code.HOME},
    {id: 'end', name: 'End', face: 'End', symbol: '⇲', code: Code.END},
    {id: 'page-up', name: 'Page up', face: 'pgup', symbol: '⇞', code: Code.PAGEUP},
    {id: 'page-down', name: 'Page down', face: 'pgdn', symbol: '⇟', code: Code.PAGEDOWN},
    {id: 'insert', name: 'Insert', face: 'Ins', symbol: '⎀', code: Code.INSERT},
    {id: 'delete', name: 'Delete', face: 'Del', symbol: '⌦', code: Code.DELETE},
    {id: 'print', name: 'Print screen', face: 'PrtSc', symbol: 'PrS', code: Code.PRINT},
]);

export function functionFor(id) {
    return Functions.find(entry => entry.id === id);
}

export const Media = Object.freeze([
    {slot: 'f1', face: 'Bri−', symbol: '☼−', code: Code.BRIGHTNESSDOWN},
    {slot: 'f2', face: 'Bri+', symbol: '☼+', code: Code.BRIGHTNESSUP},
    {slot: 'f3', face: 'Mctl', symbol: '■', code: Code.SCALE},
    {slot: 'f4', face: 'Srch', symbol: '◯', code: Code.SEARCH},
    {slot: 'f5', face: 'Kbd−', symbol: 'Kb−', code: Code.KBDILLUMDOWN},
    {slot: 'f6', face: 'Kbd+', symbol: 'Kb+', code: Code.KBDILLUMUP},
    {slot: 'f7', face: 'Prev', symbol: '◀◀', code: Code.PREVIOUSSONG},
    {slot: 'f8', face: 'Play', symbol: '▶', code: Code.PLAYPAUSE},
    {slot: 'f9', face: 'Next', symbol: '▶▶', code: Code.NEXTSONG},
    {slot: 'f10', face: 'Mute', symbol: '⊗', code: Code.MUTE},
    {slot: 'f11', face: 'Vol−', symbol: '♪−', code: Code.VOLUMEDOWN},
    {slot: 'f12', face: 'Vol+', symbol: '♪+', code: Code.VOLUMEUP},
]);

export function mediaFor(slot) {
    return Media.find(entry => entry.slot === slot);
}
