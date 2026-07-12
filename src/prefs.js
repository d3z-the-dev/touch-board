import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {Key, Case, Corner, Layout, Mode, Click, Bound, Slots, Functions} from './lib/settings.js';

const Label = Object.freeze({
    PAGE: 'Touch Board',
    APPEARANCE: 'Appearance',
    LAYOUT_ROW: 'Layout',
    LAYOUT_SUBTITLE: 'Which key block to show',
    FONT_ROW: 'Key font',
    FONT_SUBTITLE: 'Typeface for the key glyphs',
    COLOR_ROW: 'Engaged colour',
    COLOR_SUBTITLE: 'Colour of an engaged modifier',
    CASE_ROW: 'Label case',
    CASE_SUBTITLE: 'Letter case of the key labels',
    CORNER_ROW: 'Key corners',
    CORNER_SUBTITLE: 'Roundness of the key corners',
    ROUNDED_ROW: 'Rounded corners',
    ROUNDED_SUBTITLE: 'Round the keyboard’s top corners',
    HEIGHT_ROW: 'Height',
    HEIGHT_SUBTITLE: 'Percent of the screen height',
    SPACING_ROW: 'Key spacing',
    SPACING_SUBTITLE: 'Gap between keys, percent of default',
    GLYPH_ROW: 'Font size',
    GLYPH_SUBTITLE: 'Key glyph font size, percent of default',
    BEHAVIOUR: 'Behaviour',
    MODE_ROW: 'Modifier keys',
    MODE_SUBTITLE: 'How Shift, Ctrl, Super and Alt respond to a tap',
    ACCENTS_ROW: 'Accent popup',
    ACCENTS_SUBTITLE: 'Long-press a letter for accented variants',
    SOUND: 'Sound',
    CLICK_ROW: 'Key click',
    CLICK_SUBTITLE: 'Play a sound on each key tap',
    VARIANT_ROW: 'Click sound',
    VARIANT_SUBTITLE: 'Which click to play',
    VOLUME_ROW: 'Click volume',
    VOLUME_SUBTITLE: 'Loudness, percent of full scale',
    FUNCTION_GROUP: 'Function row',
    FUNCTION_HINT: 'Reassign F1-F12 to standard functions. Add a row to override a key.',
    BINDING_ROW: 'Override',
});

/** @type {readonly {id: string, name: string}[]} */
const Cases = Object.freeze([
    {id: Case.LOWER, name: 'lowercase'},
    {id: Case.TITLE, name: 'Titlecase'},
    {id: Case.UPPER, name: 'UPPERCASE'},
]);

/** @type {readonly {id: string, name: string}[]} */
const Corners = Object.freeze([
    {id: Corner.SHARP, name: 'Sharp'},
    {id: Corner.SOFT, name: 'Soft'},
    {id: Corner.ROUND, name: 'Round'},
]);

/** @type {readonly {id: string, name: string}[]} */
const Layouts = Object.freeze([
    {id: Layout.COMPACT, name: '60% compact'},
    {id: Layout.STANDARD, name: '75% standard'},
    {id: Layout.FULL, name: '100% full'},
]);

/** @type {readonly {id: string, name: string}[]} */
const Modes = Object.freeze([
    {id: Mode.HOLD, name: 'Hold'},
    {id: Mode.LATCH, name: 'Latch'},
    {id: Mode.TOGGLE, name: 'Toggle'},
]);

/** @type {readonly {id: string, name: string}[]} */
const Clicks = Object.freeze([
    {id: Click.THOCK, name: 'Thock'},
    {id: Click.CLICK, name: 'Click'},
    {id: Click.TAP, name: 'Tap'},
    {id: Click.POP, name: 'Pop'},
]);

const Icon = Object.freeze({
    PAGE: 'preferences-desktop-keyboard-symbolic',
    ADD: 'list-add-symbolic',
    REMOVE: 'user-trash-symbolic',
});

const Style = Object.freeze({FLAT: 'flat'});

const Signal = Object.freeze({
    SELECTED: 'notify::selected',
    ACTIVE: 'notify::active',
    VALUE: 'notify::value',
    FONT: 'notify::font-desc',
    RGBA: 'notify::rgba',
    CLICKED: 'clicked',
});

/** @typedef {import('gi://Gio').default.Settings} Settings */
/** @typedef {{row: import('gi://Adw').default.ActionRow, slot: import('gi://Gtk').default.DropDown, fn: import('gi://Gtk').default.DropDown}} Binding */

export default class TouchBoardPreferences extends ExtensionPreferences {
    /**
     * @param {import('gi://Adw').default.PreferencesWindow} window
     * @returns {Promise<void>}
     */
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({title: Label.PAGE, icon_name: Icon.PAGE});
        page.add(this._appearance(settings));
        page.add(this._behaviour(settings));
        page.add(this._sound(settings));
        page.add(this._functionRow(settings));
        window.add(page);
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.PreferencesGroup}
     */
    _appearance(settings) {
        const group = new Adw.PreferencesGroup({title: Label.APPEARANCE});
        group.add(this._combo(settings, Key.LAYOUT, Label.LAYOUT_ROW, Label.LAYOUT_SUBTITLE, Layouts));
        group.add(this._spin(settings, Key.HEIGHT, Label.HEIGHT_ROW, Label.HEIGHT_SUBTITLE,
            {lower: Bound.HEIGHT_MIN, upper: Bound.HEIGHT_MAX, step: 1, page: 5}));
        group.add(this._spin(settings, Key.SPACING, Label.SPACING_ROW, Label.SPACING_SUBTITLE,
            {lower: Bound.SPACING_MIN, upper: Bound.SPACING_MAX, step: 1, page: 5}));
        group.add(this._spin(settings, Key.GLYPH_SIZE, Label.GLYPH_ROW, Label.GLYPH_SUBTITLE,
            {lower: Bound.GLYPH_MIN, upper: Bound.GLYPH_MAX, step: 1, page: 5}));
        group.add(this._font(settings));
        group.add(this._combo(settings, Key.CASE, Label.CASE_ROW, Label.CASE_SUBTITLE, Cases));
        group.add(this._combo(settings, Key.CORNER, Label.CORNER_ROW, Label.CORNER_SUBTITLE, Corners));
        group.add(this._switch(settings, Key.ROUNDED, Label.ROUNDED_ROW, Label.ROUNDED_SUBTITLE));
        group.add(this._color(settings));
        return group;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.ActionRow}
     */
    _font(settings) {
        const button = new Gtk.FontDialogButton({
            dialog: new Gtk.FontDialog(),
            level: Gtk.FontLevel.FAMILY,
            valign: Gtk.Align.CENTER,
        });

        const family = settings.get_string(Key.FONT);
        if (family)
            button.set_font_desc(Pango.FontDescription.from_string(family));

        button.connect(Signal.FONT, () => {
            settings.set_string(Key.FONT, button.get_font_desc().get_family());
        });

        const row = new Adw.ActionRow({title: Label.FONT_ROW, subtitle: Label.FONT_SUBTITLE});
        row.add_suffix(button);
        row.activatable_widget = button;
        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.PreferencesGroup}
     */
    _behaviour(settings) {
        const group = new Adw.PreferencesGroup({title: Label.BEHAVIOUR});
        group.add(this._combo(settings, Key.MODE, Label.MODE_ROW, Label.MODE_SUBTITLE, Modes));
        group.add(this._switch(settings, Key.ACCENTS, Label.ACCENTS_ROW, Label.ACCENTS_SUBTITLE));
        return group;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.PreferencesGroup}
     */
    _sound(settings) {
        const group = new Adw.PreferencesGroup({title: Label.SOUND});
        const toggle = this._switch(settings, Key.CLICK, Label.CLICK_ROW, Label.CLICK_SUBTITLE);
        const variant = this._combo(settings, Key.SOUND, Label.VARIANT_ROW, Label.VARIANT_SUBTITLE, Clicks);
        const volume = this._spin(settings, Key.VOLUME, Label.VOLUME_ROW, Label.VOLUME_SUBTITLE,
            {lower: Bound.VOLUME_MIN, upper: Bound.VOLUME_MAX, step: 5, page: 10});

        const gate = () => {
            variant.sensitive = toggle.get_active();
            volume.sensitive = toggle.get_active();
        };
        toggle.connect(Signal.ACTIVE, gate);
        gate();

        group.add(toggle);
        group.add(variant);
        group.add(volume);
        return group;
    }

    /**
     * @param {Settings} settings
     * @param {string} key
     * @param {string} title
     * @param {string} subtitle
     * @param {readonly {id: string, name: string}[]} entries
     * @returns {import('gi://Adw').default.ComboRow}
     */
    _combo(settings, key, title, subtitle, entries) {
        const row = new Adw.ComboRow({
            title,
            subtitle,
            model: Gtk.StringList.new(entries.map(entry => entry.name)),
        });
        const current = settings.get_string(key);
        row.set_selected(entries.findIndex(entry => entry.id === current));
        row.connect(Signal.SELECTED, () => settings.set_string(key, entries[row.get_selected()].id));
        return row;
    }

    /**
     * @param {Settings} settings
     * @param {string} key
     * @param {string} title
     * @param {string} subtitle
     * @param {{lower: number, upper: number, step: number, page: number}} range
     * @returns {import('gi://Adw').default.SpinRow}
     */
    _spin(settings, key, title, subtitle, range) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            adjustment: new Gtk.Adjustment({
                lower: range.lower,
                upper: range.upper,
                step_increment: range.step,
                page_increment: range.page,
            }),
        });
        row.set_value(settings.get_int(key));
        row.connect(Signal.VALUE, () => settings.set_int(key, row.get_value()));
        return row;
    }

    /**
     * @param {Settings} settings
     * @param {string} key
     * @param {string} title
     * @param {string} subtitle
     * @returns {import('gi://Adw').default.SwitchRow}
     */
    _switch(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle, active: settings.get_boolean(key)});
        row.connect(Signal.ACTIVE, () => settings.set_boolean(key, row.get_active()));
        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.ActionRow}
     */
    _color(settings) {
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog(),
            valign: Gtk.Align.CENTER,
        });

        const rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string(Key.COLOR));
        button.set_rgba(rgba);

        button.connect(Signal.RGBA, () => {
            const colour = button.get_rgba();
            const hex = [colour.red, colour.green, colour.blue]
                .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0'))
                .join('');
            settings.set_string(Key.COLOR, `#${hex}`);
        });

        const row = new Adw.ActionRow({title: Label.COLOR_ROW, subtitle: Label.COLOR_SUBTITLE});
        row.add_suffix(button);
        row.activatable_widget = button;
        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.PreferencesGroup}
     */
    _functionRow(settings) {
        const group = new Adw.PreferencesGroup({
            title: Label.FUNCTION_GROUP,
            description: Label.FUNCTION_HINT,
        });

        const slotNames = Slots.map(slot => slot.label);
        const functionNames = Functions.map(entry => entry.name);

        /** @type {Binding[]} */
        const bindings = [];

        const persist = () => {
            /** @type {Record<string, string>} */
            const dict = {};
            for (const binding of bindings)
                dict[Slots[binding.slot.get_selected()].id] = Functions[binding.fn.get_selected()].id;
            settings.set_value(Key.FKEYS, new GLib.Variant('a{ss}', dict));
        };

        /**
         * @param {string} slotId
         * @param {string} functionId
         */
        const addBinding = (slotId, functionId) => {
            const slot = Gtk.DropDown.new_from_strings(slotNames);
            slot.valign = Gtk.Align.CENTER;
            const slotIndex = Slots.findIndex(entry => entry.id === slotId);
            slot.set_selected(slotIndex < 0 ? 0 : slotIndex);

            const fn = Gtk.DropDown.new_from_strings(functionNames);
            fn.valign = Gtk.Align.CENTER;
            const functionIndex = Functions.findIndex(entry => entry.id === functionId);
            fn.set_selected(functionIndex < 0 ? 0 : functionIndex);

            const remove = new Gtk.Button({icon_name: Icon.REMOVE, valign: Gtk.Align.CENTER});
            remove.add_css_class(Style.FLAT);

            const row = new Adw.ActionRow({title: Label.BINDING_ROW});
            row.add_prefix(slot);
            row.add_suffix(fn);
            row.add_suffix(remove);
            group.add(row);

            const binding = {row, slot, fn};
            bindings.push(binding);

            slot.connect(Signal.SELECTED, persist);
            fn.connect(Signal.SELECTED, persist);
            remove.connect(Signal.CLICKED, () => {
                group.remove(row);
                bindings.splice(bindings.indexOf(binding), 1);
                persist();
            });
        };

        const add = new Gtk.Button({icon_name: Icon.ADD, valign: Gtk.Align.CENTER});
        add.add_css_class(Style.FLAT);
        add.connect(Signal.CLICKED, () => {
            addBinding(Slots[0].id, Functions[0].id);
            persist();
        });
        group.set_header_suffix(add);

        const stored = /** @type {Record<string, string>} */ (settings.get_value(Key.FKEYS).deep_unpack());
        for (const [slotId, functionId] of Object.entries(stored))
            addBinding(slotId, functionId);

        return group;
    }
}
