// Analyse audio de la vidéo importée : enveloppe, détection de parole/silences,
// coupes → segments gardés, conversion temps source ↔ temps sortie.

import type { Cut, Segment, SrcWord } from './types';

export const HOP = 0.01; // 10 ms par point d'enveloppe

/** Enveloppe RMS (linéaire 0..1) avec un point toutes les 10 ms. */
export function envelope(samples: Float32Array, sampleRate: number, hop = HOP): Float32Array {
  const step = Math.max(1, Math.round(sampleRate * hop));
  const n = Math.ceil(samples.length / step);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const a = i * step, b = Math.min(samples.length, a + step);
    for (let j = a; j < b; j++) s += samples[j] * samples[j];
    out[i] = Math.sqrt(s / Math.max(1, b - a));
  }
  return out;
}

const toDb = (x: number) => 20 * Math.log10(Math.max(1e-6, x));

/** Seuil de parole adaptatif : entre le bruit de fond (10e centile) et la voix (90e centile). */
export function speechThreshold(env: Float32Array): number {
  if (!env.length) return 0;
  const sorted = Array.from(env).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const floor = toDb(q(0.1)), loud = toDb(q(0.9));
  const db = Math.max(floor + 6, loud - 26, -60);
  return Math.pow(10, Math.min(db, loud - 3) / 20);
}

/** Plages de parole [début, fin] en secondes. */
export function detectSpeech(env: Float32Array, opts: { hop?: number; minSilence?: number; minSpeech?: number; threshold?: number } = {}): [number, number][] {
  const hop = opts.hop ?? HOP, minSil = opts.minSilence ?? 0.45, minSp = opts.minSpeech ?? 0.12;
  const th = opts.threshold ?? speechThreshold(env);
  const ranges: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= env.length; i++) {
    const on = i < env.length && env[i] >= th;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { ranges.push([start * hop, i * hop]); start = -1; }
  }
  // Fusionne les trous plus courts que minSilence, retire les bruits trop courts.
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < minSil) last[1] = r[1]; else merged.push([r[0], r[1]]);
  }
  return merged.filter((r) => r[1] - r[0] >= minSp);
}

/** Silences à couper entre les plages de parole (avec une marge pour ne pas manger les mots). */
export function silenceCuts(speech: [number, number][], duration: number, opts: { minSilence?: number; pad?: number } = {}): [number, number][] {
  const minSil = opts.minSilence ?? 0.45, pad = opts.pad ?? 0.12;
  const cuts: [number, number][] = [];
  let prev = 0;
  for (const [a, b] of speech) {
    const s = prev === 0 ? 0 : prev + pad, e = a - pad;
    if (e - s >= minSil - 2 * pad && e - s > 0.15) cuts.push([Math.max(0, s), e]);
    prev = b;
  }
  if (speech.length && duration - (prev + pad) > 0.3) cuts.push([prev + pad, duration]);
  return cuts;
}

/** Fusionne des coupes qui se chevauchent et les trie. */
export function normalizeCuts(cuts: [number, number][], duration: number): [number, number][] {
  const s = cuts.map(([a, b]) => [Math.max(0, a), Math.min(duration, b)] as [number, number]).filter(([a, b]) => b - a > 0.02).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const c of s) { const l = out[out.length - 1]; if (l && c[0] <= l[1] + 0.02) l[1] = Math.max(l[1], c[1]); else out.push([c[0], c[1]]); }
  return out;
}

/** Segments gardés à partir des coupes. */
export function segmentsFromCuts(cuts: Pick<Cut, 'srcStart' | 'srcEnd'>[], duration: number): Segment[] {
  const n = normalizeCuts(cuts.map((c) => [c.srcStart, c.srcEnd]), duration);
  const segs: Segment[] = [];
  let pos = 0, out = 0;
  for (const [a, b] of n) {
    if (a - pos > 0.04) { segs.push({ id: `seg_${segs.length}`, srcStart: pos, srcEnd: a, outStart: out }); out += a - pos; }
    pos = b;
  }
  if (duration - pos > 0.04) segs.push({ id: `seg_${segs.length}`, srcStart: pos, srcEnd: duration, outStart: out });
  return segs;
}

export const outDuration = (segs: Segment[]) => segs.reduce((s, g) => s + (g.srcEnd - g.srcStart), 0);

/** Temps source → temps sortie (null si le moment a été coupé). */
export function srcToOut(segs: Segment[], t: number): number | null {
  for (const g of segs) if (t >= g.srcStart - 1e-6 && t <= g.srcEnd + 1e-6) return g.outStart + (t - g.srcStart);
  return null;
}

/** Temps sortie → temps source et segment. */
export function outToSrc(segs: Segment[], t: number): { src: number; seg: Segment | null; index: number } {
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i], len = g.srcEnd - g.srcStart;
    if (t < g.outStart + len || i === segs.length - 1) return { src: g.srcStart + Math.min(Math.max(0, t - g.outStart), len), seg: g, index: i };
  }
  return { src: t, seg: null, index: -1 };
}

/** Mots en temps de sortie ; les mots tombés dans une coupe disparaissent. */
export function wordsToOut(segs: Segment[], words: SrcWord[]): { text: string; start: number; end: number; src: SrcWord }[] {
  const out: { text: string; start: number; end: number; src: SrcWord }[] = [];
  for (const w of words) {
    const mid = (w.start + w.end) / 2;
    const m = srcToOut(segs, mid); if (m == null) continue;
    const s = srcToOut(segs, w.start) ?? m - (mid - w.start);
    const e = srcToOut(segs, w.end) ?? m + (w.end - mid);
    out.push({ text: w.text, start: Math.max(0, s), end: Math.max(s + 0.05, e), src: w });
  }
  return out;
}

/** Enveloppe réduite en pics, en temps de sortie, pour dessiner la forme d'onde. */
export function outPeaks(env: Float32Array, segs: Segment[], pointsPerSec: number, hop = HOP): Float32Array {
  const dur = outDuration(segs), n = Math.max(1, Math.ceil(dur * pointsPerSec));
  const out = new Float32Array(n);
  let max = 1e-6; for (const v of env) if (v > max) max = v;
  for (let i = 0; i < n; i++) {
    const t0 = i / pointsPerSec, t1 = (i + 1) / pointsPerSec;
    const a = outToSrc(segs, t0).src, b = outToSrc(segs, Math.min(dur, t1)).src;
    let m = 0; const ia = Math.floor(a / hop), ib = Math.max(ia + 1, Math.floor(b / hop));
    for (let j = ia; j < ib && j < env.length; j++) if (env[j] > m) m = env[j];
    out[i] = Math.min(1, Math.sqrt(m / max));
  }
  return out;
}

/**
 * Sans transcription automatique : répartit un texte collé sur les plages de parole,
 * proportionnellement à la longueur des mots. Approximatif mais honnête.
 */
export function alignScript(text: string, speech: [number, number][]): SrcWord[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length || !speech.length) return [];
  const total = speech.reduce((s, [a, b]) => s + (b - a), 0);
  const weights = words.map((w) => 1 + w.replace(/[^\p{L}\p{N}]/gu, '').length);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const out: SrcWord[] = [];
  let acc = 0;
  const at = (x: number) => { // position sur la parole « dépliée » → temps source
    let r = x;
    for (const [a, b] of speech) { if (r <= b - a) return a + r; r -= b - a; }
    return speech[speech.length - 1][1];
  };
  for (let i = 0; i < words.length; i++) {
    const s = (acc / wsum) * total; acc += weights[i];
    const e = (acc / wsum) * total;
    out.push({ text: words[i], start: at(s), end: at(e - 0.001) });
  }
  return out;
}
