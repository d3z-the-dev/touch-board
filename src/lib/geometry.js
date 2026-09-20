import {Code, Kind} from './codes.js';
import {Layout} from './settings.js';

function key(code, label, span = 1, symbol) {
    return {code, label, span, kind: Kind.KEY, symbol};
}

function fkey(code, label, span = 1, slot, symbol) {
    return {code, label, span, kind: Kind.KEY, compact: true, fslot: slot, symbol};
}

function glyph(code, span = 1) {
    return {code, span, kind: Kind.KEY, glyph: true};
}

function modifier(code, label, span = 1, symbol) {
    return {code, label, span, kind: Kind.MODIFIER, symbol};
}

function lock(code, label, span = 1, symbol) {
    return {code, label, span, kind: Kind.LOCK, symbol};
}

function num(label, span = 1, symbol) {
    return {label, span, kind: Kind.NUM, symbol};
}

function fn(label, span = 1, symbol) {
    return {label, span, kind: Kind.FN, symbol};
}

function pad(digit, numeric, word, symbol, nav, span = 1) {
    return {span, kind: Kind.PAD, pad: {numeric: {face: digit, code: numeric}, nav: {word, symbol, code: nav}}};
}

function hide(label, span = 1, symbol) {
    return {label, span, kind: Kind.HIDE, compact: true, symbol};
}

function spacer(span) {
    return {span, kind: Kind.SPACER};
}

function tall(spec, rows) {
    return {...spec, rows};
}

function light(spec) {
    return {...spec, light: true};
}

function withFn(spec, code, face, symbol, slot) {
    return {...spec, fn: {code, face, symbol, slot}};
}

const standard = [
    [
        fkey(Code.ESC, 'Esc', 1, undefined, '⎋'),
        fkey(Code.F1, 'F1', 1, 'f1'), fkey(Code.F2, 'F2', 1, 'f2'),
        fkey(Code.F3, 'F3', 1, 'f3'), fkey(Code.F4, 'F4', 1, 'f4'),
        fkey(Code.F5, 'F5', 1, 'f5'), fkey(Code.F6, 'F6', 1, 'f6'),
        fkey(Code.F7, 'F7', 1, 'f7'), fkey(Code.F8, 'F8', 1, 'f8'),
        fkey(Code.F9, 'F9', 1, 'f9'), fkey(Code.F10, 'F10', 1, 'f10'),
        fkey(Code.F11, 'F11', 1, 'f11'), fkey(Code.F12, 'F12', 1, 'f12'),
        fkey(Code.PRINT, 'PrtSc', 1, undefined, '⎙'), fkey(Code.DELETE, 'Del', 1, undefined, '⌦'), hide('Hide', 1, '⌄'),
    ],
    [
        glyph(Code.GRAVE),
        glyph(Code.N1), glyph(Code.N2), glyph(Code.N3), glyph(Code.N4), glyph(Code.N5),
        glyph(Code.N6), glyph(Code.N7), glyph(Code.N8), glyph(Code.N9), glyph(Code.N0),
        glyph(Code.MINUS), glyph(Code.EQUAL), key(Code.BACKSPACE, 'Backspace', 2, '⌫'),
        key(Code.PAGEUP, 'pgup', 1, '⇞'),
    ],
    [
        key(Code.TAB, 'Tab', 1.5, '⇥'),
        glyph(Code.Q), glyph(Code.W), glyph(Code.E), glyph(Code.R), glyph(Code.T),
        glyph(Code.Y), glyph(Code.U), glyph(Code.I), glyph(Code.O), glyph(Code.P),
        glyph(Code.LBRACKET), glyph(Code.RBRACKET), glyph(Code.BACKSLASH, 1.5),
        key(Code.PAGEDOWN, 'pgdn', 1, '⇟'),
    ],
    [
        lock(Code.CAPS, 'Caps', 1.75, '⇪'),
        glyph(Code.A), glyph(Code.S), glyph(Code.D), glyph(Code.F), glyph(Code.G),
        glyph(Code.H), glyph(Code.J), glyph(Code.K), glyph(Code.L),
        glyph(Code.SEMICOLON), glyph(Code.APOSTROPHE), key(Code.ENTER, 'Enter', 2.25, '⏎'),
        key(Code.HOME, 'Home', 1, '⇱'),
    ],
    [
        modifier(Code.LSHIFT, 'Shift', 2.25, '⇧'),
        glyph(Code.Z), glyph(Code.X), glyph(Code.C), glyph(Code.V), glyph(Code.B),
        glyph(Code.N), glyph(Code.M),
        glyph(Code.COMMA), glyph(Code.DOT), glyph(Code.SLASH),
        modifier(Code.RSHIFT, 'Shift', 1.75, '⇧'),
        key(Code.UP, '↑'), key(Code.END, 'End', 1, '⇲'),
    ],
    [
        modifier(Code.LCTRL, 'Ctrl', 1.25, '⌃'),
        modifier(Code.LSUPER, 'Super', 1.25, '❖'),
        modifier(Code.LALT, 'Alt', 1.25, '⌥'),
        key(Code.SPACE, '', 6.25),
        modifier(Code.RALT, 'Alt', 1, '⌥'),
        fn('Fn', 1),
        modifier(Code.RCTRL, 'Ctrl', 1, '⌃'),
        key(Code.LEFT, '←'), key(Code.DOWN, '↓'), key(Code.RIGHT, '→'),
    ],
];

const compact = [
    [
        withFn(key(Code.ESC, 'Esc', 1, '⎋'), Code.GRAVE, '`'),
        withFn(glyph(Code.N1), Code.F1, 'F1', undefined, 'f1'), withFn(glyph(Code.N2), Code.F2, 'F2', undefined, 'f2'),
        withFn(glyph(Code.N3), Code.F3, 'F3', undefined, 'f3'), withFn(glyph(Code.N4), Code.F4, 'F4', undefined, 'f4'),
        withFn(glyph(Code.N5), Code.F5, 'F5', undefined, 'f5'), withFn(glyph(Code.N6), Code.F6, 'F6', undefined, 'f6'),
        withFn(glyph(Code.N7), Code.F7, 'F7', undefined, 'f7'), withFn(glyph(Code.N8), Code.F8, 'F8', undefined, 'f8'),
        withFn(glyph(Code.N9), Code.F9, 'F9', undefined, 'f9'), withFn(glyph(Code.N0), Code.F10, 'F10', undefined, 'f10'),
        withFn(glyph(Code.MINUS), Code.F11, 'F11', undefined, 'f11'), withFn(glyph(Code.EQUAL), Code.F12, 'F12', undefined, 'f12'),
        withFn(key(Code.BACKSPACE, 'Backspace', 2, '⌫'), Code.DELETE, 'Del'),
    ],
    [
        key(Code.TAB, 'Tab', 1.5, '⇥'),
        glyph(Code.Q), glyph(Code.W), glyph(Code.E), glyph(Code.R), glyph(Code.T),
        glyph(Code.Y), withFn(glyph(Code.U), Code.HOME, 'Home', '⇱'), withFn(glyph(Code.I), Code.UP, '↑'),
        withFn(glyph(Code.O), Code.END, 'End', '⇲'), withFn(glyph(Code.P), Code.PAGEUP, 'pgup', '⇞'),
        glyph(Code.LBRACKET), glyph(Code.RBRACKET), glyph(Code.BACKSLASH, 1.5),
    ],
    [
        lock(Code.CAPS, 'Caps', 1.75, '⇪'),
        glyph(Code.A), glyph(Code.S), glyph(Code.D), glyph(Code.F), glyph(Code.G),
        glyph(Code.H), withFn(glyph(Code.J), Code.LEFT, '←'), withFn(glyph(Code.K), Code.DOWN, '↓'),
        withFn(glyph(Code.L), Code.RIGHT, '→'),
        withFn(glyph(Code.SEMICOLON), Code.PAGEDOWN, 'pgdn', '⇟'), glyph(Code.APOSTROPHE), key(Code.ENTER, 'Enter', 2.25, '⏎'),
    ],
    [
        modifier(Code.LSHIFT, 'Shift', 2.25, '⇧'),
        glyph(Code.Z), glyph(Code.X), glyph(Code.C), glyph(Code.V), glyph(Code.B),
        glyph(Code.N), glyph(Code.M),
        glyph(Code.COMMA), glyph(Code.DOT), glyph(Code.SLASH),
        modifier(Code.RSHIFT, 'Shift', 2.75, '⇧'),
    ],
    [
        modifier(Code.LCTRL, 'Ctrl', 1.25, '⌃'),
        modifier(Code.LSUPER, 'Super', 1.25, '❖'),
        modifier(Code.LALT, 'Alt', 1.25, '⌥'),
        key(Code.SPACE, '', 6.25),
        modifier(Code.RALT, 'Alt', 1.25, '⌥'),
        fn('Fn', 1.25),
        modifier(Code.RCTRL, 'Ctrl', 1.25, '⌃'),
        hide('Hide', 1.25, '⌄'),
    ],
];

const full = [
    [
        fkey(Code.ESC, 'Esc', 1, undefined, '⎋'), spacer(1),
        fkey(Code.F1, 'F1', 1, 'f1'), fkey(Code.F2, 'F2', 1, 'f2'),
        fkey(Code.F3, 'F3', 1, 'f3'), fkey(Code.F4, 'F4', 1, 'f4'), spacer(0.5),
        fkey(Code.F5, 'F5', 1, 'f5'), fkey(Code.F6, 'F6', 1, 'f6'),
        fkey(Code.F7, 'F7', 1, 'f7'), fkey(Code.F8, 'F8', 1, 'f8'), spacer(0.5),
        fkey(Code.F9, 'F9', 1, 'f9'), fkey(Code.F10, 'F10', 1, 'f10'),
        fkey(Code.F11, 'F11', 1, 'f11'), fkey(Code.F12, 'F12', 1, 'f12'), spacer(0.25),
        fkey(Code.PRINT, 'PrtSc', 1, undefined, '⎙'),
        fkey(Code.SCROLLLOCK, 'ScrLk', 1, undefined, '⤓'),
        fkey(Code.PAUSE, 'Pause', 1, undefined, '⏸'), spacer(0.25),
        light(fkey(Code.MUTE, 'Mute', 1, undefined, '🔇')),
        light(fkey(Code.VOLUMEDOWN, 'Vol−', 1, undefined, '🔉')),
        light(fkey(Code.VOLUMEUP, 'Vol+', 1, undefined, '🔊')), light(hide('Hide', 1, '⌄')),
    ],
    [
        glyph(Code.GRAVE),
        glyph(Code.N1), glyph(Code.N2), glyph(Code.N3), glyph(Code.N4), glyph(Code.N5),
        glyph(Code.N6), glyph(Code.N7), glyph(Code.N8), glyph(Code.N9), glyph(Code.N0),
        glyph(Code.MINUS), glyph(Code.EQUAL), key(Code.BACKSPACE, 'Backspace', 2, '⌫'),
        spacer(0.25),
        key(Code.INSERT, 'Ins', 1, '⎀'), key(Code.HOME, 'Home', 1, '⇱'), key(Code.PAGEUP, 'pgup', 1, '⇞'),
        spacer(0.25),
        light(num('Num', 1, '⇭')),
        key(Code.KPSLASH, '/', 1), key(Code.KPASTERISK, '*', 1), key(Code.KPMINUS, '−', 1),
    ],
    [
        key(Code.TAB, 'Tab', 1.5, '⇥'),
        glyph(Code.Q), glyph(Code.W), glyph(Code.E), glyph(Code.R), glyph(Code.T),
        glyph(Code.Y), glyph(Code.U), glyph(Code.I), glyph(Code.O), glyph(Code.P),
        glyph(Code.LBRACKET), glyph(Code.RBRACKET), glyph(Code.BACKSLASH, 1.5),
        spacer(0.25),
        key(Code.DELETE, 'Del', 1, '⌦'), key(Code.END, 'End', 1, '⇲'), key(Code.PAGEDOWN, 'pgdn', 1, '⇟'),
        spacer(0.25),
        pad('7', Code.N7, 'Home', '⇱', Code.HOME), pad('8', Code.N8, '↑', '↑', Code.UP),
        pad('9', Code.N9, 'pgup', '⇞', Code.PAGEUP), tall(key(Code.KPPLUS, '+'), 2),
    ],
    [
        lock(Code.CAPS, 'Caps', 1.75, '⇪'),
        glyph(Code.A), glyph(Code.S), glyph(Code.D), glyph(Code.F), glyph(Code.G),
        glyph(Code.H), glyph(Code.J), glyph(Code.K), glyph(Code.L),
        glyph(Code.SEMICOLON), glyph(Code.APOSTROPHE), key(Code.ENTER, 'Enter', 2.25, '⏎'),
        spacer(0.25),
        spacer(3),
        spacer(0.25),
        pad('4', Code.N4, '←', '←', Code.LEFT), pad('5', Code.N5, '', ''),
        pad('6', Code.N6, '→', '→', Code.RIGHT), spacer(1),
    ],
    [
        modifier(Code.LSHIFT, 'Shift', 2.25, '⇧'),
        glyph(Code.Z), glyph(Code.X), glyph(Code.C), glyph(Code.V), glyph(Code.B),
        glyph(Code.N), glyph(Code.M),
        glyph(Code.COMMA), glyph(Code.DOT), glyph(Code.SLASH),
        modifier(Code.RSHIFT, 'Shift', 2.75, '⇧'),
        spacer(0.25),
        spacer(1), key(Code.UP, '↑'), spacer(1),
        spacer(0.25),
        pad('1', Code.N1, 'End', '⇲', Code.END), pad('2', Code.N2, '↓', '↓', Code.DOWN),
        pad('3', Code.N3, 'pgdn', '⇟', Code.PAGEDOWN),
        tall(key(Code.KPENTER, 'Enter', 1, '⏎'), 2),
    ],
    [
        modifier(Code.LCTRL, 'Ctrl', 1.25, '⌃'),
        modifier(Code.LSUPER, 'Super', 1.25, '❖'),
        modifier(Code.LALT, 'Alt', 1.25, '⌥'),
        key(Code.SPACE, '', 6.25),
        modifier(Code.RALT, 'Alt', 1.25, '⌥'),
        modifier(Code.RSUPER, 'Super', 1.25, '❖'),
        fn('Fn', 1.25),
        modifier(Code.RCTRL, 'Ctrl', 1.25, '⌃'),
        spacer(0.25),
        key(Code.LEFT, '←'), key(Code.DOWN, '↓'), key(Code.RIGHT, '→'),
        spacer(0.25),
        pad('0', Code.N0, 'Ins', '⎀', Code.INSERT, 2), pad('.', Code.DOT, 'Del', '⌦', Code.DELETE), spacer(1),
    ],
];

export const profiles = Object.freeze({
    [Layout.COMPACT]: compact,
    [Layout.STANDARD]: standard,
    [Layout.FULL]: full,
});
