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

const Keysym = Object.freeze({UNICODE: 0x01000000});

export function accentsFor(face) {
    if (!face)
        return null;
    const base = face.toLowerCase();
    const variants = Variants[base];
    if (!variants)
        return null;
    const upper = face !== base;
    const accents = [];
    for (const character of variants) {
        let glyph = upper ? character.toUpperCase() : character;
        if ([...glyph].length !== 1)
            glyph = character;
        accents.push({label: glyph, keyval: Keysym.UNICODE | glyph.codePointAt(0)});
    }
    return accents;
}
