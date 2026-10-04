import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Code, Kind} from './codes.js';
import {profiles} from './geometry.js';
import {glyphFor, supports, cjk} from './labels.js';
import {accentsFor} from './accents.js';
import {Key, Case, Corner, Look, Default, functionFor, mediaFor} from './settings.js';
import {accentStyle} from './palette.js';
import {percentScale, solveFontSize, innerWidth, rowMetrics, trayPadding} from './metrics.js';
import {Row} from './row.js';
import {track} from './tracker.js';
import {Chooser} from './chooser.js';
import {Composer} from './composer.js';
import {Modifiers} from './modifiers.js';
import {FnLayer} from './fnlayer.js';

const Style = Object.freeze({
    KEYBOARD: 'touch-board',
    KEY: 'touch-board-key',
    MODIFIER: 'touch-board-modifier',
    FUNCTION: 'touch-board-function',
    GLYPH: 'touch-board-glyph',
    COMPACT: 'touch-board-compact',
    SHARP: 'touch-board-sharp',
    ROUND: 'touch-board-round',
    FLAT: 'touch-board-flat',
    LIGHT: 'touch-board-light',
    CLASSIC: 'touch-board-classic',
});

const Pseudo = Object.freeze({PRESSED: 'pressed', LATCHED: 'latched', LOCKED: 'locked'});

const Signal = Object.freeze({
    STATE_CHANGED: 'state-changed',
    SHOW: 'show',
    MAPPED: 'notify::mapped',
    DESTROY: 'destroy',
    DISMISS: 'dismiss',
    SCHEME: 'notify::color-scheme',
});

const Hold = Object.freeze({DELAY: 360});

const Repeat = Object.freeze({DELAY: 400, INTERVAL: 40, FLOOR: 20});

const Single = Object.freeze({
    CODES: new Set([Code.PRINT, Code.PAUSE, Code.SCROLLLOCK, Code.MUTE, Code.MICMUTE, Code.PLAYPAUSE]),
});

const Peripheral = Object.freeze({
    SCHEMA: 'org.gnome.desktop.peripherals.keyboard',
    REPEAT: 'repeat',
    DELAY: 'delay',
    INTERVAL: 'repeat-interval',
});

const Family = Object.freeze({UNSAFE: /[^\p{L}\p{N} ._-]/gu});

const Fallback = Object.freeze({LAYOUT: 'us'});

const Label = Object.freeze({FKEY: /^F([1-9]|1[0-2])$/, WORD: /\w\S*/g});

const Tone = Object.freeze({
    DARK: new Set([Code.GRAVE, Code.BACKSLASH, Code.SLASH]),
    LIGHT: new Set([
        Code.SPACE, Code.UP, Code.DOWN, Code.LEFT, Code.RIGHT,
        Code.KPSLASH, Code.KPASTERISK, Code.KPMINUS, Code.KPPLUS, Code.KPENTER,
    ]),
});

export const Keyboard = GObject.registerClass({
    Signals: {[Signal.DISMISS]: {}},
},
class Keyboard extends St.BoxLayout {
    _init(injector, language, settings, player) {
        super._init({
            style_class: Style.KEYBOARD,
            layout_manager: new Clutter.BoxLayout({orientation: Clutter.Orientation.VERTICAL}),
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            reactive: true,
        });
        this._injector = injector;
        this._language = language;
        this._settings = settings;
        this._player = player;
        this._pads = [];
        this._numKey = null;
        this._numeric = true;
        this._glyphs = [];
        this._fkeys = [];
        this._statics = [];
        this._faces = [];
        this._tracked = [];
        this._connections = [];
        this._fontSize = 0;
        this._tight = false;
        this._total = 0;
        this._rows = [];
        this._capsKey = null;
        this._overrides = {};
        this._family = this.get_pango_context().get_font_map().get_family(Default.FAMILY) ? Default.FAMILY : '';
        const chooser = new Chooser({
            injector,
            track: (button, onDown, onUp) => this._track(button, onDown, onUp),
            pressed: Pseudo.PRESSED,
            look: () => [Style.CLASSIC, Style.LIGHT, Style.SHARP, Style.ROUND].filter(name => this.has_style_class_name(name)),
        });
        this._chooser = chooser;
        const fnLayer = new FnLayer({
            settings,
            track: (button, onDown, onUp) => this._track(button, onDown, onUp),
            tint: (button, locked) => this._tint(button, locked),
            untint: button => this._untint(button),
            repaint: () => this._fnRepaint(),
        });
        this._fnLayer = fnLayer;
        const modifiers = new Modifiers({
            settings,
            injector,
            track: (button, onDown, onUp) => this._track(button, onDown, onUp),
            tint: (button, locked) => this._tint(button, locked),
            untint: button => this._untint(button),
            close: () => chooser.close(),
            after: inject => chooser.after(inject),
            paint: () => this._paint(),
            fnShot: () => fnLayer.shot(),
            clearFn: () => fnLayer.off(),
        });
        this._modifiers = modifiers;
        this._composer = new Composer({
            language,
            injector,
            shifted: () => modifiers.shifted(),
            shortcutFree: () => modifiers.shortcutFree(),
            tap: code => modifiers.tap(code),
            consume: () => modifiers.consume(),
            close: () => chooser.close(),
        });
        this._repeat = new Gio.Settings({schema_id: Peripheral.SCHEMA});
        this._keymap = Clutter.get_default_backend().get_default_seat().get_keymap();

        this._build();
        this._connect(settings, `changed::${Key.FKEYS}`, () => {
            this._applyFunctions();
            this._paint();
        });
        this._connect(settings, `changed::${Key.FONT}`, () => this._fit());
        this._connect(settings, `changed::${Key.COLOR}`, () => this._applyColor());
        this._connect(settings, `changed::${Key.CASE}`, () => this._applyCase());
        this._connect(this._keymap, Signal.STATE_CHANGED, () => this._syncCaps());
        this._connect(settings, `changed::${Key.HEIGHT}`, () => this._fit());
        this._connect(settings, `changed::${Key.SPACING}`, () => this._fit());
        this._connect(settings, `changed::${Key.GLYPH_SIZE}`, () => this._fit());
        this._connect(settings, `changed::${Key.CORNER}`, () => this._applyShape());
        this._connect(settings, `changed::${Key.ROUNDED}`, () => this._applyShape());
        this._connect(settings, `changed::${Key.LOOK}`, () => this._applyLook());
        this._connect(St.Settings.get(), Signal.SCHEME, () => this._applyLook());
        this._connect(settings, `changed::${Key.LAYOUT}`, () => this._rebuild());
        this._connect(this, Signal.SHOW, () => this._fit());
        this._connect(this, Signal.MAPPED, () => {
            if (this.mapped)
                this._restyle();
        });
        this._applyLabels();
        this._applyShape();
        this._applyLook();
        this._syncCaps();
        this._languageId = language.connect(() => this._relabel());
        this._relabel();
    }

    _connect(source, signal, callback) {
        const id = source.connect(signal, callback);
        this._connections.push({source, id});
        return id;
    }

    _profile() {
        return profiles[this._settings.get_string(Key.LAYOUT)];
    }

    _build() {
        const definition = this._profile();
        const total = Math.max(...definition.map(line => line.reduce((sum, spec) => sum + spec.span, 0)));
        this._total = total;
        for (const line of definition) {
            const row = new Row(total);
            for (const spec of line)
                row.append(spec.kind === Kind.SPACER ? new St.Widget() : this._makeKey(spec), spec.span, spec.rows ?? 1);
            this.add_child(row);
            this._rows.push(row);
        }
        this._paintNum();
    }

    _rebuild() {
        this._chooser.close();
        for (const row of this._rows)
            row.destroy();
        this._rows = [];
        this._glyphs = [];
        this._fkeys = [];
        this._statics = [];
        this._faces = [];
        this._pads = [];
        this._numKey = null;
        this._tracked = [];
        this._modifiers.clear();
        this._fnLayer.clear();
        this._capsKey = null;
        this._build();
        this._applyLabels();
        this._fit();
        this._syncCaps();
        this._relabel();
    }

    _spacing() {
        return percentScale(this._settings.get_int(Key.SPACING));
    }

    _glyphScale() {
        return percentScale(this._settings.get_int(Key.GLYPH_SIZE));
    }

    _applyMetrics() {
        const {height, gap} = rowMetrics(this._fontSize, this._tight, this._spacing());
        for (const row of this._rows)
            row.setMetrics(height, gap);
    }

    _applyFaces() {
        if (!this.get_stage())
            return;
        const active = this._fnLayer.active();
        for (const face of this._faces)
            this._applyFace(face, active);
    }

    _applyFace(face, active) {
        if (face.fn)
            this._fnScale(face.button, active, false);
        const next = active && face.fn
            ? this._fitFace(face.button, face.fn.face, face.fn.symbol, face.span)
            : this._fitFace(face.button, face.word, face.symbol, face.span);
        if (face.button.label !== next)
            face.button.set_label(next);
    }

    _refit(button) {
        const face = this._faces.find(entry => entry.button === button);
        if (face && this.get_stage())
            this._applyFace(face, this._fnLayer.active());
    }

    _inner(span) {
        const monitor = Main.layoutManager.keyboardMonitor;
        if (!monitor)
            return 0;
        return innerWidth({
            monitorWidth: monitor.width,
            fontSize: this._fontSize,
            tight: this._tight,
            total: this._total,
            spacing: this._spacing(),
            span,
        });
    }

    _fits(button, word, inner) {
        button.ensure_style();
        const text = button.get_child();
        const layout = text.create_pango_layout(word);
        layout.set_font_description(Pango.FontDescription.from_string(text.get_font_name()));
        const [, logical] = layout.get_extents();
        const [, natural] = button.get_theme_node().adjust_preferred_width(0, Math.ceil((logical.x + logical.width) / Pango.SCALE));
        return natural <= inner;
    }

    _fitFace(button, word, symbol, span) {
        const face = this._transform(word);
        if (symbol === undefined || !this.get_stage())
            return face;
        return this._fits(button, face, this._inner(span)) ? face : symbol;
    }

    _fit() {
        const monitor = Main.layoutManager.keyboardMonitor;
        if (!monitor)
            return;
        const {fontSize, tight} = solveFontSize({
            monitorWidth: monitor.width,
            monitorHeight: monitor.height,
            percent: this._settings.get_int(Key.HEIGHT),
            rows: this._rows.length,
            total: this._total,
        });
        this._fontSize = fontSize;
        this._tight = tight;
        this.set_width(monitor.width);
        this._applyStyle();
        this._applyMetrics();
        this._applyFaces();
        this._applyFunctions();
        this._applyPads();
    }

    refit() {
        this._fit();
    }

    _applyShape() {
        const settings = this._settings;
        const corner = settings.get_string(Key.CORNER);
        this._setClass(Style.SHARP, corner === Corner.SHARP);
        this._setClass(Style.ROUND, corner === Corner.ROUND);
        this._setClass(Style.FLAT, !settings.get_boolean(Key.ROUNDED));
    }

    _classic() {
        return this._settings.get_string(Key.LOOK) === Look.CLASSIC;
    }

    _light() {
        return !this._classic() && St.Settings.get().color_scheme === St.SystemColorScheme.PREFER_LIGHT;
    }

    _applyLook() {
        this._setClass(Style.CLASSIC, this._classic());
        this._setClass(Style.LIGHT, this._light());
        this._applyColor();
        this._fit();
    }

    _setClass(name, on) {
        if (on)
            this.add_style_class_name(name);
        else
            this.remove_style_class_name(name);
    }

    _restyle() {
        this.style_changed();
        const settle = actor => {
            if (actor instanceof St.Widget)
                actor.ensure_style();
            for (const child of actor.get_children())
                settle(child);
        };
        settle(this);
        this.queue_redraw();
    }

    _makeKey(spec) {
        const modifiers = this._modifiers;
        const button = new St.Button({
            style_class: this._styleFor(spec),
            can_focus: false,
            x_expand: true,
            y_expand: true,
        });
        button._spec = spec;

        if (spec.pad) {
            const entry = {button, numeric: spec.pad.numeric, nav: spec.pad.nav, span: spec.span};
            this._pads.push(entry);
            button.set_label(this._numeric ? entry.numeric.face : entry.nav.symbol);
            this._wirePad(button, entry);
            return button;
        }

        if (spec.glyph) {
            button.set_label('');
            this._glyphs.push(button);
        } else if (spec.symbol) {
            button.set_label('');
            this._faces.push({button, word: spec.label ?? '', symbol: spec.symbol, span: spec.span, fn: spec.fn});
        } else {
            const label = spec.label ?? '';
            if (label && !spec.fslot) {
                this._statics.push({button, base: label});
                button.set_label(this._transform(label));
            } else {
                button.set_label(label);
            }
        }

        if (spec.kind === Kind.MODIFIER) {
            this._tracked.push(modifiers.wire(spec.code, button));
        } else if (spec.kind === Kind.NUM) {
            this._numKey = button;
            this._tracked.push(this._track(button, () => {}, () => this._toggleNum()));
        } else if (spec.kind === Kind.FN) {
            this._tracked.push(this._fnLayer.wire(button));
        } else if (spec.fslot) {
            const entry = {slot: spec.fslot, button, base: spec.code, label: spec.label, code: spec.code, span: spec.span, override: false};
            this._fkeys.push(entry);
            this._tracked.push(this._track(button, () => modifiers.tap(this._functionCode(entry)), () => {}));
        } else if (spec.kind === Kind.KEY) {
            this._wireKey(spec, button);
        } else if (spec.kind === Kind.HIDE) {
            this._tracked.push(this._track(button, () => {}, () => this.emit(Signal.DISMISS)));
        } else {
            if (spec.code === Code.CAPS)
                this._capsKey = button;
            this._tracked.push(this._track(button, () => this._lock(spec.code), () => {}));
        }
        return button;
    }

    _applyFunctions() {
        this._overrides = this._settings.get_value(Key.FKEYS).deep_unpack();
        const active = this._fnLayer.active();
        for (const entry of this._fkeys) {
            const assigned = this._assigned(entry.slot);
            entry.override = assigned !== undefined;
            entry.code = assigned ? assigned.code : entry.base;
            const media = active ? mediaFor(entry.slot) : undefined;
            const source = assigned ?? media;
            const face = source
                ? this._fitFace(entry.button, source.face, source.symbol, entry.span)
                : this._transform(entry.label);
            if (entry.button.label !== face)
                entry.button.set_label(face);
        }
    }

    _assigned(slot) {
        const id = this._overrides[slot];
        return id ? functionFor(id) : undefined;
    }

    _fnCode(fn) {
        const assigned = fn.slot ? this._assigned(fn.slot) : undefined;
        return assigned ? assigned.code : fn.code;
    }

    _fnFace(button, fn, span) {
        const assigned = fn.slot ? this._assigned(fn.slot) : undefined;
        return assigned
            ? this._fitFace(button, assigned.face, assigned.symbol, span)
            : this._fitFace(button, fn.face, fn.symbol, span);
    }

    _functionCode(entry) {
        if (entry.override)
            return entry.code;
        if (this._fnLayer.active())
            return mediaFor(entry.slot)?.code ?? entry.code;
        return entry.code;
    }

    _track(button, onDown, onUp, onMove, onCancel) {
        return track(button, {onDown, onUp, onMove, onCancel, click: () => this._click(), pseudo: Pseudo.PRESSED});
    }

    _fnRepaint() {
        this._paint();
        this._applyFaces();
        this._applyFunctions();
        this.queue_redraw();
    }

    _wireKey(spec, button) {
        const code = spec.code;
        const chooser = this._chooser;
        const composer = this._composer;
        const modifiers = this._modifiers;
        const fnLayer = this._fnLayer;
        let hold = 0;
        let opened = false;
        let active = code;
        let accents = null;
        let fire = () => modifiers.tap(active);
        const repeat = this._repeater(() => fire());

        const stopHold = () => {
            if (hold) {
                GLib.source_remove(hold);
                hold = 0;
            }
        };
        const stop = () => {
            stopHold();
            repeat.stop();
        };

        const down = () => {
            opened = false;
            stop();
            active = fnLayer.active() && spec.fn ? this._fnCode(spec.fn) : code;
            const compose = spec.glyph && !fnLayer.active() && composer.composes();
            const stub = spec.glyph && !fnLayer.active() && !compose && composer.stub();
            accents = spec.glyph && !fnLayer.active() && !compose && !stub && modifiers.shortcutFree() && this._settings.get_boolean(Key.ACCENTS)
                ? accentsFor(this._faceOf(code))
                : null;
            if (compose)
                fire = () => composer.compose(code);
            else if (stub)
                fire = () => composer.stubKey(code);
            else
                fire = () => modifiers.tap(active);
            fire();
            if (accents) {
                hold = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Hold.DELAY, () => {
                    hold = 0;
                    opened = true;
                    chooser.open(button, accents);
                    return GLib.SOURCE_REMOVE;
                });
            } else if (!compose && !Single.CODES.has(active)) {
                repeat.start();
            }
        };

        const move = (x, y) => {
            if (opened)
                chooser.focus(button, x, y);
        };

        const up = (x, y) => {
            stop();
            if (opened)
                chooser.selectAt(button, x, y);
        };

        this._tracked.push(this._track(button, down, up, move, stop));
        button.connect(Signal.DESTROY, stop);
    }

    _wirePad(button, entry) {
        const modifiers = this._modifiers;
        const fire = () => {
            const code = this._numeric ? entry.numeric.code : entry.nav.code;
            if (code !== undefined)
                modifiers.tap(code);
        };
        const repeat = this._repeater(fire);

        const down = () => {
            repeat.stop();
            fire();
            repeat.start();
        };

        this._tracked.push(this._track(button, down, () => repeat.stop(), undefined, () => repeat.stop()));
        button.connect(Signal.DESTROY, () => repeat.stop());
    }

    _repeater(fire) {
        let hold = 0;
        let interval = 0;
        const stop = () => {
            if (hold) {
                GLib.source_remove(hold);
                hold = 0;
            }
            if (interval) {
                GLib.source_remove(interval);
                interval = 0;
            }
        };
        const start = () => {
            if (!this._repeat.get_boolean(Peripheral.REPEAT))
                return;
            hold = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._repeatDelay(), () => {
                hold = 0;
                interval = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._repeatInterval(), () => {
                    fire();
                    return GLib.SOURCE_CONTINUE;
                });
                return GLib.SOURCE_REMOVE;
            });
        };
        return {start, stop};
    }

    _repeatDelay() {
        const value = this._repeat.get_uint(Peripheral.DELAY);
        return value > 0 ? value : Repeat.DELAY;
    }

    _repeatInterval() {
        const value = this._repeat.get_uint(Peripheral.INTERVAL);
        return Math.max(value > 0 ? value : Repeat.INTERVAL, Repeat.FLOOR);
    }

    _faceId() {
        const language = this._language;
        const id = language.currentId();
        return !language.composing() && cjk(id) ? Fallback.LAYOUT : id;
    }

    _faceOf(code) {
        return glyphFor(this._faceId(), code, {shift: this._modifiers.shifted(), altgr: this._modifiers.altgr()});
    }

    _syncCaps() {
        const caps = this._capsKey;
        if (!caps)
            return;
        if (this._keymap.get_caps_lock_state())
            this._tint(caps, true);
        else
            this._untint(caps);
    }

    _toggleNum() {
        this._numeric = !this._numeric;
        this._applyPads();
        this._paintNum();
    }

    _applyPads() {
        if (!this.get_stage())
            return;
        for (const entry of this._pads) {
            const next = this._numeric
                ? entry.numeric.face
                : this._fitFace(entry.button, entry.nav.word, entry.nav.symbol, entry.span);
            if (entry.button.label !== next)
                entry.button.set_label(next);
        }
    }

    _paintNum() {
        const num = this._numKey;
        if (!num)
            return;
        if (this._numeric)
            this._untint(num);
        else
            this._tint(num, true);
    }

    _applyStyle() {
        const family = this._settings.get_string(Key.FONT).replace(Family.UNSAFE, '').trim() || this._family;
        const geom = this._fontSize;
        const size = Math.round(geom * this._glyphScale());
        const {side, bottom} = trayPadding(geom, this._tight);
        const face = family ? `font-family: "${family}"; ` : '';
        this.set_style(`${face}font-size: ${size}px; padding: ${side}px ${side}px ${bottom}px ${side}px;`);
    }

    _styleFor(spec) {
        let style = Style.KEY;
        if (!spec.light && (spec.kind === Kind.MODIFIER || spec.kind === Kind.NUM || spec.kind === Kind.FN))
            style += ` ${Style.MODIFIER}`;
        if (spec.glyph)
            style += ` ${Style.GLYPH}`;
        if (spec.compact)
            style += ` ${Style.COMPACT}`;
        if (!this._isLight(spec))
            style += ` ${Style.FUNCTION}`;
        return style;
    }

    _isLight(spec) {
        if (spec.light)
            return true;
        const code = spec.code;
        if (code !== undefined && Tone.DARK.has(code))
            return false;
        if (spec.kind === Kind.PAD)
            return true;
        if (spec.glyph)
            return true;
        return code !== undefined && Tone.LIGHT.has(code);
    }

    _lock(code) {
        this._chooser.close();
        this._injector.tap(code);
    }

    _click() {
        this._player.click();
    }

    reset() {
        this._chooser.close();
        for (const cancel of this._tracked)
            cancel();
        this._modifiers.clearAll();
        this._fnLayer.off();
        this._paint();
    }

    _tint(button, locked) {
        const look = {light: this._light(), classic: this._classic()};
        button.set_style(accentStyle(this._settings.get_string(Key.COLOR), locked, look));
        if (locked) {
            button.remove_style_pseudo_class(Pseudo.LATCHED);
            button.add_style_pseudo_class(Pseudo.LOCKED);
        } else {
            button.remove_style_pseudo_class(Pseudo.LOCKED);
            button.add_style_pseudo_class(Pseudo.LATCHED);
        }
        this._refit(button);
    }

    _untint(button) {
        button.set_style(null);
        button.remove_style_pseudo_class(Pseudo.LATCHED);
        button.remove_style_pseudo_class(Pseudo.LOCKED);
        this._refit(button);
    }

    owns(actor) {
        return this._chooser.owns(actor);
    }

    _applyColor() {
        this._modifiers.tintAll();
        this._syncCaps();
        this._paintNum();
        this._fnLayer.tint();
    }

    _applyCase() {
        this._applyLabels();
        this._applyFaces();
        this._applyPads();
        this._paint();
    }

    _applyLabels() {
        for (const {button, base} of this._statics) {
            const face = this._transform(base);
            if (button.label !== face)
                button.set_label(face);
        }
        this._applyFunctions();
    }

    _transform(text) {
        if (Label.FKEY.test(text))
            return text;
        const mode = this._settings.get_string(Key.CASE);
        if (mode === Case.UPPER)
            return text.toUpperCase();
        if (mode === Case.TITLE)
            return text.replace(Label.WORD, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
        return text.toLowerCase();
    }

    _relabel() {
        if (!supports(this._language.currentId()))
            console.error(`touch-board: unsupported layout "${this._language.currentId()}", falling back to us glyphs`);
        this._paint();
    }

    _paint() {
        const layoutId = this._faceId();
        const level = {shift: this._modifiers.shifted(), altgr: this._modifiers.altgr()};
        const active = this._fnLayer.active();
        let dirty = false;
        for (const button of this._glyphs) {
            const spec = button._spec;
            if (spec.fn)
                this._fnScale(button, active, true);
            const face = active && spec.fn
                ? this._fnFace(button, spec.fn, spec.span)
                : glyphFor(layoutId, spec.code, level);
            if (button.label !== face) {
                button.set_label(face);
                dirty = true;
            }
        }
        if (dirty)
            this.queue_redraw();
    }

    _fnScale(button, fn, glyph) {
        if (fn) {
            if (glyph)
                button.remove_style_class_name(Style.GLYPH);
            button.add_style_class_name(Style.COMPACT);
        } else {
            button.remove_style_class_name(Style.COMPACT);
            if (glyph)
                button.add_style_class_name(Style.GLYPH);
        }
    }

    release() {
        for (const {source, id} of this._connections)
            source.disconnect(id);
        this._connections = [];
        this._language.disconnect(this._languageId);
        this._chooser.destroy();
        for (const cancel of this._tracked)
            cancel();
    }
});
