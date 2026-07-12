import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Key, Click} from './settings.js';

/** @typedef {import('gi://Gio').default.Settings} Settings */

const Cache = Object.freeze({DIR: 'touch-board', FILE: 'click.wav'});

const Role = Object.freeze({CLICK: 'Touch Board key click'});

const Audio = Object.freeze({RATE: 44100, PEAK: 0.9, BITS: 16, CHANNELS: 1});

/** @typedef {{freq: number, glide: number, tau: number, gain: number}} Body */
/** @typedef {{freq: number, tau: number, gain: number}} Knock */
/** @typedef {{tau: number, gain: number}} Noise */
/** @typedef {{body: Body, knock: Knock, noise: Noise, cutoff: number}} Voice */
/** @type {Readonly<Record<string, Voice>>} */
const Voices = Object.freeze({
    [Click.THOCK]: {
        body: {freq: 200, glide: -20, tau: 0.009, gain: 1},
        knock: {freq: 600, tau: 0.0025, gain: 0.25},
        noise: {tau: 0.002, gain: 0.08},
        cutoff: 1800,
    },
    [Click.CLICK]: {
        body: {freq: 320, glide: 0, tau: 0.003, gain: 0.5},
        knock: {freq: 0, tau: 0.002, gain: 0},
        noise: {tau: 0.004, gain: 0.6},
        cutoff: 2200,
    },
    [Click.TAP]: {
        body: {freq: 560, glide: 0, tau: 0.004, gain: 0.9},
        knock: {freq: 1200, tau: 0.002, gain: 0.4},
        noise: {tau: 0.0025, gain: 0.14},
        cutoff: 5200,
    },
    [Click.POP]: {
        body: {freq: 820, glide: 0, tau: 0.006, gain: 1},
        knock: {freq: 0, tau: 0.002, gain: 0},
        noise: {tau: 0.004, gain: 0.05},
        cutoff: 4200,
    },
});

const Length = Object.freeze({TAILS: 6, MIN: 0.016, MAX: 0.045});

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 * @returns {number}
 */
function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}

export class Player {
    /** @param {Settings} settings */
    constructor(settings) {
        this._settings = settings;
        this._sound = global.display.get_sound_player();
        this._cancellable = new Gio.Cancellable();
        this._path = GLib.build_filenamev([GLib.get_user_cache_dir(), Cache.DIR, Cache.FILE]);
        /** @type {string | null} */
        this._signature = null;
    }

    click() {
        const settings = this._settings;
        if (!settings.get_boolean(Key.CLICK))
            return;
        const volume = settings.get_int(Key.VOLUME);
        if (volume <= 0)
            return;
        const variant = settings.get_string(Key.SOUND);
        const signature = `${variant}:${volume}`;
        if (signature !== this._signature) {
            if (!this._render(variant, volume / 100))
                return;
            this._signature = signature;
        }
        /** @type {any} */ (this._sound).play_from_file(Gio.File.new_for_path(this._path), Role.CLICK, this._cancellable);
    }

    /**
     * @param {string} variant
     * @param {number} volume
     * @returns {boolean}
     */
    _render(variant, volume) {
        const voice = Voices[variant];
        const bytes = this._encode(this._synthesise(voice, volume));
        const directory = GLib.path_get_dirname(this._path);
        if (GLib.mkdir_with_parents(directory, 0o755) !== 0)
            return false;
        try {
            const file = Gio.File.new_for_path(this._path);
            file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            return true;
        } catch (error) {
            console.error(`touch-board: failed to write the click cache: ${error}`);
            return false;
        }
    }

    /**
     * @param {Voice} voice
     * @param {number} volume
     * @returns {Int16Array}
     */
    _synthesise(voice, volume) {
        const rate = Audio.RATE;
        const step = 1 / rate;
        const {body, knock, noise} = voice;
        const tau = Math.max(body.tau, knock.gain > 0 ? knock.tau : 0, noise.gain > 0 ? noise.tau : 0);
        const duration = clamp(tau * Length.TAILS, Length.MIN, Length.MAX);
        const count = Math.round(rate * duration);
        const raw = new Float64Array(count);
        const rc = 1 / (2 * Math.PI * voice.cutoff);
        const alpha = step / (rc + step);
        let bodyPhase = 0;
        let knockPhase = 0;
        let low = 0;
        let peak = 0;
        for (let index = 0; index < count; index++) {
            const time = index * step;
            const bodyFreq = body.freq + body.glide * (time / duration);
            let value = body.gain * Math.exp(-time / body.tau) * Math.sin(bodyPhase);
            bodyPhase += 2 * Math.PI * bodyFreq * step;
            if (knock.gain > 0) {
                value += knock.gain * Math.exp(-time / knock.tau) * Math.sin(knockPhase);
                knockPhase += 2 * Math.PI * knock.freq * step;
            }
            if (noise.gain > 0)
                value += noise.gain * Math.exp(-time / noise.tau) * (Math.random() * 2 - 1);
            low += alpha * (value - low);
            raw[index] = low;
            peak = Math.max(peak, Math.abs(low));
        }
        const gain = (peak > 0 ? Audio.PEAK / peak : 0) * volume;
        const samples = new Int16Array(count);
        for (let index = 0; index < count; index++)
            samples[index] = clamp(Math.round(raw[index] * gain * 32767), -32768, 32767);
        return samples;
    }

    /**
     * @param {Int16Array} samples
     * @returns {Uint8Array}
     */
    _encode(samples) {
        const dataSize = samples.length * (Audio.BITS / 8);
        const byteRate = Audio.RATE * Audio.CHANNELS * (Audio.BITS / 8);
        const blockAlign = Audio.CHANNELS * (Audio.BITS / 8);
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const tag = (/** @type {number} */ offset, /** @type {string} */ text) => {
            for (let index = 0; index < text.length; index++)
                view.setUint8(offset + index, text.charCodeAt(index));
        };
        tag(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        tag(8, 'WAVE');
        tag(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, Audio.CHANNELS, true);
        view.setUint32(24, Audio.RATE, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, Audio.BITS, true);
        tag(36, 'data');
        view.setUint32(40, dataSize, true);
        for (let index = 0; index < samples.length; index++)
            view.setInt16(44 + index * 2, samples[index], true);
        return new Uint8Array(buffer);
    }

    destroy() {
        this._cancellable.cancel();
    }
}
