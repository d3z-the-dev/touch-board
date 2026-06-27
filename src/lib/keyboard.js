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
import {Key, Case, Bound, Corner, Layout, functionFor, mediaFor} from './settings.js';
import {accentStyle} from './palette.js';
import {BASE_FONT, clamp, percentScale, solveFontSize, innerWidth, rowMetrics, trayPadding} from './metrics.js';
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

// CSS pseudo-classes toggled at runtime: ACTIVE is the pressed/armed look (distinct from Style.ACTIVE),
// RESTYLE forces a stylesheet re-read.
const Pseudo = Object.freeze({ACTIVE: 'active', RESTYLE: 'restyle'});

const Signal = Object.freeze({
    STATE_CHANGED: 'state-changed',
    SHOW: 'show',
    MAPPED: 'notify::mapped',
    CLICKED: 'clicked',
    DESTROY: 'destroy',
});

// Press-hold threshold (ms): locks a Hold-mode modifier, opens a key's accent popup.
const Hold = Object.freeze({DELAY: 360});

// Fallback auto-repeat timings (ms) when the desktop schema gives none;
// INTERVAL is floored so a misconfigured setting cannot spin the main loop.
const Repeat = Object.freeze({DELAY: 400, INTERVAL: 40, FLOOR: 20});

// Desktop schema owning the hardware key-repeat cadence, mirrored on-screen.
const Peripheral = Object.freeze({
    SCHEMA: 'org.gnome.desktop.peripherals.keyboard',
    REPEAT: 'repeat',
    DELAY: 'delay',
    INTERVAL: 'repeat-interval',
});

// The stylesheet's .touch-board rule holds the full font fallback chain, led by this default family.
// St ignores a multi-value inline font-family, so a custom family goes inline as one name,
// and the default sets no inline family.
const FALLBACK_HEAD = 'IBM Plex Sans';

// Tone split for _styleFor: typed glyphs, space, the arrow cluster, and the numpad's
// digit/operator tiles wear the lighter tile; other keys the darker functional tone.
// These sets carry the exceptions — glyph keys that read as punctuation (dark), and
// non-glyph keys that read as input (light, incl. the numpad operators). PAD-kind tiles
// are caught by kind directly; a per-spec `light` flag forces the tile for functional
// keys grouped into the numpad block (its media row, Hide, Num) without recolouring
// the same kinds in other layouts.
const DARK_KEYS = Object.freeze(new Set(/** @type {number[]} */ ([Code.GRAVE, Code.BACKSLASH, Code.SLASH])));
const LIGHT_KEYS = Object.freeze(new Set(/** @type {number[]} */ ([
    Code.SPACE, Code.UP, Code.DOWN, Code.LEFT, Code.RIGHT,
    Code.KPSLASH, Code.KPASTERISK, Code.KPMINUS, Code.KPPLUS, Code.KPENTER,
])));

// _init is the GObject constructor; checkJs sees it as a plain method, so all fields widen to T | undefined.
// Methods cast fields to narrowed locals.

// A glyph key carries its spec so _paint can refresh the face from the active layout.
/** @typedef {St.Button & {_spec: import('./geometry.js').KeySpec}} KeyButton */

/** @typedef {{button: St.Button, numeric: import('./geometry.js').Face, nav: import('./geometry.js').NavFace, span: number}} PadKey */

/** @typedef {{button: St.Button, word: string, symbol: string, span: number, fn?: import('./geometry.js').FnFace}} FaceKey */

/** @typedef {{slot: string, button: St.Button, base: number, label: string, code: number, override: boolean}} FunctionKey */

export const Keyboard = GObject.registerClass({
    Signals: {'dismiss': {}},
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
        // Numpad mode: true types digits, false navigates. Each face injects its own evdev code,
        // so the mode is local and independent of the system Num Lock.
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
        // Per-key cancel callbacks: stop auto-repeat and clear _track press state,
        // so a forced reset (lowering under a held finger) cannot strand a key down or repeating.
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
        // Before the keyboard maps, the theme cascade has not resolved, so faces paint default black.
        // Re-asserting the style on map repaints every face in its themed colour at once;
        // it runs on every map, so a reopen lands styled too.
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

    // Track a signal connection so release() can drop them all in one pass.
    /**
     * @param {GObject.Object} source
     * @param {string} signal
     * @param {(...args: any[]) => void} callback
     * @returns {number}
     */
    _connect(source, signal, callback) {
        const connections = /** @type {Connection[]} */ (this._connections);
        const id = source.connect(signal, callback);
        connections.push({source, id});
        return id;
    }

    /** @returns {import('./geometry.js').KeySpec[][]} */
    _profile() {
        const settings = /** @type {Settings} */ (this._settings);
        return profiles[settings.get_string(Key.LAYOUT)] ?? profiles[Layout.STANDARD];
    }

    _build() {
        const definition = this._profile();
        const total = Math.max(...definition.map(line => line.reduce((sum, spec) => sum + spec.span, 0)));
        this._total = total;
        const collected = /** @type {InstanceType<typeof Row>[]} */ (this._rows);
        for (const line of definition) {
            const row = new Row(total);
            for (const spec of line)
                row.append(spec.kind === Kind.SPACER ? new St.Widget() : this._makeKey(spec), spec.span, spec.rows ?? 1);
            this.add_child(row);
            collected.push(row);
        }
        this._paintNum();
    }

    // Swap the active profile: drop and rebuild every row, then re-run case/fit/caps.
    // The bridge repositions off the refit's height change, so none is needed here.
    _rebuild() {
        for (const row of /** @type {InstanceType<typeof Row>[]} */ (this._rows))
            row.destroy();
        this._rows = [];
        this._glyphs = [];
        this._fkeys = [];
        this._statics = [];
        this._faces = [];
        this._pads = [];
        this._numKey = null;
        this._tracked = [];
        /** @type {Modifiers} */ (this._modifiers).clear();
        /** @type {FnLayer} */ (this._fnLayer).clear();
        this._capsKey = null;
        this._build();
        this._applyCase();
        this._fit();
        this._syncCaps();
        this._relabel();
    }

    // The inter-key gutter scale (the `spacing` setting): 1 keeps the default gutter,
    // lower tightens it. Multiplied into both the allocated gap and the label-fit budget.
    /** @returns {number} */
    _spacing() {
        const settings = /** @type {Settings} */ (this._settings);
        return percentScale(settings.get_int(Key.SPACING), Bound.SPACING_MIN, Bound.SPACING_MAX);
    }

    // Key-glyph font scale (`glyph-size` setting): applied to the root font-size,
    // so every em label tier scales together, while pixel key geometry stays on fit size.
    /** @returns {number} */
    _glyphScale() {
        const settings = /** @type {Settings} */ (this._settings);
        return percentScale(settings.get_int(Key.GLYPH_SIZE), Bound.GLYPH_MIN, Bound.GLYPH_MAX);
    }

    // Size each row from the root font-size so the keyboard scales as a whole.
    _applyMetrics() {
        const collected = /** @type {InstanceType<typeof Row>[]} */ (this._rows);
        const {height, gap} = rowMetrics(
            /** @type {number} */ (this._fontSize),
            /** @type {boolean} */ (this._tight),
            this._spacing());
        for (const row of collected)
            row.setMetrics(height, gap);
    }

    // Pick each named key's face: the cased word when the fitted tile renders it in full,
    // else the compact symbol (a word St would clip to an ellipsis is rejected).
    _applyFaces() {
        const faces = /** @type {FaceKey[]} */ (this._faces);
        if (!Main.layoutManager.primaryMonitor)
            return;
        const active = /** @type {FnLayer} */ (this._fnLayer).active();
        for (const face of faces) {
            const inner = this._inner(face.span);
            if (face.fn)
                this._fnScale(face.button, active, false);
            let next;
            if (active && face.fn) {
                const word = this._transform(face.fn.face);
                next = face.fn.symbol !== undefined && !this._fits(face.button, word, inner)
                    ? face.fn.symbol
                    : word;
            } else {
                const word = this._transform(face.word);
                next = this._fits(face.button, word, inner) ? word : face.symbol;
            }
            if (face.button.label !== next)
                face.button.set_label(next);
        }
    }

    // Inner width available for a label: the key's span in units, less the em gutters.
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
            fontSize: /** @type {number} */ (this._fontSize),
            tight: /** @type {boolean} */ (this._tight),
            total: /** @type {number} */ (this._total),
            spacing: this._spacing(),
            span,
        });
    }

    // Whether the word renders within the tile, measured on the button so themed padding counts.
    // The candidate is set only to measure, then the prior label restored,
    // so the method is a pure query and the caller owns the committed face.
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
        button.set_label(current ?? '');
        return natural <= inner;
    }

    // Refit to geometry: the height percent of the short screen edge sets the root font-size,
    // giving one physical size in both orientations; text and keys scale together.
    // A portrait aspect flags the tight class so the stylesheet trims gutters.
    _fit() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const settings = /** @type {Settings} */ (this._settings);
        const percent = clamp(settings.get_int(Key.HEIGHT), Bound.HEIGHT_MIN, Bound.HEIGHT_MAX);
        const collected = /** @type {InstanceType<typeof Row>[]} */ (this._rows);
        const {fontSize, tight} = solveFontSize({
            monitorWidth: monitor.width,
            monitorHeight: monitor.height,
            percent,
            rows: collected.length,
            total: /** @type {number} */ (this._total),
        });
        this._fontSize = fontSize;
        this._tight = tight;
        // Pin the board to monitor width:
        // the GNOME-owned keyboardBox can keep the previous orientation's wider width after a rotate-while-open.
        // Owning the width (x_align START) matches the basis _inner()/_fits() assume.
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

    // Public entry for an orientation change; re-solves geometry whether shown or hidden.
    refit() {
        this._fit();
    }

    // Corner shape from `corner` (per-key) and `rounded` (tray) settings as root classes.
    // Soft keys and rounded tray are the CSS base (no class); pure CSS needs no refit.
    _applyShape() {
        const settings = /** @type {Settings} */ (this._settings);
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

    // Force every face to re-pull its themed colour (not resolved before first map):
    // toggling a root pseudo-class invalidates the subtree, ensure_style settles it now.
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
        const glyphs = /** @type {KeyButton[]} */ (this._glyphs);
        const fkeys = /** @type {FunctionKey[]} */ (this._fkeys);
        const modifiers = /** @type {Modifiers} */ (this._modifiers);
        const button = /** @type {KeyButton} */ (new St.Button({
            style_class: this._styleFor(spec),
            can_focus: false,
            x_expand: true,
            y_expand: true,
        }));
        button._spec = spec;

        // A numpad key owns both faces (swapped by _applyPads) and joins no other collection.
        if (spec.pad) {
            const pads = /** @type {PadKey[]} */ (this._pads);
            const entry = {button, numeric: spec.pad.numeric, nav: spec.pad.nav, span: spec.span};
            pads.push(entry);
            button.set_label(this._numeric ? entry.numeric.face : entry.nav.symbol);
            this._wirePad(button, entry);
            return button;
        }

        if (spec.glyph) {
            button.set_label('');
            glyphs.push(button);
        } else if (spec.symbol) {
            // A word/symbol key: _applyFaces owns its label.
            const faces = /** @type {FaceKey[]} */ (this._faces);
            faces.push({button, word: spec.label ?? '', symbol: spec.symbol, span: spec.span, fn: spec.fn});
        } else {
            const label = spec.label ?? '';
            // A reassignable F-key's face is owned by _applyFunctions; other statics are cased here.
            if (label && !spec.fslot) {
                const statics = /** @type {{button: St.Button, base: string}[]} */ (this._statics);
                statics.push({button, base: label});
                button.set_label(this._transform(label));
            } else {
                button.set_label(label);
            }
        }

        if (spec.kind === Kind.MODIFIER) {
            /** @type {(() => void)[]} */ (this._tracked).push(modifiers.wire(spec, button));
        } else if (spec.kind === Kind.NUM) {
            this._numKey = button;
            button.connect(Signal.CLICKED, () => {
                this._click();
                this._toggleNum();
            });
        } else if (spec.kind === Kind.FN) {
            /** @type {(() => void)[]} */ (this._tracked).push(/** @type {FnLayer} */ (this._fnLayer).wire(button));
        } else if (spec.fslot && spec.code !== undefined && spec.label !== undefined) {
            const entry = {slot: spec.fslot, button, base: spec.code, label: spec.label, code: spec.code, override: false};
            fkeys.push(entry);
            button.connect(Signal.CLICKED, () => {
                this._click();
                modifiers.tap(this._functionCode(entry));
            });
        } else if (spec.kind === Kind.KEY && spec.code !== undefined) {
            this._wireKey(spec, button);
        } else {
            if (spec.kind === Kind.LOCK && spec.code === Code.CAPS)
                this._capsKey = button;
            button.connect(Signal.CLICKED, () => this._activate(spec));
        }
        return button;
    }

    // Map each reassignable F-key to the code and face it shows now. Priority:
    // a user override beats the Fn-layer media function, which beats the default F-key.
    // _functionCode resolves the same order at tap time so face and keystroke agree.
    _applyFunctions() {
        const settings = /** @type {Settings} */ (this._settings);
        const fkeys = /** @type {FunctionKey[]} */ (this._fkeys);
        const map = /** @type {Record<string, string>} */ (settings.get_value(Key.FKEYS).deep_unpack());
        const active = /** @type {FnLayer} */ (this._fnLayer).active();
        for (const entry of fkeys) {
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

    // The code an F-key taps now, resolving the same priority _applyFunctions paints.
    /**
     * @param {FunctionKey} entry
     * @returns {number}
     */
    _functionCode(entry) {
        if (entry.override)
            return entry.code;
        if (/** @type {FnLayer} */ (this._fnLayer).active())
            return mediaFor(entry.slot)?.code ?? entry.code;
        return entry.code;
    }

    // Bind a key's gesture handling (see tracker.track), supplying the press cue and pseudo-class,
    // so the tracker owns no keyboard state.
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

    // Repaint everything the Fn layer governs after a layer switch (the FnLayer's injected repaint):
    // glyph faces, named faces, the function row, then the tray.
    // The tray clears any ghost the off-layer face leaves behind when a label shrinks.
    _fnRepaint() {
        this._paint();
        this._applyFaces();
        this._applyFunctions();
        this.queue_redraw();
    }

    // A typing key. The base glyph is committed on press for an immediate, uniform response;
    // a letter with accent variants also arms a long-press popup whose pick replaces the base.
    // A non-accent key auto-repeats while held.
    /**
     * @param {import('./geometry.js').KeySpec} spec
     * @param {St.Button} button
     */
    _wireKey(spec, button) {
        const code = spec.code;
        if (code === undefined)
            return;
        const timers = /** @type {Set<number>} */ (this._timers);
        const chooser = /** @type {Chooser} */ (this._chooser);
        const composer = /** @type {Composer} */ (this._composer);
        const modifiers = /** @type {Modifiers} */ (this._modifiers);
        const fnLayer = /** @type {FnLayer} */ (this._fnLayer);
        let hold = 0;
        let opened = false;
        // Code frozen at press (honouring Fn) so a one-shot Fn consumed mid-hold does not flip the repeat to the base key.
        let active = code;
        /** @type {{label: string, keyval: number}[] | null} */
        let accents = null;
        // Reassigned each press to the actuation kind (compose/stub/base);
        // the repeater reads it through the wrapper, so a held key repeats whatever it committed.
        let fire = () => modifiers.tap(active);
        const repeat = this._repeater(() => fire());

        // The accent-popup-open timer is mutually exclusive with auto-repeat (only one arms per press);
        // clearing it and the repeater covers every in-flight source.
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
            const settings = /** @type {Settings} */ (this._settings);
            active = fnLayer.active() && spec.fn ? spec.fn.code : code;
            // A CJK source composes in the input method: send the keysym for the engine,
            // never an evdev code (xkb would give the bare Latin position);
            // never auto-repeat or open the Latin accent popup, both meaningless mid-composition.
            const compose = spec.glyph && !fnLayer.active() && composer.composes();
            // A CJK source with no engine is a bare us stub: type the us-position keysym,
            // so the face matches the output on any underlying xkb.
            const stub = spec.glyph && !fnLayer.active() && !compose && composer.stub();
            // Accents belong to the plain Latin layer only: under Fn the key is a function,
            // under composition the IME owns it, and a us stub is bare Latin.
            accents = spec.glyph && !fnLayer.active() && !compose && !stub && settings.get_boolean(Key.ACCENTS)
                ? accentsFor(this._faceOf(spec))
                : null;
            // Commit the base on press so every key responds immediately;
            // a fast roll preserves keystroke order, and an accent popup later replaces it (see below).
            fire = compose ? () => composer.compose(spec) : stub ? () => composer.stubKey(spec) : () => modifiers.tap(active);
            fire();
            if (accents) {
                // The base is typed; a long press opens the variant popup, whose pick replaces it (see _select).
                // An accent key does not auto-repeat.
                hold = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Hold.DELAY, () => {
                    timers.delete(hold);
                    hold = 0;
                    opened = true;
                    chooser.open(button, /** @type {{label: string, keyval: number}[]} */ (accents));
                    return GLib.SOURCE_REMOVE;
                });
                timers.add(hold);
            } else if (!compose) {
                // A held non-accent key auto-repeats; a composed keystroke never repeats.
                repeat.start();
            }
        };

        // The popup-opening key keeps the finger's grab, so its stream drives the slide:
        // highlight the variant under the finger; release off the row leaves the popup up.
        const move = (/** @type {number} */ x, /** @type {number} */ y) => {
            if (opened)
                chooser.focus(x, y);
        };

        const up = (/** @type {number} */ x, /** @type {number} */ y) => {
            stop();
            // The base was committed on press;
            // on release only an open popup needs resolving (a pick replaces the base,
            // a release off the row leaves it up).
            if (opened)
                chooser.selectAt(x, y);
        };

        const cancel = this._track(button, down, up, move);
        /** @type {(() => void)[]} */ (this._tracked).push(() => {
            stop();
            cancel();
        });
        button.connect(Signal.DESTROY, stop);
    }

    // A numpad key: taps on press and auto-repeats while held,
    // injecting the active face's code resolved at each fire so a Num toggle mid-hold is honoured.
    /**
     * @param {St.Button} button
     * @param {PadKey} entry
     */
    _wirePad(button, entry) {
        const modifiers = /** @type {Modifiers} */ (this._modifiers);
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
        /** @type {(() => void)[]} */ (this._tracked).push(() => {
            repeat.stop();
            cancel();
        });
        button.connect(Signal.DESTROY, () => repeat.stop());
    }

    // Respects the desktop repeat delay, interval, and repeat-enabled toggle.
    // Both timers register in _timers so a teardown mid-hold cannot strand one.
    /**
     * @param {() => void} fire
     * @returns {{start: () => void, stop: () => void}}
     */
    _repeater(fire) {
        const timers = /** @type {Set<number>} */ (this._timers);
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
            if (!(/** @type {Gio.Settings} */ (this._repeat).get_boolean(Peripheral.REPEAT)))
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
        const value = /** @type {Gio.Settings} */ (this._repeat).get_uint(Peripheral.DELAY);
        return value > 0 ? value : Repeat.DELAY;
    }

    /** @returns {number} */
    _repeatInterval() {
        const value = /** @type {Gio.Settings} */ (this._repeat).get_uint(Peripheral.INTERVAL);
        return Math.max(value > 0 ? value : Repeat.INTERVAL, Repeat.FLOOR);
    }

    // The layout id the keys wear.
    // A CJK source with no active engine is a bare us stub (its native faces assume an engine),
    // so it falls back to us; others show own.
    /** @returns {string} */
    _faceId() {
        const language = /** @type {Language} */ (this._language);
        const id = language.currentId();
        return !language.composing() && cjk(id) ? 'us' : id;
    }

    /**
     * @param {import('./geometry.js').KeySpec} spec
     * @returns {string}
     */
    _faceOf(spec) {
        const code = spec.code;
        if (code === undefined)
            return '';
        const modifiers = /** @type {Modifiers} */ (this._modifiers);
        return glyphFor(this._faceId(), code, {shift: modifiers.shifted(), altgr: modifiers.altgr()});
    }

    // Reflect the real Caps Lock state from the shared keymap (here or a physical key).
    _syncCaps() {
        const caps = /** @type {St.Button | null} */ (this._capsKey);
        if (!caps)
            return;
        if (/** @type {Clutter.Keymap} */ (this._keymap).get_caps_lock_state()) {
            caps.add_style_class_name(Style.LOCKED);
            this._tint(caps, true);
        } else {
            caps.remove_style_class_name(Style.LOCKED);
            caps.set_style(null);
        }
    }

    // Flip the numpad between numeric and navigation: swap faces and relight the Num key.
    _toggleNum() {
        this._numeric = !this._numeric;
        this._applyPads();
        this._paintNum();
    }

    // Set each pad key to its face for the current Num mode: the digit,
    // or the navigation face with the same word/symbol fit as the standalone nav keys.
    _applyPads() {
        const pads = /** @type {PadKey[]} */ (this._pads);
        if (!Main.layoutManager.primaryMonitor)
            return;
        for (const entry of pads) {
            let next;
            if (this._numeric) {
                next = entry.numeric.face;
            } else {
                const word = this._transform(entry.nav.word);
                next = this._fits(entry.button, word, this._inner(entry.span)) ? word : entry.nav.symbol;
            }
            if (entry.button.label !== next)
                entry.button.set_label(next);
        }
    }

    // Light the Num key while the numpad navigates; numeric mode leaves it dark,
    // so a freshly opened keyboard shows no engaged mode and types digits.
    _paintNum() {
        const num = /** @type {St.Button | null} */ (this._numKey);
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

    // Compose the root style: configured font,
    // the fitted font-size scaled by glyph-size (the em text anchor),
    // and a px tray padding pinned to the unscaled fit size;
    // otherwise the stylesheet's em padding rides the glyph scale and resizes the board.
    _applyStyle() {
        const settings = /** @type {Settings} */ (this._settings);
        const family = settings.get_string(Key.FONT).replace(/"/g, '').trim();
        const geom = /** @type {number} */ (this._fontSize);
        const tight = /** @type {boolean} */ (this._tight);
        const size = Math.round(geom * this._glyphScale());
        const parts = [];
        if (family && family !== FALLBACK_HEAD)
            parts.push(`font-family: "${family}"`);
        if (size > 0)
            parts.push(`font-size: ${size}px`);
        if (geom > 0) {
            const {side, bottom} = trayPadding(geom, tight);
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

    // Whether the key wears the lighter tile (see DARK_KEYS / LIGHT_KEYS for the split).
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
        /** @type {Chooser} */ (this._chooser).close();
        if (spec.kind === Kind.HIDE) {
            this.emit('dismiss');
            return;
        }
        const code = spec.code;
        if (code === undefined)
            return;
        if (spec.kind === Kind.LOCK)
            /** @type {Injector} */ (this._injector).tap(code);
        else
            /** @type {Modifiers} */ (this._modifiers).tap(code);
    }

    // Play the key-click; the player reads its own settings, so call unconditionally.
    _click() {
        /** @type {Player} */ (this._player).click();
    }

    // Clear every soft modifier when the keyboard hides. No release is injected:
    // the virtual device is disposed on hide, which releases any held key at the compositor,
    // so only local state and lit faces need clearing. Caps is untouched.
    reset() {
        /** @type {Chooser} */ (this._chooser).close();
        // Cancel every in-flight press first: the keyboard can lower under a held finger,
        // and TOUCH_END may never arrive, leaving a key repeating (a stuck Enter) or down.
        for (const cancel of /** @type {(() => void)[]} */ (this._tracked))
            cancel();
        /** @type {Modifiers} */ (this._modifiers).clearAll();
        /** @type {FnLayer} */ (this._fnLayer).off();
    }

    // Paint an engaged modifier with the configured colour; a lock is the same hue,
    // mixed toward white so one-shot and lock stay distinguishable off one setting.
    /**
     * @param {St.Button} button
     * @param {boolean} locked
     */
    _tint(button, locked) {
        const settings = /** @type {Settings} */ (this._settings);
        button.set_style(accentStyle(settings.get_string(Key.COLOR), locked));
    }

    // Re-tint every engaged modifier (and Caps) when the colour setting changes.
    _applyColor() {
        /** @type {Modifiers} */ (this._modifiers).tintAll();
        this._syncCaps();
        this._paintNum();
        /** @type {FnLayer} */ (this._fnLayer).tint();
    }

    // Apply the configured case to every static face; F-keys keep their capital F inside _transform,
    // and function-row overrides are recased through _applyFunctions.
    _applyCase() {
        const statics = /** @type {{button: St.Button, base: string}[]} */ (this._statics);
        for (const {button, base} of statics) {
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
        const settings = /** @type {Settings} */ (this._settings);
        const mode = settings.get_string(Key.CASE);
        if (mode === Case.UPPER)
            return text.toUpperCase();
        if (mode === Case.TITLE)
            return text.replace(/\w\S*/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
        return text.toLowerCase();
    }

    // Language change: warn once on an unknown layout, then repaint.
    // Modifier changes go straight to _paint so a keystroke does not spam the log.
    _relabel() {
        const language = /** @type {Language} */ (this._language);
        if (!supports(language.currentId()))
            console.error(`touch-board: unsupported layout "${language.currentId()}", falling back to us glyphs`);
        this._paint();
    }

    _paint() {
        const glyphs = /** @type {KeyButton[]} */ (this._glyphs);
        const modifiers = /** @type {Modifiers} */ (this._modifiers);
        const layoutId = this._faceId();
        const level = {shift: modifiers.shifted(), altgr: modifiers.altgr()};
        const active = /** @type {FnLayer} */ (this._fnLayer).active();
        let dirty = false;
        for (const button of glyphs) {
            const spec = button._spec;
            if (spec.code === undefined)
                continue;
            // Under Fn a glyph key with an Fn face shows it (full word if it fits, else the compact symbol);
            // otherwise the active-layout glyph. Scale before the fit.
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
        // A face swap can leave the previous glyph's ink behind (the Fn-layer ghost);
        // repaint the tray when any face actually changed.
        if (dirty)
            this.queue_redraw();
    }

    // Resolve a glyph key's Fn face for the current fit: the cased word when it fits,
    // else the compact symbol, mirroring the word/symbol choice _applyFaces makes.
    /**
     * @param {St.Button} button
     * @param {import('./geometry.js').FnFace} fn
     * @param {number} span
     * @returns {string}
     */
    _fnFace(button, fn, span) {
        const word = this._transform(fn.face);
        if (fn.symbol === undefined)
            return word;
        return this._fits(button, word, this._inner(span)) ? word : fn.symbol;
    }

    // Scale a key's label to its Fn face: under Fn a key reads at the compact function size,
    // not the large glyph size. Off Fn a glyph key returns to the glyph size.
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
            // Settle the new metrics now so the following fit measures at the compact paint size.
            button.ensure_style();
        } else {
            button.remove_style_class_name(Style.COMPACT);
            if (glyph)
                button.add_style_class_name(Style.GLYPH);
        }
    }

    release() {
        const timers = /** @type {Set<number>} */ (this._timers);
        for (const {source, id} of /** @type {Connection[]} */ (this._connections))
            source.disconnect(id);
        this._connections = [];
        /** @type {Chooser} */ (this._chooser).close();
        for (const id of timers)
            GLib.source_remove(id);
        timers.clear();
        /** @type {Modifiers} */ (this._modifiers).clearAll();
        /** @type {FnLayer} */ (this._fnLayer).clear();
        this._paint();
    }
});
