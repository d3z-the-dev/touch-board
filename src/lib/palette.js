import {Default} from './settings.js';

// Builds the St inline gradient for an engaged modifier. A lock lifts the fill toward
// white so one-shot and lock read differently on a single colour. Pure; caller reads the setting.

// Mix ratios: a locked fill toward white, the gradient end toward black.
const Shade = Object.freeze({LOCK: 0.32, DARKEN: 0.16});

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/**
 * @param {string} hex
 * @returns {number[]}
 */
function rgb(hex) {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    const value = match ? parseInt(match[1], 16) : parseInt(Default.COLOR.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * @param {number[]} from
 * @param {number[]} to
 * @param {number} ratio
 * @returns {number[]}
 */
function mix(from, to, ratio) {
    return [0, 1, 2].map(index => Math.round(from[index] + (to[index] - from[index]) * ratio));
}

/**
 * @param {number[]} fill
 * @returns {string}
 */
function gradient(fill) {
    const end = mix(fill, BLACK, Shade.DARKEN);
    return `background-gradient-direction: vertical;` +
        ` background-gradient-start: rgb(${fill[0]},${fill[1]},${fill[2]});` +
        ` background-gradient-end: rgb(${end[0]},${end[1]},${end[2]});` +
        ` border-color: rgb(${fill[0]},${fill[1]},${fill[2]}); color: #ffffff;`;
}

/**
 * @param {string} hex
 * @param {boolean} locked
 * @returns {string}
 */
export function accentStyle(hex, locked) {
    const base = rgb(hex);
    const fill = locked ? mix(base, WHITE, Shade.LOCK) : base;
    return gradient(fill);
}
