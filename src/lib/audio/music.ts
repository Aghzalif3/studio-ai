// Procedural music generator: original, royalty-free scores built from a mood, a seed and a target duration.
import type { MusicMood } from '../types';
import { SR, Rng, Stereo, adsr, encodeWav, fm, mtof, mulEnv, noise, normalize, osc, pluck, reverb, scale, softClip, sum, svfHigh, svfLow } from './dsp';

interface MoodDef {
  bpm: number; minor: boolean; progressions: number[][]; drums: 'none' | 'four' | 'pop' | 'lofi' | 'epic' | 'soft';
  pad: boolean; bass: 'none' | 'sub' | 'eighths' | 'pulse'; arp: 'none' | 'pluck' | 'saw16' | 'bell' | 'ep'; swing: number; label: { fr: string; en: string };
}

export const MOODS: Record<Exclude<MusicMood, 'none'>, MoodDef> = {
  cinematic: { bpm: 78, minor: true, progressions: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 3, 0, 4]], drums: 'epic', pad: true, bass: 'sub', arp: 'pluck', swing: 0, label: { fr: 'Cinématique', en: 'Cinematic' } },
  ambient: { bpm: 68, minor: false, progressions: [[0, 3, 5, 3], [0, 4, 5, 3], [3, 0, 4, 5]], drums: 'none', pad: true, bass: 'sub', arp: 'bell', swing: 0, label: { fr: 'Ambiance', en: 'Ambient' } },
  upbeat: { bpm: 118, minor: false, progressions: [[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4]], drums: 'pop', pad: false, bass: 'eighths', arp: 'pluck', swing: 0, label: { fr: 'Publicité dynamique', en: 'Upbeat ad' } },
  electronic: { bpm: 122, minor: true, progressions: [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 6, 4]], drums: 'four', pad: true, bass: 'pulse', arp: 'saw16', swing: 0, label: { fr: 'Électronique', en: 'Electronic' } },
  corporate: { bpm: 104, minor: false, progressions: [[0, 4, 5, 3], [3, 4, 0, 5], [0, 3, 4, 4]], drums: 'soft', pad: true, bass: 'eighths', arp: 'pluck', swing: 0, label: { fr: 'Entreprise', en: 'Corporate' } },
  lofi: { bpm: 80, minor: false, progressions: [[1, 4, 0, 5], [3, 2, 1, 0], [0, 5, 1, 4]], drums: 'lofi', pad: false, bass: 'sub', arp: 'ep', swing: 0.18, label: { fr: 'Lo-fi chill', en: 'Lo-fi chill' } },
  epic: { bpm: 92, minor: true, progressions: [[0, 5, 6, 4], [0, 6, 5, 4], [5, 6, 0, 0]], drums: 'epic', pad: true, bass: 'pulse', arp: 'saw16', swing: 0, label: { fr: 'Épique', en: 'Epic' } },
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];

function chord(root: number, degree: number, minor: boolean, seventh = false) {
  const sc = minor ? MINOR : MAJOR;
  const note = (d: number) => root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const c = [note(degree), note(degree + 2), note(degree + 4)];
  if (seventh) c.push(note(degree + 6));
  return c;
}

// ——— drum voices
function kick(rng: Rng, hard = 1) {
  const n = Math.round(0.45 * SR), y = new Float32Array(n); let p = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; const f = 45 + 110 * Math.exp(-t * 28); p += f / SR; y[i] = Math.sin(2 * Math.PI * p) * Math.exp(-t * 7) * hard; }
  const click = svfHigh(noise(400, rng), 2000); for (let i = 0; i < click.length; i++) y[i] += click[i] * 0.15 * Math.exp(-i / 60);
  return y;
}
function snare(rng: Rng, tone = 190) {
  const n = Math.round(0.28 * SR), nz = svfHigh(noise(n, rng), 1200), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = nz[i] * Math.exp(-t * 16) * 0.7 + Math.sin(2 * Math.PI * tone * t) * Math.exp(-t * 25) * 0.5; }
  return y;
}
function clap(rng: Rng) {
  const n = Math.round(0.25 * SR), nz = svfLow(svfHigh(noise(n, rng), 900), () => 3500), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; const bursts = t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.6 : 1) : 1; y[i] = nz[i] * Math.exp(-t * 18) * bursts; }
  return y;
}
function hat(rng: Rng, open = false) {
  const n = Math.round((open ? 0.25 : 0.06) * SR), nz = svfHigh(noise(n, rng), 7000), y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = nz[i] * Math.exp(-(i / SR) * (open ? 12 : 60)) * 0.5;
  return y;
}
function tom(rng: Rng, f0 = 90) {
  const n = Math.round(0.7 * SR), y = new Float32Array(n); let p = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; p += (f0 + 60 * Math.exp(-t * 10)) / SR; y[i] = Math.sin(2 * Math.PI * p) * Math.exp(-t * 4); }
  const nz = svfLow(noise(n, rng), () => 900); for (let i = 0; i < n; i++) y[i] += nz[i] * 0.3 * Math.exp(-(i / SR) * 9);
  return y;
}

function padVoice(notes: number[], dur: number, bright: number) {
  const n = Math.round(dur * SR);
  const parts = notes.flatMap((m) => [osc('saw', mtof(m), n, Math.random() * 0.01, -7), osc('saw', mtof(m), n, 0.3, 7), scale(osc('sine', mtof(m - 12), n), 0.6)]);
  const raw = scale(sum(...parts), 0.12);
  const f = svfLow(raw, (i) => 600 + bright * 1400 + 400 * Math.sin((i / SR) * 0.5));
  return mulEnv(f, adsr(n, Math.min(1.2, dur * 0.35), 0.5, 0.85, Math.min(1.2, dur * 0.3), dur - Math.min(1.2, dur * 0.3)));
}

export interface MusicOptions { mood: Exclude<MusicMood, 'none'>; duration: number; seed: number; intensity?: number }

export function generateMusic(o: MusicOptions): Stereo {
  const m = MOODS[o.mood], rng = new Rng(o.seed), dur = Math.max(3, o.duration);
  const beat = 60 / m.bpm, bar = beat * 4;
  const out = new Stereo(Math.round((dur + 2.5) * SR));
  const dry = new Stereo(out.length), send = new Stereo(out.length);
  const root = 48 + rng.pick([0, 2, 3, 5, 7, -2]);
  const prog = rng.pick(m.progressions);
  const nBars = Math.ceil(dur / bar);
  const introBars = nBars >= 6 ? 2 : nBars >= 3 ? 1 : 0;
  const outroStart = Math.max(introBars + 1, nBars - 1);
  const swing = (k: number) => (k % 2 ? m.swing * beat * 0.5 : 0);

  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar, deg = prog[b % prog.length];
    const ch = chord(root, deg, m.minor, m.arp === 'ep' || o.mood === 'ambient');
    const section = b < introBars ? 'intro' : b >= outroStart ? 'outro' : 'main';
    const energy = section === 'intro' ? 0.5 : section === 'outro' ? 0.6 : 1;
    // Pad
    if (m.pad) { const p = padVoice(ch.map((x) => x + 12), bar + 0.6, section === 'main' ? 0.7 : 0.35); dry.add(p, t0, 0.55 * energy, 0); send.add(p, t0, 0.5); }
    // Bass
    if (m.bass !== 'none' && section !== 'intro') {
      const bn = ch[0] - 12;
      if (m.bass === 'sub') { const n = Math.round(bar * SR); const s = mulEnv(sum(osc('sine', mtof(bn), n), scale(osc('tri', mtof(bn + 12), n), 0.15)), adsr(n, 0.02, 0.3, 0.8, 0.3, bar - 0.3)); dry.add(s, t0, 0.5); }
      else {
        const steps = m.bass === 'pulse' ? 8 : 8;
        for (let k = 0; k < steps; k++) {
          const len = beat / 2, n = Math.round(len * SR);
          const note = m.bass === 'eighths' && k % 4 === 3 ? bn + 7 : bn;
          const s = svfLow(sum(osc('saw', mtof(note), n), scale(osc('square', mtof(note), n), 0.4)), (i) => 300 + 1800 * Math.exp(-i / (SR * 0.05)));
          dry.add(mulEnv(s, adsr(n, 0.005, 0.08, 0.6, 0.04, len * 0.8)), t0 + k * len + swing(k), 0.32);
        }
      }
    }
    // Melodic layer
    if (m.arp !== 'none') {
      const notes = [...ch, ch[0] + 12, ch[1] + 12];
      if (m.arp === 'pluck') {
        const steps = section === 'intro' ? 4 : 8;
        for (let k = 0; k < steps; k++) { const note = notes[(k * 2 + b) % notes.length] + 12; const s = pluck(mtof(note), 1.2, rng, 0.6); const at = t0 + k * (bar / steps) + swing(k); dry.add(s, at, 0.28, k % 2 ? 0.35 : -0.35); send.add(s, at, 0.3); }
      } else if (m.arp === 'saw16') {
        if (section !== 'intro') for (let k = 0; k < 16; k++) {
          const len = beat / 4, n = Math.round(len * SR), note = notes[k % notes.length] + 12;
          const s = svfLow(sum(osc('saw', mtof(note), n, 0, -5), osc('saw', mtof(note), n, 0.2, 5)), (i) => 900 + 2500 * Math.exp(-i / (SR * 0.04)));
          const e = mulEnv(s, adsr(n, 0.003, 0.05, 0.4, 0.03, len * 0.7));
          dry.add(e, t0 + k * len, 0.12, Math.sin(k) * 0.5); send.add(e, t0 + k * len, 0.15);
        }
      } else if (m.arp === 'bell') {
        for (let k = 0; k < 4; k++) if (rng.next() > 0.3) { const note = notes[Math.floor(rng.next() * notes.length)] + 24; const s = fm(mtof(note), 3, 3.5, 2, 1.4); const at = t0 + k * beat; dry.add(s, at, 0.12, rng.noise() * 0.6); send.add(s, at, 0.45); }
      } else if (m.arp === 'ep') {
        const s = sum(...ch.map((nn) => fm(mtof(nn + 12), bar, 1, 1.2, 1.6)));
        dry.add(s, t0 + swing(1), 0.14); send.add(s, t0, 0.2);
        if (section === 'main') for (let k = 0; k < 3; k++) { const s2 = fm(mtof(notes[(k + b) % notes.length] + 24), 1.2, 1, 1, 0.6); dry.add(s2, t0 + (k * 1.5 + 0.5) * beat + swing(k), 0.08, 0.3); send.add(s2, t0 + (k * 1.5 + 0.5) * beat, 0.25); }
      }
    }
    // Drums
    if (section !== 'intro' && m.drums !== 'none') {
      const g = section === 'outro' ? 0.7 : 1;
      for (let k = 0; k < 8; k++) {
        const at = t0 + k * (beat / 2) + swing(k);
        if (m.drums === 'four') { if (k % 2 === 0) dry.add(kick(rng), at, 0.75 * g); if (k % 2 === 1) dry.add(hat(rng, k === 7), at, 0.35 * g, 0.2); if (k === 2 || k === 6) dry.add(clap(rng), at, 0.4 * g); }
        if (m.drums === 'pop') { if (k === 0 || k === 4 || (k === 5 && b % 2)) dry.add(kick(rng), at, 0.75 * g); if (k === 2 || k === 6) { const c = clap(rng); dry.add(c, at, 0.45 * g); send.add(c, at, 0.2); } dry.add(hat(rng), at, (k % 2 ? 0.3 : 0.18) * g, 0.25); }
        if (m.drums === 'soft') { if (k === 0 || k === 4) dry.add(kick(rng, 0.7), at, 0.6 * g); if (k === 2 || k === 6) dry.add(clap(rng), at, 0.25 * g); if (k % 2) dry.add(hat(rng), at, 0.15 * g, 0.3); }
        if (m.drums === 'lofi') { if (k === 0 || k === 5) dry.add(svfLow(kick(rng, 0.8), () => 900), at, 0.7 * g); if (k === 2 || k === 6) dry.add(svfLow(snare(rng), () => 3000), at, 0.4 * g); dry.add(svfLow(hat(rng), () => 6000), at, 0.12 * g, 0.2); }
        if (m.drums === 'epic') { if (k === 0) { const b2 = tom(rng, 55); dry.add(b2, at, 0.9 * g); send.add(b2, at, 0.4); } if (k === 4 && b % 2) dry.add(tom(rng, 80), at, 0.6 * g, -0.3); if (k === 6 && section === 'main') { const sn = snare(rng, 160); dry.add(sn, at, 0.35 * g); send.add(sn, at, 0.4); } if (k === 7 && section === 'main') dry.add(tom(rng, 110), at, 0.4 * g, 0.3); }
      }
    }
  }
  // Ending: final chord swell & cymbal-like noise
  const endT = Math.max(0, dur - 0.05);
  const finalChord = chord(root, 0, m.minor);
  const fin = padVoice(finalChord.map((x) => x + 12), 2.4, 0.5); dry.add(fin, endT - 0.3, 0.25); send.add(fin, endT - 0.3, 0.5);
  if (o.mood === 'lofi') { const cr = noise(out.length, rng); for (let i = 0; i < cr.length; i++) cr[i] = rng.next() > 0.9993 ? cr[i] : cr[i] * 0.02; dry.add(svfLow(cr, () => 4000), 0, 0.25); }

  const rv = reverb(send, o.mood === 'ambient' || o.mood === 'cinematic' ? 0.88 : 0.8, 0.35, 0.35);
  out.addStereo(dry); out.addStereo(rv);
  // fade in/out, length = duration
  const fadeIn = Math.round(0.4 * SR), fadeOut = Math.round(Math.min(2.5, dur * 0.15) * SR), total = Math.round(dur * SR);
  for (let i = 0; i < out.length; i++) {
    let g = i < fadeIn ? i / fadeIn : 1;
    if (i > total - fadeOut) g *= Math.max(0, (total - i) / fadeOut);
    out.L[i] *= g; out.R[i] *= g;
  }
  const trimmed = new Stereo(total); trimmed.L.set(out.L.subarray(0, total)); trimmed.R.set(out.R.subarray(0, total));
  softClip(trimmed);
  return normalize(trimmed, 0.8);
}

export function musicWav(o: MusicOptions) { return encodeWav(generateMusic(o)); }
