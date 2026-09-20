import {Default} from './settings.js';

const Shade = Object.freeze({LOCK: 0.32, DARKEN: 0.16});

const Ink = Object.freeze({WHITE: [255, 255, 255], BLACK: [0, 0, 0]});

function rgb(hex) {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    const value = match ? parseInt(match[1], 16) : parseInt(Default.COLOR.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(from, to, ratio) {
    return [0, 1, 2].map(index => Math.round(from[index] + (to[index] - from[index]) * ratio));
}

function gradient(fill) {
    const end = mix(fill, Ink.BLACK, Shade.DARKEN);
    return `background-gradient-direction: vertical;` +
        ` background-gradient-start: rgb(${fill[0]},${fill[1]},${fill[2]});` +
        ` background-gradient-end: rgb(${end[0]},${end[1]},${end[2]});` +
        ` border-color: rgb(${fill[0]},${fill[1]},${fill[2]}); color: #ffffff;`;
}

export function accentStyle(hex, locked) {
    const base = rgb(hex);
    const fill = locked ? mix(base, Ink.WHITE, Shade.LOCK) : base;
    return gradient(fill);
}
