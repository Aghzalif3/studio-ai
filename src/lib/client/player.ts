'use client';
// Real-time preview: draws frames with the shared renderer and plays the audio clips with WebAudio.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import { PREVIEW_SIZES } from '../types';
import type { StyleDef } from '../styles/types';
import { renderFrame, timelineDuration } from '../render/compose';
import { MediaCache, browserEnv, loadFonts } from './browser-env';
import { assetUrl } from './api';

const db = (x: number) => Math.pow(10, x / 20);

class AudioEngine {
  ctx: AudioContext | null = null;
  buffers = new Map<string, Promise<AudioBuffer | null>>();
  live: AudioScheduledSourceNode[] = [];
  master: GainNode | null = null;
  ensure() {
    if (!this.ctx) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
    return this.ctx;
  }
  load(url: string) {
    let b = this.buffers.get(url);
    if (!b) {
      const ctx = this.ensure();
      b = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => ctx.decodeAudioData(a)).catch(() => null);
      this.buffers.set(url, b);
    }
    return b;
  }
  stop() { for (const s of this.live) { try { s.stop(); } catch {} } this.live = []; }
  async schedule(p: Project, from: number, gains: { voice: number; music: number; sfx: number }) {
    const ctx = this.ensure();
    this.stop();
    const tracks: [keyof typeof gains, typeof p.timeline.voice][] = [['voice', p.timeline.voice], ['music', p.timeline.music], ['sfx', p.timeline.sfx]];
    const jobs = tracks.flatMap(([k, clips]) => clips.filter((c) => c.start + c.duration > from).map(async (c) => ({ k, c, buf: await this.load(assetUrl(p.id, c.assetId)) })));
    const loaded = await Promise.all(jobs);
    const t0 = ctx.currentTime + 0.05;
    for (const { k, c, buf } of loaded) {
      if (!buf) continue;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = c.speed || 1;
      const g = ctx.createGain(); src.connect(g); g.connect(this.master!);
      const offsetInClip = Math.max(0, from - c.start);
      const when = t0 + Math.max(0, c.start - from);
      const level = db(c.gainDb + gains[k]);
      const remaining = c.duration - offsetInClip;
      if (remaining <= 0) continue;
      g.gain.setValueAtTime(c.fadeIn > offsetInClip ? 0 : level, when);
      if (c.fadeIn > offsetInClip) g.gain.linearRampToValueAtTime(level, when + (c.fadeIn - offsetInClip));
      if (c.fadeOut > 0) { g.gain.setValueAtTime(level, when + Math.max(0, remaining - c.fadeOut)); g.gain.linearRampToValueAtTime(0, when + remaining); }
      src.start(when, c.srcIn + offsetInClip * (c.speed || 1), remaining * (c.speed || 1));
      this.live.push(src);
    }
    return t0;
  }
}

export function usePlayer(project: Project | null, style: StyleDef | null, opts: { gains?: { voice: number; music: number; sfx: number }; scale?: number } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const tRef = useRef(0);
  const playRef = useRef<{ ctxStart: number; from: number } | null>(null);
  const audio = useRef<AudioEngine>(null as any); audio.current ??= new AudioEngine();
  const projRef = useRef(project); projRef.current = project;
  const styleRef = useRef(style); styleRef.current = style;
  const gains = opts.gains ?? { voice: 0, music: 0, sfx: -8 };
  const gainsRef = useRef(gains); gainsRef.current = gains;
  const duration = project ? timelineDuration(project) : 0;
  const durRef = useRef(duration); durRef.current = duration;
  const [w, h] = project ? PREVIEW_SIZES[project.brief.aspect].map((x) => Math.round(x * (opts.scale ?? 1))) : [960, 540];

  const media = useMemo(() => new MediaCache((id) => assetUrl(project?.id ?? '', id)), [project?.id]);
  useEffect(() => () => { media.dispose(); audio.current.stop(); }, [media]);
  const env = useMemo(() => browserEnv({
    preview: true,
    media: (id, at) => {
      const p = projRef.current; const a = p?.assets.find((x) => x.id === id);
      if (!a) return null;
      if (a.kind === 'image') return media.image(id);
      if (a.kind !== 'video') return null;
      const v = media.video(id);
      const isPlaying = !!playRef.current;
      if (isPlaying) { if (v.paused) { v.currentTime = at; v.play().catch(() => {}); } else if (Math.abs(v.currentTime - at) > 0.35) v.currentTime = at; }
      else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - at) > 0.04 && !v.seeking) v.currentTime = at; }
      (v as any).__used = performance.now();
      return v.readyState >= 2 ? v : null;
    },
  }), [media, w, h]);

  const draw = useCallback((t: number) => {
    const c = canvasRef.current, p = projRef.current, s = styleRef.current;
    if (!c || !p || !s) return;
    try { renderFrame(env, c.getContext('2d')!, { project: p, style: s, w: c.width, h: c.height }, t, Math.round(t * (p.timeline.fps || 30))); } catch (e) { console.error(e); }
    const now = performance.now();
    for (const v of media.videos.values()) if (!v.paused && now - ((v as any).__used ?? 0) > 200) v.pause();
  }, [env, media]);

  // Redraw when the project changes while paused (edits show immediately).
  useEffect(() => { let alive = true; loadFonts().then(() => alive && !playRef.current && draw(tRef.current)); return () => { alive = false; }; }, [project, style, draw, w, h]);
  // Image/video assets arrive asynchronously: redraw a few times after load.
  useEffect(() => { if (playing) return; const id = setInterval(() => draw(tRef.current), 500); const stop = setTimeout(() => clearInterval(id), 3000); return () => { clearInterval(id); clearTimeout(stop); }; }, [project, playing, draw]);

  const seek = useCallback((t: number) => {
    t = Math.max(0, Math.min(durRef.current, t));
    tRef.current = t; setTime(t);
    if (playRef.current) { const p = projRef.current!; audio.current.schedule(p, t, gainsRef.current).then((ctxStart) => { playRef.current = { ctxStart, from: t }; }); }
    else draw(t);
  }, [draw]);

  const pause = useCallback(() => { playRef.current = null; setPlaying(false); audio.current.stop(); for (const v of media.videos.values()) v.pause(); }, [media]);

  const play = useCallback(async () => {
    const p = projRef.current; if (!p) return;
    const ctx = audio.current.ensure(); await ctx.resume();
    let from = tRef.current; if (from >= durRef.current - 0.05) from = 0;
    setPlaying(true);
    const ctxStart = await audio.current.schedule(p, from, gainsRef.current);
    playRef.current = { ctxStart, from };
    const loop = () => {
      const pr = playRef.current; if (!pr) return;
      const t = pr.from + Math.max(0, ctx.currentTime - pr.ctxStart);
      if (t >= durRef.current) { tRef.current = durRef.current; setTime(durRef.current); draw(durRef.current); pause(); return; }
      tRef.current = t; setTime(t); draw(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [draw, pause]);

  // Start on a frame where the first scene's text is visible rather than on the black first frame.
  useEffect(() => { if (!project?.id) return; const t0 = Math.min(1.2, durRef.current); tRef.current = t0; setTime(t0); }, [project?.id]);

  const toggle = useCallback(() => (playRef.current ? pause() : play()), [pause, play]);
  useEffect(() => () => { playRef.current = null; }, []);

  return { canvasRef, playing, time, duration, play, pause, toggle, seek, width: w, height: h };
}
