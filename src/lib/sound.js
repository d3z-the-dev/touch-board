import {Click} from './settings.js';

export const Audio = Object.freeze({RATE: 44100, BITS: 16, CHANNELS: 1, PEAK: 0.9});

const Spread = Object.freeze({PITCH: 0.03, DECAY: 0.1, GAIN: 0.12, CONTACT: 0.15});

const Filter = Object.freeze({DC: 40, Q: Math.SQRT1_2, FADE: 0.004, AIR: 0.25});

export const Voices = Object.freeze({
    [Click.THOCK]: {
        contact: 0.0005,
        noise: {gain: 0.6, tau: 0.0012, direct: 0.12},
        modes: [
            {freq: 230, tau: 0.007, gain: 0.8},
            {freq: 560, tau: 0.0055, gain: 1},
            {freq: 1250, tau: 0.003, gain: 1},
            {freq: 2600, tau: 0.0014, gain: 0.6},
        ],
        cutoff: 5000,
        length: 0.055,
        level: 1,
    },
    [Click.CLICK]: {
        contact: 0.0001,
        noise: {gain: 0.6, tau: 0.0005, direct: 0.5},
        modes: [
            {freq: 640, tau: 0.003, gain: 0.25},
            {freq: 2100, tau: 0.003, gain: 1},
            {freq: 3600, tau: 0.0014, gain: 0.6},
            {freq: 5600, tau: 0.0008, gain: 0.35},
        ],
        cutoff: 9000,
        length: 0.032,
        level: 0.8,
    },
    [Click.TAP]: {
        contact: 0.0003,
        noise: {gain: 0.4, tau: 0.0009, direct: 0.2},
        modes: [
            {freq: 340, tau: 0.0065, gain: 0.7},
            {freq: 880, tau: 0.0045, gain: 1},
            {freq: 1750, tau: 0.0026, gain: 0.6},
            {freq: 3100, tau: 0.0012, gain: 0.3},
        ],
        cutoff: 6000,
        length: 0.045,
        level: 0.95,
    },
});

function generator(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
}

function biquad(samples, coefficients) {
    const [b0, b1, b2, a1, a2] = coefficients;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let index = 0; index < samples.length; index++) {
        const x = samples[index];
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        samples[index] = y;
    }
}

function pass(cutoff, high) {
    const omega = 2 * Math.PI * cutoff / Audio.RATE;
    const alpha = Math.sin(omega) / (2 * Filter.Q);
    const cos = Math.cos(omega);
    const norm = 1 + alpha;
    const edge = high ? (1 + cos) / 2 : (1 - cos) / 2;
    const middle = high ? -(1 + cos) : 1 - cos;
    return [edge / norm, middle / norm, edge / norm, -2 * cos / norm, (1 - alpha) / norm];
}

export function synthesise(voice, volume, seed) {
    const random = generator(seed);
    const jitter = spread => 1 + spread * (random() * 2 - 1);
    const count = Math.round(voice.length * Audio.RATE);
    const width = Math.max(2, Math.round(voice.contact * jitter(Spread.CONTACT) * Audio.RATE));
    const attack = width / 2;
    const noiseTau = voice.noise.tau * Audio.RATE;
    const drive = new Float64Array(count);
    const air = new Float64Array(count);
    for (let index = 0; index < count; index++) {
        const pulse = index < width ? (1 - Math.cos(2 * Math.PI * index / width)) / width : 0;
        const envelope = (1 - Math.exp(-index / attack)) * Math.exp(-index / noiseTau) * (random() * 2 - 1);
        drive[index] = pulse + voice.noise.gain * envelope / width;
        air[index] = voice.noise.direct * envelope;
    }
    const mix = new Float64Array(count);
    for (const mode of voice.modes) {
        const omega = 2 * Math.PI * mode.freq * jitter(Spread.PITCH) / Audio.RATE;
        const radius = Math.exp(-1 / (mode.tau * jitter(Spread.DECAY) * Audio.RATE));
        const a1 = 2 * radius * Math.cos(omega);
        const a2 = radius * radius;
        const gain = mode.gain * jitter(Spread.GAIN) * Math.sin(omega);
        let y1 = 0, y2 = 0;
        for (let index = 0; index < count; index++) {
            const y = gain * drive[index] + a1 * y1 - a2 * y2;
            y2 = y1;
            y1 = y;
            mix[index] += y;
        }
    }
    biquad(air, pass(voice.cutoff * Filter.AIR, true));
    for (let index = 0; index < count; index++)
        mix[index] += air[index];
    biquad(mix, pass(voice.cutoff, false));
    biquad(mix, pass(Filter.DC, true));
    const fade = Math.round(Filter.FADE * Audio.RATE);
    let peak = 0;
    for (let index = 0; index < count; index++) {
        const tail = count - 1 - index;
        if (tail < fade)
            mix[index] *= (1 - Math.cos(Math.PI * tail / fade)) / 2;
        peak = Math.max(peak, Math.abs(mix[index]));
    }
    const scale = peak > 0 ? Audio.PEAK * voice.level * volume / peak : 0;
    const samples = new Int16Array(count);
    for (let index = 0; index < count; index++)
        samples[index] = Math.round(mix[index] * scale * 32767);
    return samples;
}

export function encode(samples) {
    const width = Audio.BITS / 8;
    const size = samples.length * width;
    const view = new DataView(new ArrayBuffer(44 + size));
    const tag = (offset, text) => {
        for (let index = 0; index < text.length; index++)
            view.setUint8(offset + index, text.charCodeAt(index));
    };
    tag(0, 'RIFF');
    view.setUint32(4, 36 + size, true);
    tag(8, 'WAVE');
    tag(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, Audio.CHANNELS, true);
    view.setUint32(24, Audio.RATE, true);
    view.setUint32(28, Audio.RATE * Audio.CHANNELS * width, true);
    view.setUint16(32, Audio.CHANNELS * width, true);
    view.setUint16(34, Audio.BITS, true);
    tag(36, 'data');
    view.setUint32(40, size, true);
    for (let index = 0; index < samples.length; index++)
        view.setInt16(44 + index * width, samples[index], true);
    return new Uint8Array(view.buffer);
}
