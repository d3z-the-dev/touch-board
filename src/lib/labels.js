import {Code} from './codes.js';

// Cosmetic glyphs shown on keys per xkb layout id;
// typing correctness does not depend on them (the active layout translates the injected code).
// Keyed by evdev code, missing entries fall back to US.
// Each level lists only positions whose face differs from the upper-cased base;
// shift upper-cases the base, altgr falls through to it.

/** @typedef {Record<number, string>} Level */
/** @typedef {{base: Level, shift?: Level, altgr?: Level, altgrShift?: Level}} Layout */

/** @type {Level} */
const us = {
    [Code.GRAVE]: '`',
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: '-', [Code.EQUAL]: '=',
    [Code.Q]: 'q', [Code.W]: 'w', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'y', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: '[', [Code.RBRACKET]: ']',
    [Code.A]: 'a', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: ';', [Code.APOSTROPHE]: '\'', [Code.BACKSLASH]: '\\',
    [Code.Z]: 'z', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: 'm',
    [Code.COMMA]: ',', [Code.DOT]: '.', [Code.SLASH]: '/',
};

/** @type {Level} */
const usShift = {
    [Code.GRAVE]: '~',
    [Code.N1]: '!', [Code.N2]: '@', [Code.N3]: '#', [Code.N4]: '$', [Code.N5]: '%',
    [Code.N6]: '^', [Code.N7]: '&', [Code.N8]: '*', [Code.N9]: '(', [Code.N0]: ')',
    [Code.MINUS]: '_', [Code.EQUAL]: '+',
    [Code.LBRACKET]: '{', [Code.RBRACKET]: '}', [Code.BACKSLASH]: '|',
    [Code.SEMICOLON]: ':', [Code.APOSTROPHE]: '"',
    [Code.COMMA]: '<', [Code.DOT]: '>', [Code.SLASH]: '?',
};

/** @type {Level} */
const gb = {...us, [Code.BACKSLASH]: '#'};
/** @type {Level} */
const gbShift = {
    ...usShift,
    [Code.N2]: '"', [Code.N3]: '£', [Code.GRAVE]: '¬',
    [Code.APOSTROPHE]: '@', [Code.BACKSLASH]: '~',
};
/** @type {Level} */
const gbAltgr = {
    [Code.N4]: '€', [Code.GRAVE]: '¦',
};

/** @type {Level} */
const de = {
    [Code.GRAVE]: '^',
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: 'ß', [Code.EQUAL]: '´',
    [Code.Q]: 'q', [Code.W]: 'w', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'z', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: 'ü', [Code.RBRACKET]: '+',
    [Code.A]: 'a', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: 'ö', [Code.APOSTROPHE]: 'ä', [Code.BACKSLASH]: '#',
    [Code.Z]: 'y', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: 'm',
    [Code.COMMA]: ',', [Code.DOT]: '.', [Code.SLASH]: '-',
};
/** @type {Level} */
const deShift = {
    [Code.GRAVE]: '°',
    [Code.N1]: '!', [Code.N2]: '"', [Code.N3]: '§', [Code.N4]: '$', [Code.N5]: '%',
    [Code.N6]: '&', [Code.N7]: '/', [Code.N8]: '(', [Code.N9]: ')', [Code.N0]: '=',
    [Code.MINUS]: '?', [Code.EQUAL]: '`',
    [Code.RBRACKET]: '*', [Code.BACKSLASH]: '\'',
    [Code.COMMA]: ';', [Code.DOT]: ':', [Code.SLASH]: '_',
};
/** @type {Level} */
const deAltgr = {
    [Code.N2]: '²', [Code.N3]: '³',
    [Code.N7]: '{', [Code.N8]: '[', [Code.N9]: ']', [Code.N0]: '}',
    [Code.MINUS]: '\\', [Code.Q]: '@', [Code.E]: '€', [Code.RBRACKET]: '~',
    [Code.M]: 'µ',
};

/** @type {Level} */
const ru = {
    [Code.GRAVE]: 'ё',
    [Code.Q]: 'й', [Code.W]: 'ц', [Code.E]: 'у', [Code.R]: 'к', [Code.T]: 'е',
    [Code.Y]: 'н', [Code.U]: 'г', [Code.I]: 'ш', [Code.O]: 'щ', [Code.P]: 'з',
    [Code.LBRACKET]: 'х', [Code.RBRACKET]: 'ъ',
    [Code.A]: 'ф', [Code.S]: 'ы', [Code.D]: 'в', [Code.F]: 'а', [Code.G]: 'п',
    [Code.H]: 'р', [Code.J]: 'о', [Code.K]: 'л', [Code.L]: 'д',
    [Code.SEMICOLON]: 'ж', [Code.APOSTROPHE]: 'э',
    [Code.Z]: 'я', [Code.X]: 'ч', [Code.C]: 'с', [Code.V]: 'м', [Code.B]: 'и',
    [Code.N]: 'т', [Code.M]: 'ь',
    [Code.COMMA]: 'б', [Code.DOT]: 'ю', [Code.SLASH]: '.',
};

/** @type {Level} */
const ruShift = {
    [Code.N1]: '!', [Code.N2]: '"', [Code.N3]: '№', [Code.N4]: ';', [Code.N5]: '%',
    [Code.N6]: ':', [Code.N7]: '?', [Code.N8]: '*', [Code.N9]: '(', [Code.N0]: ')',
    [Code.MINUS]: '_', [Code.EQUAL]: '+', [Code.SLASH]: ',',
};

/** @type {Level} */
const ua = {
    [Code.GRAVE]: 'ʼ',
    [Code.Q]: 'й', [Code.W]: 'ц', [Code.E]: 'у', [Code.R]: 'к', [Code.T]: 'е',
    [Code.Y]: 'н', [Code.U]: 'г', [Code.I]: 'ш', [Code.O]: 'щ', [Code.P]: 'з',
    [Code.LBRACKET]: 'х', [Code.RBRACKET]: 'ї',
    [Code.A]: 'ф', [Code.S]: 'і', [Code.D]: 'в', [Code.F]: 'а', [Code.G]: 'п',
    [Code.H]: 'р', [Code.J]: 'о', [Code.K]: 'л', [Code.L]: 'д',
    [Code.SEMICOLON]: 'ж', [Code.APOSTROPHE]: 'є',
    [Code.Z]: 'я', [Code.X]: 'ч', [Code.C]: 'с', [Code.V]: 'м', [Code.B]: 'и',
    [Code.N]: 'т', [Code.M]: 'ь',
    [Code.COMMA]: 'б', [Code.DOT]: 'ю', [Code.SLASH]: '.',
};

const uaShift = ruShift;

// Polish (programmers): base and shift are US QWERTY; diacritics live on AltGr.
/** @type {Level} */
const plAltgr = {
    [Code.A]: 'ą', [Code.C]: 'ć', [Code.E]: 'ę', [Code.L]: 'ł', [Code.N]: 'ń',
    [Code.O]: 'ó', [Code.S]: 'ś', [Code.X]: 'ź', [Code.Z]: 'ż',
};
/** @type {Level} */
const plAltgrShift = {
    [Code.A]: 'Ą', [Code.C]: 'Ć', [Code.E]: 'Ę', [Code.L]: 'Ł', [Code.N]: 'Ń',
    [Code.O]: 'Ó', [Code.S]: 'Ś', [Code.X]: 'Ź', [Code.Z]: 'Ż',
};

/** @type {Level} */
const es = {
    [Code.GRAVE]: 'º',
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: '\'', [Code.EQUAL]: '¡',
    [Code.Q]: 'q', [Code.W]: 'w', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'y', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: '`', [Code.RBRACKET]: '+',
    [Code.A]: 'a', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: 'ñ', [Code.APOSTROPHE]: '´',
    [Code.BACKSLASH]: 'ç',
    [Code.Z]: 'z', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: 'm',
    [Code.COMMA]: ',', [Code.DOT]: '.', [Code.SLASH]: '-',
};
/** @type {Level} */
const esShift = {
    [Code.GRAVE]: 'ª',
    [Code.N1]: '!', [Code.N2]: '"', [Code.N3]: '·', [Code.N4]: '$', [Code.N5]: '%',
    [Code.N6]: '&', [Code.N7]: '/', [Code.N8]: '(', [Code.N9]: ')', [Code.N0]: '=',
    [Code.MINUS]: '?', [Code.EQUAL]: '¿',
    [Code.LBRACKET]: '^', [Code.RBRACKET]: '*',
    [Code.APOSTROPHE]: '¨', [Code.BACKSLASH]: 'Ç',
    [Code.COMMA]: ';', [Code.DOT]: ':', [Code.SLASH]: '_',
};
/** @type {Level} */
const esAltgr = {
    [Code.GRAVE]: '\\',
    [Code.N1]: '|', [Code.N2]: '@', [Code.N3]: '#', [Code.N4]: '~',
    [Code.N6]: '¬', [Code.E]: '€',
    [Code.LBRACKET]: '[', [Code.RBRACKET]: ']',
    [Code.APOSTROPHE]: '{', [Code.BACKSLASH]: '}',
};

/** @type {Level} */
const fr = {
    [Code.GRAVE]: '²',
    [Code.N1]: '&', [Code.N2]: 'é', [Code.N3]: '"', [Code.N4]: '\'', [Code.N5]: '(',
    [Code.N6]: '-', [Code.N7]: 'è', [Code.N8]: '_', [Code.N9]: 'ç', [Code.N0]: 'à',
    [Code.MINUS]: ')', [Code.EQUAL]: '=',
    [Code.Q]: 'a', [Code.W]: 'z', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'y', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: '^', [Code.RBRACKET]: '$',
    [Code.A]: 'q', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: 'm', [Code.APOSTROPHE]: 'ù',
    [Code.BACKSLASH]: '*',
    [Code.Z]: 'w', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: ',',
    [Code.COMMA]: ';', [Code.DOT]: ':', [Code.SLASH]: '!',
};
/** @type {Level} */
const frShift = {
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: '°', [Code.EQUAL]: '+',
    [Code.LBRACKET]: '¨', [Code.RBRACKET]: '£',
    [Code.APOSTROPHE]: '%', [Code.BACKSLASH]: 'µ',
    [Code.M]: '?', [Code.COMMA]: '.', [Code.DOT]: '/', [Code.SLASH]: '§',
};
/** @type {Level} */
const frAltgr = {
    [Code.N2]: '~', [Code.N3]: '#', [Code.N4]: '{', [Code.N5]: '[', [Code.N6]: '|',
    [Code.N7]: '`', [Code.N8]: '\\', [Code.N9]: '^', [Code.N0]: '@',
    [Code.MINUS]: ']', [Code.EQUAL]: '}', [Code.E]: '€',
};

/** @type {Level} */
const cz = {
    [Code.GRAVE]: ';',
    [Code.N1]: '+', [Code.N2]: 'ě', [Code.N3]: 'š', [Code.N4]: 'č', [Code.N5]: 'ř',
    [Code.N6]: 'ž', [Code.N7]: 'ý', [Code.N8]: 'á', [Code.N9]: 'í', [Code.N0]: 'é',
    [Code.MINUS]: '=', [Code.EQUAL]: '´',
    [Code.Q]: 'q', [Code.W]: 'w', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'z', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: 'ú', [Code.RBRACKET]: ')',
    [Code.A]: 'a', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: 'ů', [Code.APOSTROPHE]: '§', [Code.BACKSLASH]: '¨',
    [Code.Z]: 'y', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: 'm',
    [Code.COMMA]: ',', [Code.DOT]: '.', [Code.SLASH]: '-',
};
/** @type {Level} */
const czShift = {
    [Code.GRAVE]: '°',
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: '%', [Code.EQUAL]: 'ˇ',
    [Code.LBRACKET]: '/', [Code.RBRACKET]: '(',
    [Code.SEMICOLON]: '"', [Code.APOSTROPHE]: '!', [Code.BACKSLASH]: '\'',
    [Code.COMMA]: '?', [Code.DOT]: ':', [Code.SLASH]: '_',
};
/** @type {Level} */
const czAltgr = {
    [Code.E]: '€',
};

/** @type {Level} */
const it = {
    [Code.GRAVE]: '\\',
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: '\'', [Code.EQUAL]: 'ì',
    [Code.Q]: 'q', [Code.W]: 'w', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'y', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: 'è', [Code.RBRACKET]: '+',
    [Code.A]: 'a', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: 'ò', [Code.APOSTROPHE]: 'à', [Code.BACKSLASH]: 'ù',
    [Code.Z]: 'z', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: 'm',
    [Code.COMMA]: ',', [Code.DOT]: '.', [Code.SLASH]: '-',
};
/** @type {Level} */
const itShift = {
    [Code.GRAVE]: '|',
    [Code.N1]: '!', [Code.N2]: '"', [Code.N3]: '£', [Code.N4]: '$', [Code.N5]: '%',
    [Code.N6]: '&', [Code.N7]: '/', [Code.N8]: '(', [Code.N9]: ')', [Code.N0]: '=',
    [Code.MINUS]: '?', [Code.EQUAL]: '^',
    [Code.LBRACKET]: 'é', [Code.RBRACKET]: '*',
    [Code.SEMICOLON]: 'ç', [Code.APOSTROPHE]: '°', [Code.BACKSLASH]: '§',
    [Code.COMMA]: ';', [Code.DOT]: ':', [Code.SLASH]: '_',
};
/** @type {Level} */
const itAltgr = {
    [Code.E]: '€',
    [Code.LBRACKET]: '[', [Code.RBRACKET]: ']',
    [Code.SEMICOLON]: '@', [Code.APOSTROPHE]: '#',
};

/** @type {Level} */
const pt = {
    [Code.GRAVE]: '\\',
    [Code.N1]: '1', [Code.N2]: '2', [Code.N3]: '3', [Code.N4]: '4', [Code.N5]: '5',
    [Code.N6]: '6', [Code.N7]: '7', [Code.N8]: '8', [Code.N9]: '9', [Code.N0]: '0',
    [Code.MINUS]: '\'', [Code.EQUAL]: '«',
    [Code.Q]: 'q', [Code.W]: 'w', [Code.E]: 'e', [Code.R]: 'r', [Code.T]: 't',
    [Code.Y]: 'y', [Code.U]: 'u', [Code.I]: 'i', [Code.O]: 'o', [Code.P]: 'p',
    [Code.LBRACKET]: '+', [Code.RBRACKET]: '´',
    [Code.A]: 'a', [Code.S]: 's', [Code.D]: 'd', [Code.F]: 'f', [Code.G]: 'g',
    [Code.H]: 'h', [Code.J]: 'j', [Code.K]: 'k', [Code.L]: 'l',
    [Code.SEMICOLON]: 'ç', [Code.APOSTROPHE]: 'º', [Code.BACKSLASH]: '~',
    [Code.Z]: 'z', [Code.X]: 'x', [Code.C]: 'c', [Code.V]: 'v', [Code.B]: 'b',
    [Code.N]: 'n', [Code.M]: 'm',
    [Code.COMMA]: ',', [Code.DOT]: '.', [Code.SLASH]: '-',
};
/** @type {Level} */
const ptShift = {
    [Code.GRAVE]: '|',
    [Code.N1]: '!', [Code.N2]: '"', [Code.N3]: '#', [Code.N4]: '$', [Code.N5]: '%',
    [Code.N6]: '&', [Code.N7]: '/', [Code.N8]: '(', [Code.N9]: ')', [Code.N0]: '=',
    [Code.MINUS]: '?', [Code.EQUAL]: '»',
    [Code.LBRACKET]: '*', [Code.RBRACKET]: '`',
    [Code.APOSTROPHE]: 'ª', [Code.BACKSLASH]: '^',
    [Code.COMMA]: ';', [Code.DOT]: ':', [Code.SLASH]: '_',
};
/** @type {Level} */
const ptAltgr = {
    [Code.N2]: '@', [Code.N3]: '£', [Code.N4]: '§',
    [Code.N7]: '{', [Code.N8]: '[', [Code.N9]: ']', [Code.N0]: '}',
    [Code.E]: '€',
};

// Korean (Dubeolsik, 2-set): faces are the jamo on Korean keycaps,
// number row and symbols match US. Shift carries the tense/compound jamo; the rest fall through.
/** @type {Level} */
const ko = {
    ...us,
    [Code.Q]: 'ㅂ', [Code.W]: 'ㅈ', [Code.E]: 'ㄷ', [Code.R]: 'ㄱ', [Code.T]: 'ㅅ',
    [Code.Y]: 'ㅛ', [Code.U]: 'ㅕ', [Code.I]: 'ㅑ', [Code.O]: 'ㅐ', [Code.P]: 'ㅔ',
    [Code.A]: 'ㅁ', [Code.S]: 'ㄴ', [Code.D]: 'ㅇ', [Code.F]: 'ㄹ', [Code.G]: 'ㅎ',
    [Code.H]: 'ㅗ', [Code.J]: 'ㅓ', [Code.K]: 'ㅏ', [Code.L]: 'ㅣ',
    [Code.Z]: 'ㅋ', [Code.X]: 'ㅌ', [Code.C]: 'ㅊ', [Code.V]: 'ㅍ', [Code.B]: 'ㅠ',
    [Code.N]: 'ㅜ', [Code.M]: 'ㅡ',
};
/** @type {Level} */
const koShift = {
    ...usShift,
    [Code.Q]: 'ㅃ', [Code.W]: 'ㅉ', [Code.E]: 'ㄸ', [Code.R]: 'ㄲ', [Code.T]: 'ㅆ',
    [Code.O]: 'ㅒ', [Code.P]: 'ㅖ',
};

/** @type {Record<string, Layout>} */
const layouts = {
    us: {base: us, shift: usShift},
    gb: {base: gb, shift: gbShift, altgr: gbAltgr},
    de: {base: de, shift: deShift, altgr: deAltgr},
    ru: {base: ru, shift: ruShift},
    ua: {base: ua, shift: uaShift},
    pl: {base: us, shift: usShift, altgr: plAltgr, altgrShift: plAltgrShift},
    es: {base: es, shift: esShift, altgr: esAltgr},
    fr: {base: fr, shift: frShift, altgr: frAltgr},
    cz: {base: cz, shift: czShift, altgr: czAltgr},
    it: {base: it, shift: itShift, altgr: itAltgr},
    pt: {base: pt, shift: ptShift, altgr: ptAltgr},
    ja: {base: us, shift: usShift},
    zh: {base: us, shift: usShift},
    ko: {base: ko, shift: koShift},
};

// GNOME reports some sources under an alternate xkb id; map those to a layout.
/** @type {Record<string, string>} */
const alias = {uk: 'ua', jp: 'ja', kr: 'ko', cn: 'zh'};

/**
 * @param {string} layoutId
 * @returns {Layout}
 */
function resolve(layoutId) {
    return layouts[layoutId] ?? layouts[alias[layoutId]] ?? layouts.us;
}

/** @typedef {{shift?: boolean, altgr?: boolean}} Level2 */

/**
 * @param {string} layoutId
 * @returns {boolean}
 */
export function supports(layoutId) {
    return Object.hasOwn(layouts, layoutId) || Object.hasOwn(alias, layoutId);
}

// CJK sources whose native script comes from an input-method engine.
// With no engine active there is nothing to compose, so the keyboard treats such a source as bare us.
// Holds the raw xkb ids an engine reports plus the canonical names.
const CJK = new Set(['ja', 'jp', 'zh', 'cn', 'ko', 'kr']);

/**
 * @param {string} layoutId
 * @returns {boolean}
 */
export function cjk(layoutId) {
    return CJK.has(layoutId);
}

/**
 * Face for the active layout and modifier level: AltGr wins, else shift, else the
 * base upper-cased.
 * @param {string} layoutId
 * @param {number} code
 * @param {Level2} [level]
 * @returns {string}
 */
export function glyphFor(layoutId, code, level = {}) {
    const layout = resolve(layoutId);
    if (level.altgr) {
        const map = (level.shift ? layout.altgrShift ?? layout.altgr : layout.altgr) ?? {};
        const face = map[code];
        if (face !== undefined)
            return face;
    }
    const base = layout.base[code] ?? us[code] ?? '';
    if (!level.shift)
        return base;
    const shift = layout.shift?.[code];
    if (shift !== undefined)
        return shift;
    const upper = base.toUpperCase();
    return upper !== base ? upper : base;
}

/**
 * The US-layout glyph at a key position: what a composed key forwards to the input
 * method. A CJK engine maps from the US position (ko jamo on the cap, ja/zh
 * romaji/pinyin).
 * @param {number} code
 * @param {boolean} shift
 * @returns {string}
 */
export function position(code, shift) {
    return glyphFor('us', code, {shift});
}
