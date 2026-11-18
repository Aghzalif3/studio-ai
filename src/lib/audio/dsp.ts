// Tiny DSP toolkit (pure TypeScript): oscillators, envelopes, filters, reverb, WAV encoding.
// Sound-design ideas inspired by Lemo-Opuscar core/audio/sfx.py (MIT); this is an independent implementation.
export const SR = 44100;

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  noise() { return this.next() * 2 - 1; }
  pick<T>(a: T[]) { return a[Math.floor(this.next() * a.length)]; }
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Stereo {
  L: Float32Array; R: Float32Array;
  constructor(public length: number) { this.L = new Float32Array(length); this.R = new Float32Array(length); }
  add(mono: Float32Array, at: number, gain = 1, pan = 0) {
    const i0 = Math.round(at * SR);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < mono.length; i++) { const j = i0 + i; if (j < 0) continue; if (j >= this.length) break; this.L[j] += mono[i] * gl; this.R[j] += mono[i] * gr; }
  }
  addStereo(o: Stereo, gain = 1) { for (let i = 0; i < Math.min(this.length, o.length); i++) { this.L[i] += o.L[i] * gain; this.R[i] += o.R[i] * gain; } }
}

/** One-pole lowpass state-variable filter (TPT SVF), cutoff may vary per sample. */
export function svfLow(x: Float32Array, cutoff: (i: number) => number, q = 0.7) {
  let ic1 = 0, ic2 = 0; const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const g = Math.tan((Math.PI * Math.min(cutoff(i), SR * 0.45)) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; y[i] = v2;
  }
  return y;
}
export function svfHigh(x: Float32Array, cutoff: number, q = 0.7) {
  const lp = svfLow(x, () => cutoff, q); const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] - lp[i];
  return y;
}
export function svfBand(x: Float32Array, cutoff: (i: number) => number, q = 2) {
  let ic1 = 0, ic2 = 0; const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const g = Math.tan((Math.PI * Math.min(cutoff(i), SR * 0.45)) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; y[i] = v1;
  }
  return y;
}

export function adsr(n: number, a: number, d: number, s: number, r: number, holdSec: number) {
  const e = new Float32Array(n);
  const A = a * SR, D = d * SR, H = holdSec * SR, R = r * SR;
  for (let i = 0; i < n; i++) {
    let v: number;
    if (i < A) v = i / Math.max(1, A);
    else if (i < A + D) v = 1 - (1 - s) * ((i - A) / Math.max(1, D));
    else if (i < H) v = s;
    else v = s * Math.max(0, 1 - (i - H) / Math.max(1, R));
    e[i] = v;
  }
  return e;
}

export type Wave = 'sine' | 'saw' | 'square' | 'tri';
export function osc(wave: Wave, freq: number, n: number, phase = 0, detune = 0) {
  const y = new Float32Array(n), f = freq * Math.pow(2, detune / 1200);
  let p = phase;
  for (let i = 0; i < n; i++) {
    p += f / SR; p -= Math.floor(p);
    y[i] = wave === 'sine' ? Math.sin(2 * Math.PI * p) : wave === 'saw' ? 2 * p - 1 : wave === 'square' ? (p < 0.5 ? 1 : -1) : 1 - 4 * Math.abs(p - 0.5);
  }
  return y;
}

export function mulEnv(x: Float32Array, e: Float32Array) { for (let i = 0; i < x.length; i++) x[i] *= e[i] ?? 0; return x; }
export function sum(...xs: Float32Array[]) { const n = Math.max(...xs.map((x) => x.length)); const y = new Float32Array(n); for (const x of xs) for (let i = 0; i < x.length; i++) y[i] += x[i]; return y; }
export function scale(x: Float32Array, g: number) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
export function noise(n: number, rng: Rng) { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = rng.noise(); return y; }

/** Karplus-Strong plucked string. */
export function pluck(freq: number, dur: number, rng: Rng, bright = 0.5) {
  const n = Math.round(dur * SR), N = Math.max(2, Math.round(SR / freq)), buf = new Float32Array(N), y = new Float32Array(n);
  for (let i = 0; i < N; i++) buf[i] = rng.noise();
  let idx = 0; const damp = 0.996 - (1 - bright) * 0.01;
  for (let i = 0; i < n; i++) { const a = buf[idx], b = buf[(idx + 1) % N]; const v = (a + b) * 0.5 * damp; buf[idx] = v; y[i] = a; idx = (idx + 1) % N; }
  const tail = Math.min(n, Math.round(0.03 * SR)); for (let i = 0; i < tail; i++) y[n - 1 - i] *= i / tail;
  return y;
}

/** FM bell / electric piano. */
export function fm(freq: number, dur: number, ratio = 3.5, index = 2.5, decay = 1.2) {
  const n = Math.round(dur * SR), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.exp(-t / decay), ei = Math.exp(-t / (decay * 0.4));
    y[i] = Math.sin(2 * Math.PI * freq * t + index * ei * Math.sin(2 * Math.PI * freq * ratio * t)) * e * Math.min(1, t * 400);
  }
  return y;
}

/** Freeverb-style stereo reverb (8 combs + 4 allpass per side). */
export function reverb(input: Stereo, room = 0.82, damp = 0.3, wet = 0.3) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  const out = new Stereo(input.length);
  for (const side of [0, 1] as const) {
    const x = side ? input.R : input.L, y = side ? out.R : out.L, spread = side ? 23 : 0;
    const cb = combs.map((c) => ({ buf: new Float32Array(c + spread), i: 0, store: 0 }));
    const ab = aps.map((a) => ({ buf: new Float32Array(a + spread), i: 0 }));
    for (let n = 0; n < x.length; n++) {
      const inp = x[n] * 0.015; let acc = 0;
      for (const c of cb) { const o = c.buf[c.i]; c.store = o * (1 - damp) + c.store * damp; c.buf[c.i] = inp + c.store * room; c.i = (c.i + 1) % c.buf.length; acc += o; }
      for (const a of ab) { const b = a.buf[a.i]; const o = -acc + b; a.buf[a.i] = acc + b * 0.5; a.i = (a.i + 1) % a.buf.length; acc = o; }
      y[n] = acc * wet * 3;
    }
  }
  return out;
}

export function normalize(s: Stereo, peak = 0.89) {
  let m = 0; for (let i = 0; i < s.length; i++) m = Math.max(m, Math.abs(s.L[i]), Math.abs(s.R[i]));
  if (m > 0) { const g = peak / m; for (let i = 0; i < s.length; i++) { s.L[i] *= g; s.R[i] *= g; } }
  return s;
}
export function softClip(s: Stereo) { for (let i = 0; i < s.length; i++) { s.L[i] = Math.tanh(s.L[i]); s.R[i] = Math.tanh(s.R[i]); } return s; }

export function encodeWav(s: Stereo | Float32Array, sr = SR): Buffer {
  const stereo = s instanceof Stereo;
  const ch = stereo ? 2 : 1, n = stereo ? s.length : s.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    if (stereo) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.L[i])) * 32767), o); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.R[i])) * 32767), o + 2); o += 4; }
    else { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (s as Float32Array)[i])) * 32767), o); o += 2; }
  }
  return buf;
}
