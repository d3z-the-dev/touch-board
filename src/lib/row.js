import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

const Style = Object.freeze({ROW: 'touch-board-row'});

export const Row = GObject.registerClass(
class Row extends St.Widget {
    _init(total) {
        super._init({style_class: Style.ROW, x_expand: true});
        this._total = total;
        this._height = 0;
        this._gap = 0;
        this._spans = [];
        this._rowspans = [];
    }

    setMetrics(height, gap) {
        if (height === this._height && gap === this._gap)
            return;
        this._height = height;
        this._gap = gap;
        this.queue_relayout();
    }

    append(actor, span, rows = 1) {
        this._spans.push(span);
        this._rowspans.push(rows);
        this.add_child(actor);
    }

    vfunc_get_preferred_width() {
        return [0, 0];
    }

    vfunc_get_preferred_height(_forWidth) {
        const height = this._height;
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

    vfunc_allocate(box) {
        const {_total: total, _spans: spans, _rowspans: rowspans, _gap: gap} = this;
        this.set_allocation(box);
        const width = box.x2 - box.x1;
        const height = box.y2 - box.y1;
        const unit = width / total;
        const children = this.get_children();
        let offset = 0;
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
