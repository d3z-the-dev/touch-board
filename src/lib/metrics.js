const Ratio = Object.freeze({ROW: 3.3});

const Font = Object.freeze({MIN: 11, MAX: 28});

const Fit = Object.freeze({UNIT_RATIO: 1.45, FLOOR: 7});

const PAD = 1.9;

export const BASE_FONT = 17;

const Metric = Object.freeze({
    PAD_WIDE: 0.8,
    PAD_TIGHT: 0.5,
    PAD_BOTTOM_WIDE: 0.95,
    PAD_BOTTOM_TIGHT: 0.6,
    MARGIN_WIDE: 0.3,
    MARGIN_TIGHT: 0.14,
});

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * @param {number} raw
 * @returns {number}
 */
export function percentScale(raw) {
    return raw / 100;
}

/**
 * @param {{monitorWidth: number, monitorHeight: number, percent: number, rows: number, total: number}} input
 * @returns {{fontSize: number, tight: boolean}}
 */
export function solveFontSize({monitorWidth, monitorHeight, percent, rows, total}) {
    const tight = monitorWidth < monitorHeight;
    const shortEdge = Math.min(monitorWidth, monitorHeight);
    const span = rows * Ratio.ROW + PAD;
    const available = shortEdge * percent / 100;
    const heightSize = clamp(Math.round(available / span), Font.MIN, Font.MAX);
    const padX = tight ? Metric.PAD_TIGHT : Metric.PAD_WIDE;
    const unit = (monitorWidth - 2 * padX * heightSize) / total;
    const widthSize = clamp(Math.floor(unit / Fit.UNIT_RATIO), Fit.FLOOR, Font.MAX);
    return {fontSize: Math.min(heightSize, widthSize), tight};
}

/**
 * @param {{monitorWidth: number, fontSize: number, tight: boolean, total: number, spacing: number, span: number}} input
 * @returns {number}
 */
export function innerWidth({monitorWidth, fontSize, tight, total, spacing, span}) {
    const pad = tight ? Metric.PAD_TIGHT : Metric.PAD_WIDE;
    const margin = (tight ? Metric.MARGIN_TIGHT : Metric.MARGIN_WIDE) * spacing;
    const unit = (monitorWidth - 2 * pad * fontSize) / total;
    return span * unit - 2 * margin * fontSize;
}

/**
 * @param {number} fontSize
 * @param {boolean} tight
 * @param {number} spacing
 * @returns {{height: number, gap: number}}
 */
export function rowMetrics(fontSize, tight, spacing) {
    const height = Math.round(fontSize * Ratio.ROW);
    const margin = tight ? Metric.MARGIN_TIGHT : Metric.MARGIN_WIDE;
    return {height, gap: Math.round(fontSize * margin * spacing)};
}

/**
 * @param {number} fontSize
 * @param {boolean} tight
 * @returns {{side: number, bottom: number}}
 */
export function trayPadding(fontSize, tight) {
    const side = Math.round(fontSize * (tight ? Metric.PAD_TIGHT : Metric.PAD_WIDE));
    const bottom = Math.round(fontSize * (tight ? Metric.PAD_BOTTOM_TIGHT : Metric.PAD_BOTTOM_WIDE));
    return {side, bottom};
}
