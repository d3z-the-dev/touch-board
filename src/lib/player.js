import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Key} from './settings.js';
import {Voices, synthesise, encode} from './sound.js';

const Cache = Object.freeze({DIR: 'touch-board', STEM: 'click', EXTENSION: 'wav'});

const Role = Object.freeze({CLICK: 'Touch Board key click'});

const Signal = Object.freeze({
    SOUND: `changed::${Key.SOUND}`,
    VOLUME: `changed::${Key.VOLUME}`,
});

const Take = Object.freeze({COUNT: 4});

export class Player {
    constructor(settings) {
        this._settings = settings;
        this._sound = global.display.get_sound_player();
        this._cancellable = new Gio.Cancellable();
        this._directory = GLib.build_filenamev([GLib.get_user_cache_dir(), Cache.DIR]);
        this._files = Array.from({length: Take.COUNT}, (_, take) =>
            Gio.File.new_for_path(GLib.build_filenamev([this._directory, `${Cache.STEM}-${take}.${Cache.EXTENSION}`])));
        this._take = 0;
        this._ready = false;
        this._ids = [
            settings.connect(Signal.SOUND, () => this._prepare()),
            settings.connect(Signal.VOLUME, () => this._prepare()),
        ];
        this._prepare();
    }

    _prepare() {
        const volume = this._settings.get_int(Key.VOLUME);
        this._ready = volume > 0 && this._render(Voices[this._settings.get_string(Key.SOUND)], volume / 100);
    }

    click() {
        if (!this._ready || !this._settings.get_boolean(Key.CLICK))
            return;
        this._take = (this._take + GLib.random_int_range(1, Take.COUNT)) % Take.COUNT;
        this._sound.play_from_file(this._files[this._take], Role.CLICK, this._cancellable);
    }

    _render(voice, volume) {
        if (GLib.mkdir_with_parents(this._directory, 0o755) !== 0)
            return false;
        try {
            this._files.forEach((file, take) => file.replace_contents(encode(synthesise(voice, volume, take)),
                null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null));
            return true;
        } catch (error) {
            console.error(`touch-board: failed to write the click cache: ${error}`);
            return false;
        }
    }

    destroy() {
        for (const id of this._ids)
            this._settings.disconnect(id);
        this._cancellable.cancel();
    }
}
