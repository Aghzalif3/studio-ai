'use client';
// Outils navigateur : décodage audio de la vidéo, vignettes, transcription, bruitages.

import type { SfxType } from '../types';
import { makeSfx } from '../audio/sfx';
import { SR } from '../audio/dsp';
import type { SrcWord } from './types';

export async function decodeAudio(file: Blob): Promise<{ mono: Float32Array; sampleRate: number; duration: number } | null> {
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AC();
  try {
    const ab = await ctx.decodeAudioData(buf);
    const mono = new Float32Array(ab.length);
    for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / ab.numberOfChannels; }
    return { mono, sampleRate: ab.sampleRate, duration: ab.duration };
  } catch {
    return null; // vidéo sans piste audio ou codec non pris en charge
  } finally { ctx.close().catch(() => {}); }
}

export async function resample(mono: Float32Array, from: number, to = 16000): Promise<Float32Array> {
  if (from === to) return mono;
  const len = Math.ceil((mono.length * to) / from);
  const off = new OfflineAudioContext(1, len, to);
  const b = off.createBuffer(1, mono.length, from); b.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);
  const s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start();
  const r = await off.startRendering();
  return r.getChannelData(0).slice();
}

export function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url;
    v.onloadeddata = () => res(v); v.onerror = () => rej(new Error('Vidéo illisible par le navigateur (essayez un MP4 H.264 ou un MOV).'));
  });
}

export function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return res();
    const done = () => { v.removeEventListener('seeked', done); res(); };
    v.addEventListener('seeked', done); v.currentTime = t;
    setTimeout(done, 1500);
  });
}

/** Vignettes régulières de la vidéo pour la piste V1. */
export async function makeThumbs(url: string, duration: number, onThumb: (t: number, data: string) => void, count = Math.min(48, Math.max(8, Math.ceil(duration / 1.5)))) {
  const v = await loadVideo(url);
  const h = 72, w = Math.round((v.videoWidth / Math.max(1, v.videoHeight)) * h) || 128;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * duration;
    await seek(v, t); g.drawImage(v, 0, 0, w, h);
    onThumb(t, c.toDataURL('image/jpeg', 0.6));
  }
  v.removeAttribute('src'); v.load();
}

export type TranscribeProgress = { stage: 'download' | 'transcribe'; value: number };

/** Whisper dans un Web Worker. Retourne les mots minutés (temps source). */
export function transcribe(audio16k: Float32Array, language: string | null, onProgress: (p: TranscribeProgress) => void): { promise: Promise<SrcWord[]>; cancel: () => void } {
  const w = new Worker('/workers/whisper-worker.js', { type: 'module' });
  const promise = new Promise<SrcWord[]>((res, rej) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress({ stage: m.stage, value: m.value });
      if (m.type === 'done') { res(m.words); w.terminate(); }
      if (m.type === 'error') { rej(new Error(m.message)); w.terminate(); }
    };
    w.onerror = (e) => { rej(new Error(e.message || 'Transcription impossible')); w.terminate(); };
  });
  w.postMessage({ audio: audio16k, language });
  return { promise, cancel: () => w.terminate() };
}

const sfxCache = new Map<SfxType, Float32Array>();
export function sfxBuffer(ctx: BaseAudioContext, kind: SfxType): AudioBuffer {
  let d = sfxCache.get(kind); if (!d) { d = makeSfx(kind, 11); sfxCache.set(kind, d); }
  const b = ctx.createBuffer(1, d.length, SR); b.copyToChannel(d as Float32Array<ArrayBuffer>, 0); return b;
}

export function playSfx(ctx: BaseAudioContext, dest: AudioNode, kind: SfxType, gainDb: number, when = 0) {
  const s = ctx.createBufferSource(); s.buffer = sfxBuffer(ctx, kind);
  const g = ctx.createGain(); g.gain.value = Math.pow(10, gainDb / 20);
  s.connect(g).connect(dest); s.start(when);
}
