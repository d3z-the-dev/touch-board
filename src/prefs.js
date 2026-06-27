import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {Key, Case, Corner, Layout, Mode, Click, Bound, Default, Slots, Functions} from './lib/settings.js';

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

// Dropdown option lists, in gschema-enum order so the selected index maps straight onto the enum.
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

        group.add(this._layout(settings));
        group.add(this._height(settings));
        group.add(this._spacing(settings));
        group.add(this._glyphSize(settings));

        const button = new Gtk.FontDialogButton({
            dialog: new Gtk.FontDialog(),
            level: Gtk.FontLevel.FAMILY,
            valign: Gtk.Align.CENTER,
        });

        const family = settings.get_string(Key.FONT);
        if (family)
            button.set_font_desc(Pango.FontDescription.from_string(family));

        button.connect('notify::font-desc', () => {
            const description = button.get_font_desc();
            settings.set_string(Key.FONT, description?.get_family() ?? '');
        });

        const row = new Adw.ActionRow({title: Label.FONT_ROW, subtitle: Label.FONT_SUBTITLE});
        row.add_suffix(button);
        row.activatable_widget = button;
        group.add(row);

        group.add(this._case(settings));
        group.add(this._corner(settings));

        const rounded = new Adw.SwitchRow({
            title: Label.ROUNDED_ROW,
            subtitle: Label.ROUNDED_SUBTITLE,
            active: settings.get_boolean(Key.ROUNDED),
        });
        rounded.connect('notify::active', () => settings.set_boolean(Key.ROUNDED, rounded.get_active()));
        group.add(rounded);

        group.add(this._color(settings));

        return group;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.PreferencesGroup}
     */
    _behaviour(settings) {
        const group = new Adw.PreferencesGroup({title: Label.BEHAVIOUR});

        const row = new Adw.ComboRow({
            title: Label.MODE_ROW,
            subtitle: Label.MODE_SUBTITLE,
            model: Gtk.StringList.new(Modes.map(entry => entry.name)),
        });

        const current = settings.get_string(Key.MODE);
        const index = Modes.findIndex(entry => entry.id === current);
        row.set_selected(index < 0 ? 0 : index);

        row.connect('notify::selected', () => {
            settings.set_string(Key.MODE, Modes[row.get_selected()].id);
        });

        group.add(row);

        const accents = new Adw.SwitchRow({
            title: Label.ACCENTS_ROW,
            subtitle: Label.ACCENTS_SUBTITLE,
            active: settings.get_boolean(Key.ACCENTS),
        });
        accents.connect('notify::active', () => settings.set_boolean(Key.ACCENTS, accents.get_active()));
        group.add(accents);

        return group;
    }

    // Variant and volume rows follow the toggle's state, so they read as disabled while the click is off.
    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.PreferencesGroup}
     */
    _sound(settings) {
        const group = new Adw.PreferencesGroup({title: Label.SOUND});

        const toggle = new Adw.SwitchRow({
            title: Label.CLICK_ROW,
            subtitle: Label.CLICK_SUBTITLE,
            active: settings.get_boolean(Key.CLICK),
        });

        const variant = new Adw.ComboRow({
            title: Label.VARIANT_ROW,
            subtitle: Label.VARIANT_SUBTITLE,
            model: Gtk.StringList.new(Clicks.map(entry => entry.name)),
        });
        const index = Clicks.findIndex(entry => entry.id === settings.get_string(Key.SOUND));
        variant.set_selected(index < 0 ? 0 : index);
        variant.connect('notify::selected', () => {
            settings.set_string(Key.SOUND, Clicks[variant.get_selected()].id);
        });

        const volume = new Adw.SpinRow({
            title: Label.VOLUME_ROW,
            subtitle: Label.VOLUME_SUBTITLE,
            adjustment: new Gtk.Adjustment({
                lower: Bound.VOLUME_MIN,
                upper: Bound.VOLUME_MAX,
                step_increment: 5,
                page_increment: 10,
            }),
        });
        volume.set_value(settings.get_int(Key.VOLUME));
        volume.connect('notify::value', () => settings.set_int(Key.VOLUME, volume.get_value()));

        toggle.connect('notify::active', () => {
            const on = toggle.get_active();
            settings.set_boolean(Key.CLICK, on);
            variant.sensitive = on;
            volume.sensitive = on;
        });
        variant.sensitive = toggle.get_active();
        volume.sensitive = toggle.get_active();

        group.add(toggle);
        group.add(variant);
        group.add(volume);
        return group;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.SpinRow}
     */
    _height(settings) {
        const row = new Adw.SpinRow({
            title: Label.HEIGHT_ROW,
            subtitle: Label.HEIGHT_SUBTITLE,
            adjustment: new Gtk.Adjustment({
                lower: Bound.HEIGHT_MIN,
                upper: Bound.HEIGHT_MAX,
                step_increment: 1,
                page_increment: 5,
            }),
        });

        row.set_value(settings.get_int(Key.HEIGHT));
        row.connect('notify::value', () => settings.set_int(Key.HEIGHT, row.get_value()));
        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.SpinRow}
     */
    _spacing(settings) {
        const row = new Adw.SpinRow({
            title: Label.SPACING_ROW,
            subtitle: Label.SPACING_SUBTITLE,
            adjustment: new Gtk.Adjustment({
                lower: Bound.SPACING_MIN,
                upper: Bound.SPACING_MAX,
                step_increment: 1,
                page_increment: 5,
            }),
        });

        row.set_value(settings.get_int(Key.SPACING));
        row.connect('notify::value', () => settings.set_int(Key.SPACING, row.get_value()));
        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.SpinRow}
     */
    _glyphSize(settings) {
        const row = new Adw.SpinRow({
            title: Label.GLYPH_ROW,
            subtitle: Label.GLYPH_SUBTITLE,
            adjustment: new Gtk.Adjustment({
                lower: Bound.GLYPH_MIN,
                upper: Bound.GLYPH_MAX,
                step_increment: 1,
                page_increment: 5,
            }),
        });

        row.set_value(settings.get_int(Key.GLYPH_SIZE));
        row.connect('notify::value', () => settings.set_int(Key.GLYPH_SIZE, row.get_value()));
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
        rgba.parse(settings.get_string(Key.COLOR) || Default.COLOR);
        button.set_rgba(rgba);

        button.connect('notify::rgba', () => {
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
     * @returns {import('gi://Adw').default.ComboRow}
     */
    _layout(settings) {
        const row = new Adw.ComboRow({
            title: Label.LAYOUT_ROW,
            subtitle: Label.LAYOUT_SUBTITLE,
            model: Gtk.StringList.new(Layouts.map(entry => entry.name)),
        });

        const current = settings.get_string(Key.LAYOUT);
        const index = Layouts.findIndex(entry => entry.id === current);
        row.set_selected(index < 0 ? 0 : index);

        row.connect('notify::selected', () => {
            settings.set_string(Key.LAYOUT, Layouts[row.get_selected()].id);
        });

        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.ComboRow}
     */
    _case(settings) {
        const row = new Adw.ComboRow({
            title: Label.CASE_ROW,
            subtitle: Label.CASE_SUBTITLE,
            model: Gtk.StringList.new(Cases.map(entry => entry.name)),
        });

        const current = settings.get_string(Key.CASE);
        const index = Cases.findIndex(entry => entry.id === current);
        row.set_selected(index < 0 ? 0 : index);

        row.connect('notify::selected', () => {
            settings.set_string(Key.CASE, Cases[row.get_selected()].id);
        });

        return row;
    }

    /**
     * @param {Settings} settings
     * @returns {import('gi://Adw').default.ComboRow}
     */
    _corner(settings) {
        const row = new Adw.ComboRow({
            title: Label.CORNER_ROW,
            subtitle: Label.CORNER_SUBTITLE,
            model: Gtk.StringList.new(Corners.map(entry => entry.name)),
        });

        const current = settings.get_string(Key.CORNER);
        const index = Corners.findIndex(entry => entry.id === current);
        row.set_selected(index < 0 ? 0 : index);

        row.connect('notify::selected', () => {
            settings.set_string(Key.CORNER, Corners[row.get_selected()].id);
        });

        return row;
    }

    // Rows serialise to the fkeys dict on every change; a slot with no row keeps its default F-key.
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
            remove.add_css_class('flat');

            const row = new Adw.ActionRow({title: Label.BINDING_ROW});
            row.add_prefix(slot);
            row.add_suffix(fn);
            row.add_suffix(remove);
            group.add(row);

            const binding = {row, slot, fn};
            bindings.push(binding);

            slot.connect('notify::selected', persist);
            fn.connect('notify::selected', persist);
            remove.connect('clicked', () => {
                group.remove(row);
                bindings.splice(bindings.indexOf(binding), 1);
                persist();
            });
        };

        const add = new Gtk.Button({icon_name: Icon.ADD, valign: Gtk.Align.CENTER});
        add.add_css_class('flat');
        add.connect('clicked', () => {
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
