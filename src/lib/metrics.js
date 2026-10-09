const Ratio = Object.freeze({ROW: 3.3});

const Font = Object.freeze({MIN: 11, MAX: 28});

const Fit = Object.freeze({UNIT_RATIO: 1.45, FLOOR: 7});

const Metric = Object.freeze({
    PAD_WIDE: 0.8,
    PAD_TIGHT: 0.5,
    PAD_BOTTOM_WIDE: 0.95,
    PAD_BOTTOM_TIGHT: 0.6,
    MARGIN_WIDE: 0.3,
    MARGIN_TIGHT: 0.14,
});

export const Split = Object.freeze({REACH: 0.4, PORTRAIT: 0.54});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function percentScale(raw) {
    return raw / 100;
}

export function solveFontSize({monitorWidth, monitorHeight, percent, rows, total, widest}) {
    const tight = monitorWidth < monitorHeight;
    const available = Math.min(monitorWidth, monitorHeight) * percent / 100;
    const tray = tight ? Metric.PAD_TIGHT + Metric.PAD_BOTTOM_TIGHT : Metric.PAD_WIDE + Metric.PAD_BOTTOM_WIDE;
    const estimate = Math.floor(available / (rows * Ratio.ROW + tray));
    const miss = size => Math.abs(trayHeight(size, rows, tight) - available);
    const nearest = [estimate - 1, estimate + 1].reduce((best, size) => (miss(size) < miss(best) ? size : best), estimate);
    const heightSize = clamp(nearest, Font.MIN, Font.MAX);
    const unit = unitWidth({monitorWidth, fontSize: heightSize, tight, total, widest});
    const widthSize = clamp(Math.floor(unit / Fit.UNIT_RATIO), Fit.FLOOR, Font.MAX);
    return {fontSize: Math.min(heightSize, widthSize), tight};
}

function trayHeight(fontSize, rows, tight) {
    const {side, bottom} = trayPadding(fontSize, tight);
    return rows * Math.round(fontSize * Ratio.ROW) + side + bottom;
}

export function unitWidth({monitorWidth, fontSize, tight, total, widest}) {
    const pad = (tight ? Metric.PAD_TIGHT : Metric.PAD_WIDE) * fontSize;
    if (widest)
        return (monitorWidth * (tight ? Split.PORTRAIT : Split.REACH) - pad) / widest;
    return (monitorWidth - 2 * pad) / total;
}

export function innerWidth({monitorWidth, fontSize, tight, total, widest, spacing, span}) {
    const margin = (tight ? Metric.MARGIN_TIGHT : Metric.MARGIN_WIDE) * spacing;
    return span * unitWidth({monitorWidth, fontSize, tight, total, widest}) - 2 * margin * fontSize;
}

export function rowMetrics(fontSize, tight, spacing) {
    const height = Math.round(fontSize * Ratio.ROW);
    const margin = tight ? Metric.MARGIN_TIGHT : Metric.MARGIN_WIDE;
    return {height, gap: Math.round(fontSize * margin * spacing)};
}

export function trayPadding(fontSize, tight) {
    const side = Math.round(fontSize * (tight ? Metric.PAD_TIGHT : Metric.PAD_WIDE));
    const bottom = Math.round(fontSize * (tight ? Metric.PAD_BOTTOM_TIGHT : Metric.PAD_BOTTOM_WIDE));
    return {side, bottom};
}
