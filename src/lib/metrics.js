// Pure keyboard geometry: takes the monitor size and three settings:
// height, spacing, and glyph-size. Returns a root font-size, per-row metrics,
// label-fit budgets and tray padding. No GObject or settings access;
// the caller reads the settings and passes plain numbers.

// Row height as a multiple of the root font-size, so one metric scales the keyboard.
const Ratio = Object.freeze({ROW: 3.3});

// Root font-size clamp (px); guards a degenerate display when solving from height.
const Font = Object.freeze({MIN: 11, MAX: 28});

// Horizontal compression for a wide profile (full) on a narrow display.
// UNIT_RATIO: largest key-height-to-unit-width ratio tolerated;
// when exceeded, the font-size is capped so the block fits the width.
// FLOOR: lower bound the width cap may reach (below Font.MIN),
// so the full layout compresses whole rather than clipping its numpad.
const Fit = Object.freeze({UNIT_RATIO: 1.45, FLOOR: 7});

// Em padding above and below the row stack, folded into the height solve.
const PAD = 1.9;

// Fallback root font-size (px) before the first fit runs.
export const BASE_FONT = 17;

// Stylesheet em-metrics mirrored in JS for two uses:
// a fit can predict a tile's inner width without a style read,
// and tray padding can be pinned in px against the glyph-size scale.
// PAD top/side, PAD_BOTTOM the deeper bottom, MARGIN the inter-key gutter.
// Sync with stylesheet.css.
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
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// A clamped integer percent setting as a unit fraction (1 = 100%).
/**
 * @param {number} raw
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function percentScale(raw, min, max) {
    return clamp(raw, min, max) / 100;
}

// Solve the root font-size from the display.
// The height percent of the short screen edge (not monitor.height) sets the size,
// so one physical key size holds in both orientations and a rotation only re-flows width.
// A portrait aspect flags `tight` for the stylesheet's trimmed gutters.
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
    // Horizontal guard: a wide profile on a narrow display draws keys taller than a grid unit.
    // Cap the font-size when the block overruns the edge;
    // compress to Fit.FLOOR rather than clip.
    const padX = tight ? Metric.PAD_TIGHT : Metric.PAD_WIDE;
    const unit = (monitorWidth - 2 * padX * heightSize) / total;
    const widthSize = clamp(Math.floor(unit / Fit.UNIT_RATIO), Fit.FLOOR, Font.MAX);
    return {fontSize: Math.min(heightSize, widthSize), tight};
}

// Inner width available for a label: the key's span in units, less the em gutters.
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

// Per-row pixel height and inter-key gap from the root font-size.
// The gap rides the spacing scale (not an em), so keys of different font-sizes still align.
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

// Tray padding in px pinned to the unscaled fit size,
// so the glyph-size scale moves the text without resizing the board:
// a square side inset and a deeper bottom.
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
