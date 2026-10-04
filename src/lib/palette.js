const Hex = Object.freeze({PATTERN: /^#?([0-9a-fA-F]{6})$/});

const Ink = Object.freeze({WHITE: [255, 255, 255], BLACK: [0, 0, 0]});

const Shade = Object.freeze({DARK: 0.2, LIGHT: 0.1});

const Fill = Object.freeze({
    TEXT: 'color: #ffffff;',
    FLAT: 'background-gradient-direction: none;',
});

export function hex(value) {
    const match = Hex.PATTERN.exec(value.trim());
    return match ? `#${match[1].toLowerCase()}` : null;
}

function rgb(value) {
    const colour = hex(value);
    if (!colour)
        return null;
    const number = parseInt(colour.slice(1), 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function mix(from, to, ratio) {
    return [0, 1, 2].map(index => Math.round(from[index] + (to[index] - from[index]) * ratio));
}

function css([red, green, blue]) {
    return `rgb(${red},${green},${blue})`;
}

export function accentStyle(value, locked, {light, classic}) {
    const fill = rgb(value);
    if (!fill)
        return null;
    if (classic)
        return `${Fill.FLAT} background-color: ${css(fill)}; ${Fill.TEXT}`;
    if (locked)
        return `background-color: ${css(fill)}; ${Fill.TEXT}`;
    const text = light ? mix(fill, Ink.BLACK, Shade.LIGHT) : mix(fill, Ink.WHITE, Shade.DARK);
    return `border-color: ${css(fill)}; color: ${css(text)};`;
}
