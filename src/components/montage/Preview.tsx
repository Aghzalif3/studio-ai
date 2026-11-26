'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronFirst, ChevronLast, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useMontage } from '@/lib/montage/store';
import { outToSrc } from '@/lib/montage/analysis';
import { drawMontageFrame } from '@/lib/montage/render';
import { playSfx } from '@/lib/montage/media';
import { agentById } from '@/lib/montage/agents';
import type { OutputAspect } from '@/lib/montage/types';

const PREVIEW: Record<OutputAspect, [number, number]> = { '9:16': [540, 960], '16:9': [960, 540], '1:1': [720, 720], '4:5': [640, 800] };

export function timecode(t: number, fps = 30) {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * fps);
  return [h, m, s, f].map((x) => String(x).padStart(2, '0')).join(':');
}

export function Preview() {
  const media = useMontage((s) => s.media);
  const plan = useMontage((s) => s.plan);
  const time = useMontage((s) => s.time);
  const playing = useMontage((s) => s.playing);
  const look = useMontage((s) => s.settings.captionLook);
  const aspect = useMontage((s) => s.settings.aspect);
  const cursor = useMontage((s) => s.cursor);
  const running = useMontage((s) => s.running);
  const { setTime, setPlaying } = useMontage.getState();
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const seg = useRef(0);
  const lastT = useRef(0);
  const [W, H] = PREVIEW[aspect];
  const box = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 400, h: 400 });
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth - 24, h: el.clientHeight - 24 })); ro.observe(el); return () => ro.disconnect();
  }, []);
  const k = Math.max(0.05, Math.min(area.w / W, area.h / H));
  const fit = { w: Math.floor(W * k), h: Math.floor(H * k) };

  const draw = (t: number) => {
    const c = canvas.current, v = video.current; if (!c) return;
    const g = c.getContext('2d')!;
    const p = useMontage.getState().plan;
    drawMontageFrame(g, c.width, c.height, p, t, { look: useMontage.getState().settings.captionLook, video: v && v.readyState >= 2 ? { el: v, w: v.videoWidth, h: v.videoHeight } : null });
  };

  // À l'arrêt : on cale la vidéo sur l'instant demandé puis on redessine.
  useEffect(() => {
    if (playing) return;
    const v = video.current; draw(time);
    if (!v || !plan.segments.length) return;
    const { src, index } = outToSrc(plan.segments, time); seg.current = Math.max(0, index);
    if (Math.abs(v.currentTime - src) > 0.03) { v.currentTime = src; const h = () => { draw(useMontage.getState().time); v.removeEventListener('seeked', h); }; v.addEventListener('seeked', h); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, plan, playing, look, aspect, media]);

  // Lecture : l'horloge de la vidéo pilote le temps, on saute les passages coupés.
  useEffect(() => {
    const v = video.current; if (!playing || !v) return;
    const p = useMontage.getState().plan;
    if (!p.segments.length) { setPlaying(false); return; }
    let t0 = useMontage.getState().time; if (t0 >= p.duration - 0.05) t0 = 0;
    const start = outToSrc(p.segments, t0); seg.current = Math.max(0, start.index);
    v.currentTime = start.src; v.muted = false; lastT.current = t0;
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
    v.play().catch(() => setPlaying(false));
    let raf = 0, jumping = false;
    const tick = () => {
      const pl = useMontage.getState().plan, s = pl.segments[seg.current];
      if (!s) { setPlaying(false); return; }
      if (!jumping) {
        if (v.currentTime >= s.srcEnd - 0.015 || v.ended) {
          const next = pl.segments[seg.current + 1];
          if (!next) { v.pause(); setTime(pl.duration); setPlaying(false); return; }
          seg.current++; jumping = true; v.currentTime = next.srcStart;
          v.addEventListener('seeked', () => { jumping = false; }, { once: true });
        } else {
          const t = s.outStart + Math.max(0, v.currentTime - s.srcStart);
          for (const c of pl.sfx) if (c.at > lastT.current && c.at <= t && t - c.at < 0.3 && audio.current) playSfx(audio.current, audio.current.destination, c.kind, c.gainDb);
          lastT.current = t;
          draw(t); setTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); v.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Raccourcis clavier.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      const s = useMontage.getState();
      if (e.code === 'Space') { e.preventDefault(); s.setPlaying(!s.playing); }
      if (e.key === 'ArrowLeft') s.setTime(s.time - (e.shiftKey ? 1 : 1 / 30));
      if (e.key === 'ArrowRight') s.setTime(s.time + (e.shiftKey ? 1 : 1 / 30));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); s.undo(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const jump = (d: number) => setTime(time + d);
  const prevCut = () => { const b = plan.segments.map((s) => s.outStart).filter((x) => x < time - 0.05); setTime(b.length ? b[b.length - 1] : 0); };
  const nextCut = () => { const b = plan.segments.map((s) => s.outStart).find((x) => x > time + 0.05); setTime(b ?? plan.duration); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {media && <video ref={video} src={media.url} playsInline preload="auto" className="pointer-events-none absolute h-px w-px opacity-0" onLoadedData={() => draw(useMontage.getState().time)} />}
        <div className="relative" style={{ width: fit.w, height: fit.h }}>
          <canvas ref={canvas} width={W} height={H} className="h-full w-full rounded-lg bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,.9)]" />
          {cursor && running && <AgentCursor key={cursor.agent} {...cursor} />}
          {running && <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-orange-500/60 animate-pulse" />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2">
        <button className="mbtn-icon" onClick={() => setTime(0)} title="Début"><ChevronFirst size={16} /></button>
        <button className="mbtn-icon" onClick={prevCut} title="Plan précédent"><SkipBack size={15} /></button>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-black shadow-[0_0_24px_-4px_rgba(255,107,44,.8)] transition hover:bg-orange-400 disabled:opacity-40" disabled={!media} onClick={() => setPlaying(!playing)} title="Lecture / pause (Espace)">
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <button className="mbtn-icon" onClick={nextCut} title="Plan suivant"><SkipForward size={15} /></button>
        <button className="mbtn-icon" onClick={() => setTime(plan.duration)} title="Fin"><ChevronLast size={16} /></button>
        <div className="ml-2 font-mono text-sm tabular-nums"><span className="text-white">{timecode(time)}</span><span className="text-ink-400"> / {timecode(plan.duration)}</span></div>
        <div className="ml-auto flex gap-1">
          <button className="mbtn-ghost" onClick={() => jump(-5)}>−5 s</button>
          <button className="mbtn-ghost" onClick={() => jump(5)}>+5 s</button>
        </div>
      </div>
    </div>
  );
}

function AgentCursor({ agent, x, y, label }: { agent: string; x: number; y: number; label: string }) {
  const color = agentById(agent)?.color ?? '#ff6b2c';
  const [pos, setPos] = useState({ x: 0.5, y: 1.05 });
  useEffect(() => { const r = requestAnimationFrame(() => setPos({ x, y })); return () => cancelAnimationFrame(r); }, [x, y]);
  return (
    <div className="pointer-events-none absolute z-10 transition-all duration-300 ease-out" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}>
      <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow"><path d="M1 1l15 7-6.5 1.8L6.6 17z" fill={color} stroke="#000" strokeWidth="1.2" strokeLinejoin="round" /></svg>
      <span className="ml-3 -mt-1 inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold text-black shadow" style={{ background: color }}>{label}</span>
    </div>
  );
}
