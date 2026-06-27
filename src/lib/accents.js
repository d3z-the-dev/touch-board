// Long-press accent variants, looked up by the glyph a key shows; they fire
// only on Latin letters. Stored lowercase, upper-cased on demand when shifted.
const Variants = Object.freeze({
    a: 'àáâäãåāą',
    c: 'çćč¢',
    e: 'èéêëēę€',
    g: 'ğ',
    i: 'ìíîïī',
    l: 'ł£',
    n: 'ñń',
    o: 'òóôöõøō',
    s: 'śšş$',
    u: 'ùúûüū',
    y: 'ýÿ¥',
    z: 'žźż',
});

// Clutter takes a Unicode codepoint as keysym 0x01000000 | codepoint.
const UNICODE = 0x01000000;

/** @typedef {{label: string, keyval: number}} Accent */

/**
 * Variants for the glyph a key shows, or null. Case follows the face; a glyph
 * whose upper-case is multi-codepoint (ß becomes SS) stays as-is.
 * @param {string} face
 * @returns {Accent[] | null}
 */
export function accentsFor(face) {
    if (!face)
        return null;
    const base = face.toLowerCase();
    const variants = /** @type {Record<string, string>} */ (Variants)[base];
    if (!variants)
        return null;
    const upper = face !== base;
    /** @type {Accent[]} */
    const accents = [];
    for (const character of variants) {
        let glyph = upper ? character.toUpperCase() : character;
        if ([...glyph].length !== 1)
            glyph = character;
        accents.push({label: glyph, keyval: UNICODE | (glyph.codePointAt(0) ?? 0)});
    }
    return accents;
}
