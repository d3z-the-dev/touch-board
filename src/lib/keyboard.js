import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Code, Kind} from './codes.js';
import {profiles} from './geometry.js';
import {glyphFor, supports, cjk} from './labels.js';
import {accentsFor} from './accents.js';
import {Key, Case, Corner, functionFor, mediaFor} from './settings.js';
import {accentStyle} from './palette.js';
import {BASE_FONT, percentScale, solveFontSize, innerWidth, rowMetrics, trayPadding} from './metrics.js';
import {Row} from './row.js';
import {track} from './tracker.js';
import {Chooser} from './chooser.js';
import {Composer} from './composer.js';
import {Modifiers} from './modifiers.js';
import {FnLayer} from './fnlayer.js';

/** @typedef {import('./injector.js').Injector} Injector */
/** @typedef {import('./language.js').Language} Language */
/** @typedef {import('./player.js').Player} Player */
/** @typedef {import('gi://Gio').default.Settings} Settings */
/** @typedef {{source: GObject.Object, id: number}} Connection */

const Style = Object.freeze({
    KEYBOARD: 'touch-board',
    KEY: 'touch-board-key',
    MODIFIER: 'touch-board-modifier',
    FUNCTION: 'touch-board-function',
    GLYPH: 'touch-board-glyph',
    COMPACT: 'touch-board-compact',
    TIGHT: 'touch-board-tight',
    SHARP: 'touch-board-sharp',
    ROUND: 'touch-board-round',
    FLAT: 'touch-board-flat',
    ACTIVE: 'touch-board-active',
    LOCKED: 'touch-board-locked',
});

const Pseudo = Object.freeze({ACTIVE: 'active', RESTYLE: 'restyle'});

const Signal = Object.freeze({
    STATE_CHANGED: 'state-changed',
    SHOW: 'show',
    MAPPED: 'notify::mapped',
    CLICKED: 'clicked',
    DESTROY: 'destroy',
    DISMISS: 'dismiss',
});

const Hold = Object.freeze({DELAY: 360});

const Repeat = Object.freeze({DELAY: 400, INTERVAL: 40, FLOOR: 20});

const Peripheral = Object.freeze({
    SCHEMA: 'org.gnome.desktop.peripherals.keyboard',
    REPEAT: 'repeat',
    DELAY: 'delay',
    INTERVAL: 'repeat-interval',
});

const FALLBACK_HEAD = 'IBM Plex Sans';

/** @type {ReadonlySet<number>} */
const DARK_KEYS = new Set([Code.GRAVE, Code.BACKSLASH, Code.SLASH]);
/** @type {ReadonlySet<number>} */
const LIGHT_KEYS = new Set([
    Code.SPACE, Code.UP, Code.DOWN, Code.LEFT, Code.RIGHT,
    Code.KPSLASH, Code.KPASTERISK, Code.KPMINUS, Code.KPPLUS, Code.KPENTER,
]);

/** @typedef {St.Button & {_spec: import('./geometry.js').KeySpec}} KeyButton */

/** @typedef {{button: St.Button, numeric: import('./geometry.js').Face, nav: import('./geometry.js').NavFace, span: number}} PadKey */

/** @typedef {{button: St.Button, word: string, symbol: string, span: number, fn?: import('./geometry.js').FnFace}} FaceKey */

/** @typedef {{slot: string, button: St.Button, base: number, label: string, code: number, override: boolean}} FunctionKey */

export const Keyboard = GObject.registerClass({
    Signals: {[Signal.DISMISS]: {}},
},
class Keyboard extends St.BoxLayout {
    /**
     * @param {Injector} injector
     * @param {Language} language
     * @param {Settings} settings
     * @param {Player} player
     */
    _init(injector, language, settings, player) {
        super._init({
            style_class: Style.KEYBOARD,
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            reactive: true,
        });
        this._injector = injector;
        this._language = language;
        this._settings = settings;
        this._player = player;
        /** @type {PadKey[]} */
        this._pads = [];
        /** @type {St.Button | null} */
        this._numKey = null;
        this._numeric = true;
        /** @type {KeyButton[]} */
        this._glyphs = [];
        /** @type {FunctionKey[]} */
        this._fkeys = [];
        /** @type {{button: St.Button, base: string}[]} */
        this._statics = [];
        /** @type {FaceKey[]} */
        this._faces = [];
        /** @type {Set<number>} */
        this._timers = new Set();
        /** @type {(() => void)[]} */
        this._tracked = [];
        /** @type {Connection[]} */
        this._connections = [];
        /** @type {number} */
        this._fontSize = BASE_FONT;
        this._tight = false;
        this._total = 0;
        /** @type {InstanceType<typeof Row>[]} */
        this._rows = [];
        /** @type {St.Button | null} */
        this._capsKey = null;
        const chooser = new Chooser({
            injector,
            track: (button, onDown, onUp) => this._track(button, onDown, onUp),
            active: Pseudo.ACTIVE,
        });
        this._chooser = chooser;
        const fnLayer = new FnLayer({
            settings,
            track: (button, onDown, onUp) => this._track(button, onDown, onUp),
            tint: (button, locked) => this._tint(button, locked),
            repaint: () => this._fnRepaint(),
        });
        this._fnLayer = fnLayer;
        const modifiers = new Modifiers({
            settings,
            injector,
            track: (button, onDown, onUp) => this._track(button, onDown, onUp),
            tint: (button, locked) => this._tint(button, locked),
            close: () => chooser.close(),
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
        /** @type {Gio.Settings} */
        this._repeat = new Gio.Settings({schema_id: Peripheral.SCHEMA});
        /** @type {Clutter.Keymap} */
        this._keymap = Clutter.get_default_backend().get_default_seat().get_keymap();

        this._build();
        this._connect(settings, `changed::${Key.FKEYS}`, () => this._applyFunctions());
        this._connect(settings, `changed::${Key.FONT}`, () => this._applyStyle());
        this._connect(settings, `changed::${Key.COLOR}`, () => this._applyColor());
        this._connect(settings, `changed::${Key.CASE}`, () => this._applyCase());
        this._connect(this._keymap, Signal.STATE_CHANGED, () => this._syncCaps());
        this._connect(settings, `changed::${Key.HEIGHT}`, () => this._fit());
        this._connect(settings, `changed::${Key.SPACING}`, () => this._fit());
        this._connect(settings, `changed::${Key.GLYPH_SIZE}`, () => this._fit());
        this._connect(settings, `changed::${Key.CORNER}`, () => this._applyShape());
        this._connect(settings, `changed::${Key.ROUNDED}`, () => this._applyShape());
        this._connect(settings, `changed::${Key.LAYOUT}`, () => this._rebuild());
        this._connect(this, Signal.SHOW, () => this._fit());
        this._connect(this, Signal.MAPPED, () => {
            if (this.mapped)
                this._restyle();
        });
        this._applyCase();
        this._fit();
        this._applyShape();
        this._syncCaps();
        language.connect(() => this._relabel());
        this._relabel();
    }

    /**
     * @param {GObject.Object} source
     * @param {string} signal
     * @param {(...args: any[]) => void} callback
     * @returns {number}
     */
    _connect(source, signal, callback) {
        const id = source.connect(signal, callback);
        this._connections.push({source, id});
        return id;
    }

    /** @returns {import('./geometry.js').KeySpec[][]} */
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
        this._applyCase();
        this._fit();
        this._syncCaps();
        this._relabel();
    }

    /** @returns {number} */
    _spacing() {
        return percentScale(this._settings.get_int(Key.SPACING));
    }

    /** @returns {number} */
    _glyphScale() {
        return percentScale(this._settings.get_int(Key.GLYPH_SIZE));
    }

    _applyMetrics() {
        const {height, gap} = rowMetrics(this._fontSize, this._tight, this._spacing());
        for (const row of this._rows)
            row.setMetrics(height, gap);
    }

    _applyFaces() {
        if (!Main.layoutManager.primaryMonitor)
            return;
        const active = this._fnLayer.active();
        for (const face of this._faces) {
            if (face.fn)
                this._fnScale(face.button, active, false);
            const next = active && face.fn
                ? this._fitFace(face.button, face.fn.face, face.fn.symbol, face.span)
                : this._fitFace(face.button, face.word, face.symbol, face.span);
            if (face.button.label !== next)
                face.button.set_label(next);
        }
    }

    /**
     * @param {number} span
     * @returns {number}
     */
    _inner(span) {
        const monitor = Main.layoutManager.primaryMonitor;
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

    /**
     * @param {St.Button} button
     * @param {string} word
     * @param {number} inner
     * @returns {boolean}
     */
    _fits(button, word, inner) {
        const current = button.label;
        button.set_label(word);
        const [, natural] = button.get_preferred_width(-1);
        button.set_label(current);
        return natural <= inner;
    }

    /**
     * @param {St.Button} button
     * @param {string} word
     * @param {string | undefined} symbol
     * @param {number} span
     * @returns {string} The case-transformed word, or the symbol when the word will not fit.
     */
    _fitFace(button, word, symbol, span) {
        const face = this._transform(word);
        if (symbol === undefined)
            return face;
        return this._fits(button, face, this._inner(span)) ? face : symbol;
    }

    _fit() {
        const monitor = Main.layoutManager.primaryMonitor;
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
        if (this._tight)
            this.add_style_class_name(Style.TIGHT);
        else
            this.remove_style_class_name(Style.TIGHT);
        this._applyStyle();
        this._applyMetrics();
        this._applyFaces();
        this._applyPads();
    }

    refit() {
        this._fit();
    }

    _applyShape() {
        const settings = this._settings;
        const corner = settings.get_string(Key.CORNER);
        this.remove_style_class_name(Style.SHARP);
        this.remove_style_class_name(Style.ROUND);
        if (corner === Corner.SHARP)
            this.add_style_class_name(Style.SHARP);
        else if (corner === Corner.ROUND)
            this.add_style_class_name(Style.ROUND);
        if (settings.get_boolean(Key.ROUNDED))
            this.remove_style_class_name(Style.FLAT);
        else
            this.add_style_class_name(Style.FLAT);
    }

    _restyle() {
        this.add_style_pseudo_class(Pseudo.RESTYLE);
        this.remove_style_pseudo_class(Pseudo.RESTYLE);
        /** @param {Clutter.Actor} actor */
        const settle = actor => {
            if (actor instanceof St.Widget)
                actor.ensure_style();
            for (const child of actor.get_children())
                settle(child);
        };
        settle(this);
        this.queue_redraw();
    }

    /**
     * @param {import('./geometry.js').KeySpec} spec
     * @returns {St.Button}
     */
    _makeKey(spec) {
        const modifiers = this._modifiers;
        const button = /** @type {KeyButton} */ (new St.Button({
            style_class: this._styleFor(spec),
            can_focus: false,
            x_expand: true,
            y_expand: true,
        }));
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
            button.connect(Signal.CLICKED, () => {
                this._click();
                this._toggleNum();
            });
        } else if (spec.kind === Kind.FN) {
            this._tracked.push(this._fnLayer.wire(button));
        } else if (spec.fslot) {
            const entry = {slot: spec.fslot, button, base: spec.code, label: spec.label, code: spec.code, override: false};
            this._fkeys.push(entry);
            button.connect(Signal.CLICKED, () => {
                this._click();
                modifiers.tap(this._functionCode(entry));
            });
        } else if (spec.kind === Kind.KEY) {
            this._wireKey(spec, button);
        } else {
            if (spec.kind === Kind.LOCK && spec.code === Code.CAPS)
                this._capsKey = button;
            button.connect(Signal.CLICKED, () => this._activate(spec));
        }
        return button;
    }

    _applyFunctions() {
        const map = /** @type {Record<string, string>} */ (this._settings.get_value(Key.FKEYS).deep_unpack());
        const active = this._fnLayer.active();
        for (const entry of this._fkeys) {
            const id = map[entry.slot];
            const assigned = id ? functionFor(id) : undefined;
            entry.override = assigned !== undefined;
            entry.code = assigned ? assigned.code : entry.base;
            let face;
            if (assigned)
                face = assigned.face;
            else if (active)
                face = mediaFor(entry.slot)?.face ?? entry.label;
            else
                face = entry.label;
            face = this._transform(face);
            if (entry.button.label !== face)
                entry.button.set_label(face);
        }
    }

    /**
     * @param {FunctionKey} entry
     * @returns {number}
     */
    _functionCode(entry) {
        if (entry.override)
            return entry.code;
        if (this._fnLayer.active())
            return mediaFor(entry.slot)?.code ?? entry.code;
        return entry.code;
    }

    /**
     * @param {St.Button} button
     * @param {() => void} onDown
     * @param {(x: number, y: number) => void} onUp
     * @param {(x: number, y: number) => void} [onMove]
     * @returns {() => void} cancel: drop the press without firing onUp.
     */
    _track(button, onDown, onUp, onMove) {
        return track(button, {onDown, onUp, onMove, click: () => this._click(), active: Pseudo.ACTIVE});
    }

    _fnRepaint() {
        this._paint();
        this._applyFaces();
        this._applyFunctions();
        this.queue_redraw();
    }

    /**
     * @param {import('./geometry.js').KeySpec} spec
     * @param {St.Button} button
     */
    _wireKey(spec, button) {
        const code = spec.code;
        const timers = this._timers;
        const chooser = this._chooser;
        const composer = this._composer;
        const modifiers = this._modifiers;
        const fnLayer = this._fnLayer;
        let hold = 0;
        let opened = false;
        let active = code;
        /** @type {{label: string, keyval: number}[] | null} */
        let accents = null;
        let fire = () => modifiers.tap(active);
        const repeat = this._repeater(() => fire());

        const stopHold = () => {
            if (hold) {
                GLib.source_remove(hold);
                timers.delete(hold);
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
            active = fnLayer.active() && spec.fn ? spec.fn.code : code;
            const compose = spec.glyph && !fnLayer.active() && composer.composes();
            const stub = spec.glyph && !fnLayer.active() && !compose && composer.stub();
            accents = spec.glyph && !fnLayer.active() && !compose && !stub && this._settings.get_boolean(Key.ACCENTS)
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
                    timers.delete(hold);
                    hold = 0;
                    opened = true;
                    chooser.open(button, accents);
                    return GLib.SOURCE_REMOVE;
                });
                timers.add(hold);
            } else if (!compose) {
                repeat.start();
            }
        };

        /** @type {(x: number, y: number) => void} */
        const move = (x, y) => {
            if (opened)
                chooser.focus(x, y);
        };

        /** @type {(x: number, y: number) => void} */
        const up = (x, y) => {
            stop();
            if (opened)
                chooser.selectAt(x, y);
        };

        const cancel = this._track(button, down, up, move);
        this._tracked.push(() => {
            stop();
            cancel();
        });
        button.connect(Signal.DESTROY, stop);
    }

    /**
     * @param {St.Button} button
     * @param {PadKey} entry
     */
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

        const cancel = this._track(button, down, () => repeat.stop());
        this._tracked.push(() => {
            repeat.stop();
            cancel();
        });
        button.connect(Signal.DESTROY, () => repeat.stop());
    }

    /**
     * @param {() => void} fire
     * @returns {{start: () => void, stop: () => void}}
     */
    _repeater(fire) {
        const timers = this._timers;
        let hold = 0;
        let interval = 0;
        const stop = () => {
            if (hold) {
                GLib.source_remove(hold);
                timers.delete(hold);
                hold = 0;
            }
            if (interval) {
                GLib.source_remove(interval);
                timers.delete(interval);
                interval = 0;
            }
        };
        const start = () => {
            if (!this._repeat.get_boolean(Peripheral.REPEAT))
                return;
            hold = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._repeatDelay(), () => {
                timers.delete(hold);
                hold = 0;
                interval = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._repeatInterval(), () => {
                    fire();
                    return GLib.SOURCE_CONTINUE;
                });
                timers.add(interval);
                return GLib.SOURCE_REMOVE;
            });
            timers.add(hold);
        };
        return {start, stop};
    }

    /** @returns {number} */
    _repeatDelay() {
        const value = this._repeat.get_uint(Peripheral.DELAY);
        return value > 0 ? value : Repeat.DELAY;
    }

    /** @returns {number} */
    _repeatInterval() {
        const value = this._repeat.get_uint(Peripheral.INTERVAL);
        return Math.max(value > 0 ? value : Repeat.INTERVAL, Repeat.FLOOR);
    }

    /** @returns {string} */
    _faceId() {
        const language = this._language;
        const id = language.currentId();
        return !language.composing() && cjk(id) ? 'us' : id;
    }

    /**
     * @param {number} code
     * @returns {string}
     */
    _faceOf(code) {
        return glyphFor(this._faceId(), code, {shift: this._modifiers.shifted(), altgr: this._modifiers.altgr()});
    }

    _syncCaps() {
        const caps = this._capsKey;
        if (!caps)
            return;
        if (this._keymap.get_caps_lock_state()) {
            caps.add_style_class_name(Style.LOCKED);
            this._tint(caps, true);
        } else {
            caps.remove_style_class_name(Style.LOCKED);
            caps.set_style(null);
        }
    }

    _toggleNum() {
        this._numeric = !this._numeric;
        this._applyPads();
        this._paintNum();
    }

    _applyPads() {
        if (!Main.layoutManager.primaryMonitor)
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
        if (!this._numeric) {
            num.add_style_class_name(Style.ACTIVE);
            num.add_style_class_name(Style.LOCKED);
            this._tint(num, true);
        } else {
            num.remove_style_class_name(Style.ACTIVE);
            num.remove_style_class_name(Style.LOCKED);
            num.set_style(null);
        }
    }

    _applyStyle() {
        const family = this._settings.get_string(Key.FONT).replace(/"/g, '').trim();
        const geom = this._fontSize;
        const size = Math.round(geom * this._glyphScale());
        const parts = [];
        if (family && family !== FALLBACK_HEAD)
            parts.push(`font-family: "${family}"`);
        if (size > 0)
            parts.push(`font-size: ${size}px`);
        if (geom > 0) {
            const {side, bottom} = trayPadding(geom, this._tight);
            parts.push(`padding: ${side}px ${side}px ${bottom}px ${side}px`);
        }
        this.set_style(parts.length ? `${parts.join('; ')};` : null);
    }

    /**
     * @param {import('./geometry.js').KeySpec} spec
     * @returns {string}
     */
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

    /**
     * @param {import('./geometry.js').KeySpec} spec
     * @returns {boolean}
     */
    _isLight(spec) {
        if (spec.light)
            return true;
        const code = spec.code;
        if (code !== undefined && DARK_KEYS.has(code))
            return false;
        if (spec.kind === Kind.PAD)
            return true;
        if (spec.glyph)
            return true;
        return code !== undefined && LIGHT_KEYS.has(code);
    }

    /** @param {import('./geometry.js').KeySpec} spec */
    _activate(spec) {
        this._click();
        this._chooser.close();
        if (spec.kind === Kind.HIDE)
            this.emit(Signal.DISMISS);
        else
            this._injector.tap(spec.code);
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
    }

    /**
     * @param {St.Button} button
     * @param {boolean} locked
     */
    _tint(button, locked) {
        button.set_style(accentStyle(this._settings.get_string(Key.COLOR), locked));
    }

    _applyColor() {
        this._modifiers.tintAll();
        this._syncCaps();
        this._paintNum();
        this._fnLayer.tint();
    }

    _applyCase() {
        for (const {button, base} of this._statics) {
            const face = this._transform(base);
            if (button.label !== face)
                button.set_label(face);
        }
        this._applyFunctions();
        this._applyFaces();
        this._applyPads();
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    _transform(text) {
        if (/^F([1-9]|1[0-2])$/.test(text))
            return text;
        const mode = this._settings.get_string(Key.CASE);
        if (mode === Case.UPPER)
            return text.toUpperCase();
        if (mode === Case.TITLE)
            return text.replace(/\w\S*/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
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
                ? this._fitFace(button, spec.fn.face, spec.fn.symbol, spec.span)
                : glyphFor(layoutId, spec.code, level);
            if (button.label !== face) {
                button.set_label(face);
                dirty = true;
            }
        }
        if (dirty)
            this.queue_redraw();
    }

    /**
     * @param {St.Button} button
     * @param {boolean} fn      The Fn face is the one being shown.
     * @param {boolean} glyph   The base face is a typed glyph (large off Fn).
     */
    _fnScale(button, fn, glyph) {
        if (fn) {
            if (glyph)
                button.remove_style_class_name(Style.GLYPH);
            button.add_style_class_name(Style.COMPACT);
            button.ensure_style();
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
        this._chooser.destroy();
        for (const id of this._timers)
            GLib.source_remove(id);
        this._timers.clear();
    }
});
