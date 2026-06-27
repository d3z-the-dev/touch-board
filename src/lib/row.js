import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

const Style = Object.freeze({ROW: 'touch-board-row'});

// A row distributing its children by relative span; a shared total aligns all rows.
export const Row = GObject.registerClass(
class Row extends St.Widget {
    /** @param {number} total */
    _init(total) {
        super._init({style_class: Style.ROW, x_expand: true});
        this._total = total;
        this._height = 0;
        this._gap = 0;
        /** @type {number[]} */
        this._spans = [];
        /** @type {number[]} */
        this._rowspans = [];
    }

    /**
     * @param {number} height
     * @param {number} gap
     */
    setMetrics(height, gap) {
        this._height = height;
        this._gap = gap;
        this.queue_relayout();
    }

    /**
     * @param {Clutter.Actor} actor
     * @param {number} span
     * @param {number} [rows]
     */
    append(actor, span, rows = 1) {
        const spans = /** @type {number[]} */ (this._spans);
        const rowspans = /** @type {number[]} */ (this._rowspans);
        spans.push(span);
        rowspans.push(rows);
        this.add_child(actor);
    }

    /**
     * @param {number} _forWidth
     * @returns {[number, number]}
     */
    vfunc_get_preferred_height(_forWidth) {
        const height = /** @type {number} */ (this._height);
        if (height > 0)
            return [height, height];
        let min = 0;
        let nat = 0;
        for (const child of this.get_children()) {
            const [childMin, childNat] = child.get_preferred_height(-1);
            min = Math.max(min, childMin);
            nat = Math.max(nat, childNat);
        }
        return [min, nat];
    }

    /** @param {Clutter.ActorBox} box */
    vfunc_allocate(box) {
        const total = /** @type {number} */ (this._total);
        const spans = /** @type {number[]} */ (this._spans);
        const rowspans = /** @type {number[]} */ (this._rowspans);
        const gap = /** @type {number} */ (this._gap);
        this.set_allocation(box);
        const width = box.x2 - box.x1;
        const height = box.y2 - box.y1;
        const unit = width / total;
        const children = this.get_children();
        let offset = 0;
        // Inset every tile by the same pixel gap (not an em).
        // Keys of different font-sizes still align; a rowspan > 1 spans rows * height - gap,
        // over transparent spacer cells, so the tall key shows and stays touchable.
        for (let index = 0; index < children.length; index++) {
            const next = offset + unit * spans[index];
            const x1 = Math.round(offset) + gap;
            const x2 = Math.round(next) - gap;
            const bottom = rowspans[index] * height - gap;
            const slot = new Clutter.ActorBox({
                x1,
                y1: gap,
                x2: Math.max(x1, x2),
                y2: Math.max(gap, bottom),
            });
            children[index].allocate(slot);
            offset = next;
        }
    }
});
