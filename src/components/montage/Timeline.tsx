'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Scissors, ZoomIn, ZoomOut } from 'lucide-react';
import { useMontage, type Selection } from '@/lib/montage/store';
import { outPeaks, srcToOut } from '@/lib/montage/analysis';
import { agentById } from '@/lib/montage/agents';
import type { Plan } from '@/lib/montage/types';

const LABEL_W = 96;
const ROWS = [
  { id: 'ruler', label: 'Timecode', h: 22 },
  { id: 'v1', label: 'V1 · Images', h: 46 },
  { id: 'v2', label: 'V2 · Motion', h: 30 },
  { id: 't1', label: 'T1 · Mots', h: 28 },
  { id: 'z1', label: 'Z1 · Cadrage', h: 20 },
  { id: 'a1', label: 'A1 · Voix', h: 44 },
  { id: 'a2', label: 'A2 · Sons', h: 30 },
] as const;
const top = (id: (typeof ROWS)[number]['id']) => { let y = 0; for (const r of ROWS) { if (r.id === id) return y; y += r.h; } return y; };
const TOTAL_H = ROWS.reduce((s, r) => s + r.h, 0);

export function Timeline() {
  const plan = useMontage((s) => s.plan);
  const media = useMontage((s) => s.media);
  const env = useMontage((s) => s.env);
  const thumbs = useMontage((s) => s.thumbs);
  const selected = useMontage((s) => s.selected);
  const running = useMontage((s) => s.running);
  const { select, setTime, editPlan } = useMontage.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(800);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth)); ro.observe(el); return () => ro.disconnect();
  }, []);
  const dur = Math.max(plan.duration, 1);
  const pps = Math.max(8, ((boxW - 24) / dur) * zoom);
  const width = Math.max(boxW - 2, dur * pps + 24);
  const X = (t: number) => t * pps;
  const thumbStep = media && thumbs.length ? media.duration / thumbs.length : 1;

  // Suit la tête de lecture quand les agents travaillent ou en lecture.
  useEffect(() => useMontage.subscribe((s, prev) => {
    if (s.time === prev.time || !scroller.current) return;
    const el = scroller.current, x = s.time * pps;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 60) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }), [pps]);

  const timeFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const el = scroller.current!; const r = el.getBoundingClientRect();
    return Math.max(0, (e.clientX - r.left + el.scrollLeft) / pps);
  };

  // Glisser un élément (motion, zoom, bruitage) pour le déplacer.
  const drag = useRef<{ kind: 'motion' | 'zoom' | 'sfx'; id: string; x: number; t0: number; moved: boolean } | null>(null);
  const startDrag = (e: React.PointerEvent, kind: 'motion' | 'zoom' | 'sfx', id: string, t0: number) => {
    e.stopPropagation(); select({ kind, id });
    drag.current = { kind, id, x: e.clientX, t0, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dt = (e.clientX - d.x) / pps; if (Math.abs(e.clientX - d.x) < 3 && !d.moved) return;
    const first = !d.moved; d.moved = true;
    const nt = Math.max(0, Math.min(plan.duration - 0.1, Math.round((d.t0 + dt) * 20) / 20));
    const upd = (p: Plan): Plan => d.kind === 'motion' ? { ...p, motions: p.motions.map((m) => (m.id === d.id ? { ...m, start: nt } : m)) }
      : d.kind === 'zoom' ? { ...p, zooms: p.zooms.map((m) => (m.id === d.id ? { ...m, start: nt } : m)) }
      : { ...p, sfx: p.sfx.map((m) => (m.id === d.id ? { ...m, at: nt } : m)) };
    if (first) editPlan(upd); else useMontage.setState({ plan: upd(useMontage.getState().plan) });
    setTime(nt + 0.2);
  };
  const endDrag = () => { drag.current = null; };

  const isSel = (kind: NonNullable<Selection>['kind'], id: string) => selected?.kind === kind && selected.id === id;

  const ticks = useMemo(() => {
    const step = pps > 90 ? 1 : pps > 40 ? 2 : pps > 16 ? 5 : 10;
    const out: number[] = []; for (let t = 0; t <= dur + 0.001; t += step) out.push(t); return { out, step };
  }, [pps, dur]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-3 py-1.5 text-[11px] text-ink-300">
        <span className="font-semibold uppercase tracking-[.14em] text-orange-300">Timeline</span>
        <span>{plan.segments.length} plan{plan.segments.length > 1 ? 's' : ''}</span>
        <span>{plan.cuts.length} coupe{plan.cuts.length > 1 ? 's' : ''}</span>
        <span>{plan.captions.length} sous-titres</span>
        <span>{plan.motions.length} motions</span>
        <span>{plan.sfx.length} bruitages</span>
        {media && plan.duration < media.duration - 0.05 && <span className="text-emerald-300">−{(media.duration - plan.duration).toFixed(1)} s de blancs</span>}
        <div className="ml-auto flex items-center gap-1">
          <button className="mbtn-icon h-7 w-7" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} title="Dézoomer"><ZoomOut size={14} /></button>
          <input type="range" min={1} max={12} step={0.1} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-24 accent-orange-500" />
          <button className="mbtn-icon h-7 w-7" onClick={() => setZoom((z) => Math.min(12, z * 1.5))} title="Zoomer"><ZoomIn size={14} /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="shrink-0 border-r border-white/[0.06] bg-[#0d0d10]" style={{ width: LABEL_W }}>
          {ROWS.map((r) => (<div key={r.id} className="flex items-center border-b border-white/[0.04] px-2.5 text-[10px] font-semibold text-ink-300" style={{ height: r.h }}>{r.label}</div>))}
        </div>
        <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden" onPointerMove={onDragMove} onPointerUp={endDrag}
          onPointerDown={(e) => { if (e.button === 0 && !drag.current) { setTime(timeFromEvent(e)); select(null); } }}>
          <div className="relative" style={{ width, height: TOTAL_H }}>
            {ROWS.map((r) => <div key={r.id} className="absolute inset-x-0 border-b border-white/[0.04]" style={{ top: top(r.id), height: r.h, background: r.id === 'ruler' ? '#0d0d10' : undefined }} />)}
            {/* Règle */}
            {ticks.out.map((t) => (
              <div key={t} className="absolute top-0 h-[22px] border-l border-white/15 pl-1 font-mono text-[9px] leading-[22px] text-ink-400" style={{ left: X(t) }}>{t % 60 === 0 ? `${t / 60}:00` : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`}</div>
            ))}
            {/* V1 : plans gardés avec vignettes */}
            {plan.segments.map((s, i) => {
              const len = s.srcEnd - s.srcStart;
              const th = thumbs.filter((x) => x.t >= s.srcStart && x.t <= s.srcEnd);
              return (
                <div key={s.id} className="absolute overflow-hidden rounded-md border border-orange-300/30 bg-[#2a1a12] animate-[drop_.35s_ease-out]" style={{ left: X(s.outStart), width: Math.max(2, X(len) - 1), top: top('v1') + 4, height: 38 }}>
                  {th.map((x) => { const o = (srcToOut([s], x.t) ?? s.outStart) - s.outStart; return <img key={x.t} src={x.data} alt="" className="absolute top-0 h-full object-cover opacity-85" style={{ left: X(o - thumbStep / 2), width: X(thumbStep) + 1 }} />; })}
                  <span className="absolute left-1 top-0.5 rounded bg-black/60 px-1 font-mono text-[9px] text-orange-200">P{i + 1}</span>
                </div>
              );
            })}
            {plan.segments.slice(1).map((s) => {
              const cut = plan.cuts.find((c) => Math.abs((srcToOut(plan.segments, c.srcEnd) ?? -1) - s.outStart) < 0.06) ?? plan.cuts.find((c) => Math.abs(c.srcEnd - s.srcStart) < 0.06);
              return (
                <button key={'c' + s.id} title={cut ? `Coupe (${cut.reason === 'silence' ? 'blanc' : 'hésitation'}) : ${(cut.srcEnd - cut.srcStart).toFixed(2)} s retirées. Clique pour la voir.` : 'Coupe'}
                  onPointerDown={(e) => { e.stopPropagation(); if (cut) select({ kind: 'cut', id: cut.id }); setTime(s.outStart); }}
                  className={`absolute z-[2] grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full ${cut && isSel('cut', cut.id) ? 'bg-white text-black' : 'bg-rose-500 text-white'}`} style={{ left: X(s.outStart), top: top('v1') - 6 }}>
                  <Scissors size={9} />
                </button>
              );
            })}
            {/* V2 : motions */}
            {plan.motions.map((m) => (
              <div key={m.id} onPointerDown={(e) => startDrag(e, 'motion', m.id, m.start)}
                className={`absolute flex cursor-grab items-center overflow-hidden rounded-md border px-1.5 text-[10px] font-semibold text-white animate-[drop_.35s_ease-out] active:cursor-grabbing ${isSel('motion', m.id) ? 'border-white ring-2 ring-white/50' : 'border-white/20'}`}
                style={{ left: X(m.start), width: Math.max(14, X(m.duration)), top: top('v2') + 4, height: 22, background: `linear-gradient(90deg, ${agentById(m.agent)?.color ?? '#a78bfa'}cc, ${agentById(m.agent)?.color ?? '#a78bfa'}66)` }}>
                <span className="truncate">{MOTION_LABEL[m.kind]}{m.text && m.kind !== 'brackets' ? ` · ${m.text}` : ''}</span>
              </div>
            ))}
            {/* T1 : mots */}
            {plan.captions.flatMap((c) => c.words.map((w, k) => (
              <div key={c.id + k} onPointerDown={(e) => { e.stopPropagation(); select({ kind: 'caption', id: c.id }); setTime(w.start + 0.01); }}
                className={`absolute flex items-center overflow-hidden rounded-[4px] px-1 text-[9.5px] font-semibold animate-[drop_.3s_ease-out] ${w.emphasis ? 'bg-orange-500 text-black' : 'bg-amber-300/90 text-black'} ${isSel('caption', c.id) ? 'ring-2 ring-white' : ''}`}
                style={{ left: X(w.start), width: Math.max(6, X(Math.max(0.08, w.end - w.start)) - 1), top: top('t1') + 4, height: 20 }}>
                <span className="truncate">{w.text}</span>
              </div>
            )))}
            {/* Z1 : zooms */}
            {plan.zooms.map((z) => (
              <div key={z.id} onPointerDown={(e) => startDrag(e, 'zoom', z.id, z.start)}
                className={`absolute cursor-grab rounded-sm bg-cyan-400/70 px-1 font-mono text-[9px] font-bold leading-[14px] text-black animate-[drop_.3s_ease-out] ${isSel('zoom', z.id) ? 'ring-2 ring-white' : ''}`}
                style={{ left: X(z.start), width: Math.max(10, X(z.duration)), top: top('z1') + 3, height: 14 }}>×{z.amount.toFixed(2)}</div>
            ))}
            {/* A1 : forme d'onde de la voix */}
            <Waveform env={env} plan={plan} pps={pps} width={width} y={top('a1')} />
            {/* A2 : bruitages */}
            <div className="absolute inset-x-0 rounded-sm bg-blue-600/25" style={{ top: top('a2') + 6, height: 18 }} />
            {plan.sfx.map((c) => (
              <div key={c.id} onPointerDown={(e) => startDrag(e, 'sfx', c.id, c.at)} title={`${c.label} (${c.agent})`}
                className={`absolute flex cursor-grab items-center gap-0.5 rounded-full bg-blue-500 px-1.5 text-[9px] font-semibold text-white shadow-[0_0_10px_rgba(59,130,246,.7)] animate-[drop_.3s_ease-out] ${isSel('sfx', c.id) ? 'ring-2 ring-white' : ''}`}
                style={{ left: X(c.at), top: top('a2') + 6, height: 18 }}>{c.label}</div>
            ))}
            <Playhead pps={pps} />
            {running && <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/[0.03] to-transparent" />}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MOTION_LABEL = { giant: 'Lettres géantes', counter: 'Compteur', arrow: 'Flèche', brackets: 'Cadre focus', tag: 'Étiquette' } as const;

const Waveform = memo(function Waveform({ env, plan, pps, width, y }: { env: Float32Array | null; plan: Plan; pps: number; width: number; y: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const peaks = useMemo(() => (env && plan.segments.length ? outPeaks(env, plan.segments, 40) : null), [env, plan.segments]);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1; c.width = Math.min(16000, Math.round(width * dpr)); c.height = 44 * dpr;
    const g = c.getContext('2d')!; g.scale(c.width / width, dpr); g.clearRect(0, 0, width, 44);
    if (!peaks) return;
    const grad = g.createLinearGradient(0, 0, 0, 44); grad.addColorStop(0, '#86efac'); grad.addColorStop(0.5, '#22c55e'); grad.addColorStop(1, '#86efac');
    g.fillStyle = grad;
    const step = 1 / 40;
    for (let i = 0; i < peaks.length; i++) { const x = i * step * pps, h = Math.max(1, peaks[i] * 40); g.fillRect(x, 22 - h / 2, Math.max(1, step * pps - 0.5), h); }
  }, [peaks, pps, width]);
  return <canvas ref={ref} className="pointer-events-none absolute left-0" style={{ top: y, width, height: 44 }} />;
});

function Playhead({ pps }: { pps: number }) {
  const t = useMontage((s) => s.time);
  return (
    <div className="pointer-events-none absolute inset-y-0 z-[3] w-px bg-pink-500" style={{ left: t * pps }}>
      <div className="absolute -left-[5px] top-0 h-3 w-[11px] rounded-b-sm bg-pink-500" />
    </div>
  );
}
