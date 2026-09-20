import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {Key, Case, Corner, Layout, Mode, Click, Slots, Functions} from './lib/settings.js';

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
    ROUNDED_ROW: 'Keyboard corners',
    ROUNDED_SUBTITLE: 'Round the keyboard’s top corners',
    HEIGHT_ROW: 'Height',
    HEIGHT_SUBTITLE: 'Percent of the shorter screen edge',
    SPACING_ROW: 'Key spacing',
    SPACING_SUBTITLE: 'Gap between keys, percent of default',
    GLYPH_ROW: 'Font size',
    GLYPH_SUBTITLE: 'Key glyph font size, percent of default',
    BEHAVIOUR: 'Behaviour',
    MODE_ROW: 'Modifier keys',
    MODE_SUBTITLE: 'How the modifier keys and Fn respond to a tap',
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
    FUNCTION_HINT: 'Reassign F1-F12 to standard functions',
    OVERRIDES_ROW: 'Overrides',
    DEFAULT: 'Default',
});

const Cases = Object.freeze([
    {id: Case.LOWER, name: 'lowercase'},
    {id: Case.TITLE, name: 'Titlecase'},
    {id: Case.UPPER, name: 'UPPERCASE'},
]);

const Corners = Object.freeze([
    {id: Corner.SHARP, name: 'Sharp'},
    {id: Corner.SOFT, name: 'Soft'},
    {id: Corner.ROUND, name: 'Round'},
]);

const Layouts = Object.freeze([
    {id: Layout.COMPACT, name: '60% compact'},
    {id: Layout.STANDARD, name: '75% standard'},
    {id: Layout.FULL, name: '100% full'},
]);

const Modes = Object.freeze([
    {id: Mode.HOLD, name: 'Hold'},
    {id: Mode.LATCH, name: 'Latch'},
    {id: Mode.TOGGLE, name: 'Toggle'},
]);

const Clicks = Object.freeze([
    {id: Click.THOCK, name: 'Thock'},
    {id: Click.CLICK, name: 'Click'},
    {id: Click.TAP, name: 'Tap'},
    {id: Click.POP, name: 'Pop'},
]);

const Icon = Object.freeze({PAGE: 'preferences-desktop-keyboard-symbolic'});

const Property = Object.freeze({
    ACTIVE: 'active',
    VALUE: 'value',
    SENSITIVE: 'sensitive',
});

const Signal = Object.freeze({
    CHANGED: 'changed::',
    CLOSE: 'close-request',
    SELECTED: 'notify::selected',
    FONT: 'notify::font-desc',
    RGBA: 'notify::rgba',
});

export default class TouchBoardPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const ids = [];
        const watch = (key, sync) => {
            ids.push(settings.connect(`${Signal.CHANGED}${key}`, sync));
            sync();
        };
        window.connect(Signal.CLOSE, () => ids.forEach(id => settings.disconnect(id)));

        const page = new Adw.PreferencesPage({title: Label.PAGE, icon_name: Icon.PAGE});
        page.add(this._appearance(settings, watch));
        page.add(this._behaviour(settings, watch));
        page.add(this._sound(settings, watch));
        page.add(this._functionRow(settings, watch));
        window.add(page);
    }

    _appearance(settings, watch) {
        const group = new Adw.PreferencesGroup({title: Label.APPEARANCE});
        group.add(this._combo(settings, watch, Key.LAYOUT, Label.LAYOUT_ROW, Label.LAYOUT_SUBTITLE, Layouts));
        group.add(this._spin(settings, Key.HEIGHT, Label.HEIGHT_ROW, Label.HEIGHT_SUBTITLE, 1, 5));
        group.add(this._spin(settings, Key.SPACING, Label.SPACING_ROW, Label.SPACING_SUBTITLE, 1, 5));
        group.add(this._spin(settings, Key.GLYPH_SIZE, Label.GLYPH_ROW, Label.GLYPH_SUBTITLE, 1, 5));
        group.add(this._font(settings, watch));
        group.add(this._combo(settings, watch, Key.CASE, Label.CASE_ROW, Label.CASE_SUBTITLE, Cases));
        group.add(this._combo(settings, watch, Key.CORNER, Label.CORNER_ROW, Label.CORNER_SUBTITLE, Corners));
        group.add(this._switch(settings, Key.ROUNDED, Label.ROUNDED_ROW, Label.ROUNDED_SUBTITLE));
        group.add(this._color(settings, watch));
        return group;
    }

    _font(settings, watch) {
        const button = new Gtk.FontDialogButton({
            dialog: new Gtk.FontDialog(),
            level: Gtk.FontLevel.FAMILY,
            valign: Gtk.Align.CENTER,
        });

        watch(Key.FONT, () => {
            const family = settings.get_string(Key.FONT);
            if (!family)
                return;
            const desc = new Pango.FontDescription();
            desc.set_family(family);
            button.set_font_desc(desc);
        });
        button.connect(Signal.FONT, () => {
            settings.set_string(Key.FONT, button.get_font_desc().get_family());
        });

        const row = new Adw.ActionRow({title: Label.FONT_ROW, subtitle: Label.FONT_SUBTITLE});
        row.add_suffix(button);
        row.activatable_widget = button;
        return row;
    }

    _behaviour(settings, watch) {
        const group = new Adw.PreferencesGroup({title: Label.BEHAVIOUR});
        group.add(this._combo(settings, watch, Key.MODE, Label.MODE_ROW, Label.MODE_SUBTITLE, Modes));
        group.add(this._switch(settings, Key.ACCENTS, Label.ACCENTS_ROW, Label.ACCENTS_SUBTITLE));
        return group;
    }

    _sound(settings, watch) {
        const group = new Adw.PreferencesGroup({title: Label.SOUND});
        const variant = this._combo(settings, watch, Key.SOUND, Label.VARIANT_ROW, Label.VARIANT_SUBTITLE, Clicks);
        const volume = this._spin(settings, Key.VOLUME, Label.VOLUME_ROW, Label.VOLUME_SUBTITLE, 5, 10);
        settings.bind(Key.CLICK, variant, Property.SENSITIVE, Gio.SettingsBindFlags.GET);
        settings.bind(Key.CLICK, volume, Property.SENSITIVE, Gio.SettingsBindFlags.GET);

        group.add(this._switch(settings, Key.CLICK, Label.CLICK_ROW, Label.CLICK_SUBTITLE));
        group.add(variant);
        group.add(volume);
        return group;
    }

    _combo(settings, watch, key, title, subtitle, entries) {
        const row = new Adw.ComboRow({
            title,
            subtitle,
            model: Gtk.StringList.new(entries.map(entry => entry.name)),
        });
        watch(key, () => {
            const current = settings.get_string(key);
            row.set_selected(entries.findIndex(entry => entry.id === current));
        });
        row.connect(Signal.SELECTED, () => settings.set_string(key, entries[row.get_selected()].id));
        return row;
    }

    _spin(settings, key, title, subtitle, step, page) {
        const [, [lower, upper]] = settings.settings_schema.get_key(key).get_range().recursiveUnpack();
        const row = new Adw.SpinRow({
            title,
            subtitle,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: page}),
        });
        settings.bind(key, row, Property.VALUE, Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _switch(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, Property.ACTIVE, Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _color(settings, watch) {
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({with_alpha: false}),
            valign: Gtk.Align.CENTER,
        });

        watch(Key.COLOR, () => {
            const rgba = new Gdk.RGBA();
            if (rgba.parse(settings.get_string(Key.COLOR)))
                button.set_rgba(rgba);
        });
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

    _functionRow(settings, watch) {
        const group = new Adw.PreferencesGroup({
            title: Label.FUNCTION_GROUP,
            description: Label.FUNCTION_HINT,
        });
        const expander = new Adw.ExpanderRow({title: Label.OVERRIDES_ROW});
        group.add(expander);

        const names = [Label.DEFAULT, ...Functions.map(entry => entry.name)];
        const rows = Slots.map(slot => {
            const row = new Adw.ComboRow({title: slot.label, model: Gtk.StringList.new(names)});
            expander.add_row(row);
            return row;
        });

        watch(Key.FKEYS, () => {
            const stored = settings.get_value(Key.FKEYS).deep_unpack();
            Slots.forEach((slot, i) => rows[i].set_selected(Functions.findIndex(entry => entry.id === stored[slot.id]) + 1));
        });

        Slots.forEach((slot, i) => rows[i].connect(Signal.SELECTED, () => {
            const stored = settings.get_value(Key.FKEYS).deep_unpack();
            const index = rows[i].get_selected();
            const id = index === 0 ? undefined : Functions[index - 1].id;
            if (stored[slot.id] === id)
                return;
            if (id)
                stored[slot.id] = id;
            else
                delete stored[slot.id];
            settings.set_value(Key.FKEYS, new GLib.Variant('a{ss}', stored));
        }));

        return group;
    }
}
