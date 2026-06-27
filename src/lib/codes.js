// Linux evdev key codes (linux/input-event-codes.h),
// injected through the virtual keyboard so the active xkb layout produces the glyph.
export const Code = Object.freeze({
    ESC: 1, GRAVE: 41,
    F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
    F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
    PRINT: 99,

    N1: 2, N2: 3, N3: 4, N4: 5, N5: 6, N6: 7, N7: 8, N8: 9, N9: 10, N0: 11,
    MINUS: 12, EQUAL: 13, BACKSPACE: 14,

    TAB: 15,
    Q: 16, W: 17, E: 18, R: 19, T: 20, Y: 21, U: 22, I: 23, O: 24, P: 25,
    LBRACKET: 26, RBRACKET: 27, BACKSLASH: 43,

    CAPS: 58,
    A: 30, S: 31, D: 32, F: 33, G: 34, H: 35, J: 36, K: 37, L: 38,
    SEMICOLON: 39, APOSTROPHE: 40, ENTER: 28,

    LSHIFT: 42,
    Z: 44, X: 45, C: 46, V: 47, B: 48, N: 49, M: 50,
    COMMA: 51, DOT: 52, SLASH: 53, RSHIFT: 54,

    LCTRL: 29, LSUPER: 125, LALT: 56, SPACE: 57, RALT: 100, RSUPER: 126, RCTRL: 97,

    UP: 103, DOWN: 108, LEFT: 105, RIGHT: 106,
    INSERT: 110, DELETE: 111, HOME: 102, END: 107, PAGEUP: 104, PAGEDOWN: 109,

    SCROLLLOCK: 70, PAUSE: 119,
    KPMINUS: 74, KPPLUS: 78, KPENTER: 96, KPSLASH: 98, KPASTERISK: 55,

    VOLUMEUP: 115, VOLUMEDOWN: 114, MUTE: 113,
    PLAYPAUSE: 164, NEXTSONG: 163, PREVIOUSSONG: 165,
    BRIGHTNESSUP: 225, BRIGHTNESSDOWN: 224, MICMUTE: 248,
    SCALE: 120, SEARCH: 217, KBDILLUMUP: 230, KBDILLUMDOWN: 229,
});

// Behaviour of a key when pressed.
export const Kind = Object.freeze({
    KEY: 'key',           // single tap, releases any one-shot modifiers afterwards
    MODIFIER: 'modifier', // tap = single keystroke / unlock; long press = lock
    LOCK: 'lock',         // toggles in the system (Caps Lock)
    NUM: 'num',           // local Num: toggles the numpad between numeric and navigation
    FN: 'fn',             // local Fn layer: selects each key's alternate face/code, injects nothing itself
    PAD: 'pad',           // a numpad key: types a digit or a navigation keysym per Num mode
    HIDE: 'hide',         // dismisses the on-screen keyboard, injects nothing
    SPACER: 'spacer',     // empty grid cell used to keep clusters aligned
});
