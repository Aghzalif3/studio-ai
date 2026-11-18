'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Captions, ImagePlus, Magnet, Mic, Music, Plus, Scissors, Sparkles, Trash2, Type, Video, ZoomIn, ZoomOut } from 'lucide-react';
import type { AudioClip, Caption, EffectClip, EffectType, Project, SfxType, VideoClip } from '@/lib/types';
import type { StyleDef } from '@/lib/styles/types';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';
import type { usePlayer } from '@/lib/client/player';
import { timelineDuration } from '@/lib/render/compose';
import { SFX_DURATION, estimateWordTimings, sfxAssetId } from '@/lib/project';
import { clamp, formatTime, uid } from '@/lib/util';
import { PlayerView } from './PlayerView';
import { CAMERAS, SFX, TRANSITIONS } from './Storyboard';
import { Field, Slider } from '../ui';

type TrackKey = 'video' | 'effects' | 'voice' | 'music' | 'sfx' | 'captions';
type Sel = { track: TrackKey; id: string } | null;
type AnyClip = VideoClip | AudioClip | EffectClip | Caption;

const TRACKS: { key: TrackKey; icon: any; fr: string; en: string; color: string }[] = [
  { key: 'video', icon: Video, fr: 'Vidéo', en: 'Video', color: 'from-violet-500/70 to-violet-600/60 border-violet-300/40' },
  { key: 'effects', icon: Sparkles, fr: 'Effets', en: 'Effects', color: 'from-fuchsia-500/50 to-pink-600/40 border-fuchsia-300/30' },
  { key: 'captions', icon: Captions, fr: 'Sous-titres', en: 'Captions', color: 'from-amber-500/50 to-amber-600/40 border-amber-300/30' },
  { key: 'voice', icon: Mic, fr: 'Voix', en: 'Voice', color: 'from-sky-500/60 to-blue-600/50 border-sky-300/40' },
  { key: 'music', icon: Music, fr: 'Musique', en: 'Music', color: 'from-emerald-500/50 to-teal-600/40 border-emerald-300/30' },
  { key: 'sfx', icon: AudioLines, fr: 'Bruitages', en: 'SFX', color: 'from-orange-500/50 to-red-600/40 border-orange-300/30' },
];
const EFFECTS: { value: EffectType; fr: string; en: string }[] = [
  { value: 'flash', fr: 'Flash', en: 'Flash' }, { value: 'shake', fr: 'Tremblement', en: 'Shake' }, { value: 'zoom-punch', fr: 'Zoom choc', en: 'Zoom punch' },
  { value: 'glow', fr: 'Lueur', en: 'Glow' }, { value: 'blur', fr: 'Flou', en: 'Blur' }, { value: 'bw', fr: 'Noir et blanc', en: 'Black & white' },
  { value: 'chromatic', fr: 'Aberration chromatique', en: 'Chromatic aberration' }, { value: 'vignette', fr: 'Vignettage', en: 'Vignette' },
  { value: 'grain', fr: 'Grain', en: 'Grain' }, { value: 'letterbox', fr: 'Bandes cinéma', en: 'Letterbox' },
];
const FILTERS: { value: VideoClip['filter']; fr: string; en: string }[] = [
  { value: 'none', fr: 'Aucun', en: 'None' }, { value: 'vivid', fr: 'Éclatant', en: 'Vivid' }, { value: 'warm', fr: 'Chaud', en: 'Warm' },
  { value: 'cool', fr: 'Froid', en: 'Cool' }, { value: 'bw', fr: 'Noir et blanc', en: 'B&W' }, { value: 'fade', fr: 'Délavé', en: 'Faded' },
];

const span = (c: AnyClip) => ('end' in c ? { start: c.start, dur: c.end - c.start } : { start: c.start, dur: c.duration });
function list(p: Project, k: TrackKey): AnyClip[] { return p.timeline[k] as AnyClip[]; }

export function Editor({ style, player }: { style: StyleDef; player: ReturnType<typeof usePlayer> }) {
  const { t } = useI18n();
  const { project: p, edit, checkpoint, run } = useProject();
  const [sel, setSel] = useState<Sel>(null);
  const [pps, setPps] = useState(60); // pixels per second
  const [snap, setSnap] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'l' | 'r'; x: number; track: TrackKey; id: string; o: { start: number; dur: number; srcIn: number } } | null>(null);
  const dur = p ? timelineDuration(p) : 0;
  const width = Math.max(800, (dur + 6) * pps);

  const editTl = useCallback((fn: (p: Project) => void, history = true) => edit((pp) => { fn(pp); pp.timeline.edited = true; }, { history }), [edit]);

  const selected = useMemo(() => (p && sel ? list(p, sel.track).find((c) => c.id === sel.id) ?? null : null), [p, sel]);

  const snapPoints = useMemo(() => {
    if (!p) return [] as number[];
    const pts = [0, player.time];
    for (const k of TRACKS) for (const c of list(p, k.key)) { const s = span(c); pts.push(s.start, s.start + s.dur); }
    return pts;
  }, [p, player.time]);
  const snapT = (v: number, ignore?: number[]) => {
    if (!snap) return Math.round(v * 100) / 100;
    for (const s of snapPoints) if (!ignore?.includes(s) && Math.abs(s - v) * pps < 7) return s;
    return Math.round(v * 20) / 20;
  };

  const onDown = (e: React.PointerEvent, track: TrackKey, c: AnyClip, mode: 'move' | 'l' | 'r') => {
    e.stopPropagation(); e.preventDefault();
    setSel({ track, id: c.id });
    const s = span(c);
    drag.current = { mode, x: e.clientX, track, id: c.id, o: { start: s.start, dur: s.dur, srcIn: 'srcIn' in c ? c.srcIn : 0 } };
    checkpoint();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dt = (e.clientX - d.x) / pps;
    editTl((pp) => {
      const c = list(pp, d.track).find((x) => x.id === d.id) as any; if (!c) return;
      const setSpan = (start: number, du: number) => { if ('end' in c) { const s0 = c.start, d0 = Math.max(0.01, c.end - c.start); c.words = c.words.map((w: any) => ({ ...w, start: start + (w.start - s0) * (du / d0), end: start + (w.end - s0) * (du / d0) })); c.start = start; c.end = start + du; } else { c.start = start; c.duration = du; } };
      const maxSrc = 'assetId' in c && c.assetId ? pp.assets.find((a) => a.id === c.assetId)?.duration : undefined;
      if (d.mode === 'move') { const ns = Math.max(0, snapT(d.o.start + dt, [d.o.start, d.o.start + d.o.dur])); setSpan(ns, d.o.dur); }
      if (d.mode === 'r') { let nd = Math.max(0.2, snapT(d.o.start + d.o.dur + dt, [d.o.start + d.o.dur]) - d.o.start); if (maxSrc && d.track !== 'video') nd = Math.min(nd, (maxSrc - d.o.srcIn) / (c.speed || 1)); setSpan(d.o.start, nd); }
      if (d.mode === 'l') {
        let ns = Math.min(d.o.start + d.o.dur - 0.2, snapT(d.o.start + dt, [d.o.start]));
        ns = Math.max(0, ns);
        let shift = ns - d.o.start;
        if ('srcIn' in c) { const nsrc = d.o.srcIn + shift * (c.speed || 1); if (nsrc < 0 && (d.track !== 'video' || c.assetId)) { shift = -d.o.srcIn / (c.speed || 1); } c.srcIn = Math.max(0, d.o.srcIn + shift * (c.speed || 1)); }
        setSpan(d.o.start + shift, d.o.dur - shift);
      }
    }, false);
  };
  const onUp = () => { drag.current = null; };

  const split = useCallback(() => {
    if (!p || !sel) return;
    const at = player.time;
    editTl((pp) => {
      const arr = list(pp, sel.track) as any[];
      const i = arr.findIndex((x) => x.id === sel.id); if (i < 0) return;
      const c = arr[i]; const s = span(c);
      if (at <= s.start + 0.1 || at >= s.start + s.dur - 0.1) return;
      const b = structuredClone(c); b.id = uid('k_');
      const cut = at - s.start;
      if ('end' in c) { c.end = at; b.start = at; const words = c.words as Caption['words']; c.words = words.filter((w) => w.start < at); b.words = words.filter((w) => w.start >= at); c.text = c.words.map((w: any) => w.text).join(' ') || c.text; b.text = b.words.map((w: any) => w.text).join(' ') || b.text; }
      else { c.duration = cut; b.start = at; b.duration = s.dur - cut; if ('srcIn' in b) b.srcIn = (c.srcIn ?? 0) + cut * (c.speed || 1); if (sel.track === 'video') b.transition = { type: 'cut', duration: 0 }; if ('fadeOut' in c) { b.fadeIn = 0; c.fadeOut = 0; } }
      arr.splice(i + 1, 0, b);
    });
  }, [p, sel, player.time, editTl]);

  const remove = useCallback(() => {
    if (!sel) return;
    editTl((pp) => { (pp.timeline as any)[sel.track] = list(pp, sel.track).filter((c) => c.id !== sel.id); });
    setSel(null);
  }, [sel, editTl]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) split();
      if (e.key === 'ArrowLeft') player.seek(player.time - (e.shiftKey ? 1 : 1 / 30));
      if (e.key === 'ArrowRight') player.seek(player.time + (e.shiftKey ? 1 : 1 / 30));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [remove, split, player]);

  // Keep the playhead visible while playing.
  useEffect(() => {
    const el = scroller.current; if (!el || !player.playing) return;
    const x = player.time * pps + 120;
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft + 120) el.scrollLeft = x - 200;
  }, [player.time, player.playing, pps]);

  if (!p) return null;

  const addEffect = (type: EffectType) => editTl((pp) => { const c: EffectClip = { id: uid('e_'), type, start: player.time, duration: type === 'flash' || type === 'zoom-punch' ? 0.5 : 2, intensity: 0.7 }; pp.timeline.effects.push(c); setSel({ track: 'effects', id: c.id }); });
  const addSfx = (type: SfxType) => editTl((pp) => { const c: AudioClip = { id: uid('x_'), assetId: sfxAssetId(type), label: type, start: player.time, duration: SFX_DURATION[type] ?? 1, srcIn: 0, gainDb: -6, speed: 1, fadeIn: 0, fadeOut: 0.05 }; pp.timeline.sfx.push(c); setSel({ track: 'sfx', id: c.id }); });
  const addText = () => editTl((pp) => { const c: VideoClip = { id: uid('v_'), start: dur, duration: 3, srcIn: 0, speed: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, filter: 'none', camera: 'push-in', transition: { type: 'crossfade', duration: 0.6 }, text: t('Votre texte', 'Your text') }; pp.timeline.video.push(c); setSel({ track: 'video', id: c.id }); });
  const addCaption = () => editTl((pp) => { const c: Caption = { id: uid('c_'), start: player.time, end: player.time + 2, text: t('Nouveau sous-titre', 'New caption'), words: [] }; pp.timeline.captions.push(c); pp.timeline.captions.sort((a, b) => a.start - b.start); setSel({ track: 'captions', id: c.id }); });
  const addMedia = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,video/*,audio/*';
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const fd = new FormData(); fd.set('file', f); fd.set('role', f.type.startsWith('audio/') ? 'media' : 'media');
      const before = new Set(p.assets.map((a) => a.id));
      const r = await run('upload', () => api<Project>(`/api/projects/${p.id}/assets`, { form: fd }));
      const a = r?.assets.find((x) => !before.has(x.id)); if (!a) return;
      const at = useProject.getState().project ? timelineDuration(useProject.getState().project!) : 0;
      editTl((pp) => {
        if (a.kind === 'audio') { const c: AudioClip = { id: uid('x_'), assetId: a.id, label: a.name, start: player.time, duration: a.duration ?? 3, srcIn: 0, gainDb: 0, speed: 1, fadeIn: 0, fadeOut: 0.1 }; pp.timeline.sfx.push(c); setSel({ track: 'sfx', id: c.id }); }
        else { const c: VideoClip = { id: uid('v_'), assetId: a.id, start: at, duration: a.kind === 'video' ? Math.min(a.duration ?? 5, 30) : 4, srcIn: 0, speed: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, filter: 'none', camera: a.kind === 'video' ? 'static' : 'push-in', transition: { type: 'crossfade', duration: 0.6 }, text: '' }; pp.timeline.video.push(c); setSel({ track: 'video', id: c.id }); }
      });
      toast.ok(t('Média ajouté au montage', 'Media added to the timeline'));
    };
    inp.click();
  };
  const pack = () => editTl((pp) => { let t0 = 0; for (const c of [...pp.timeline.video].sort((a, b) => a.start - b.start)) { const shift = c.start - t0; if (c.sceneId) for (const v of pp.timeline.voice) if (v.sceneId === c.sceneId) v.start -= shift; c.start = t0; t0 += c.duration; } });

  const ticks: number[] = []; const step = pps >= 120 ? 0.5 : pps >= 50 ? 1 : pps >= 25 ? 2 : 5;
  for (let s = 0; s <= dur + 6; s += step) ticks.push(s);
  const label = (k: TrackKey, c: AnyClip) => {
    if (k === 'video') { const v = c as VideoClip; const sc = p.scenes.find((s) => s.id === v.sceneId); return v.text || sc?.title || p.assets.find((a) => a.id === v.assetId)?.name || t('Plan', 'Shot'); }
    if (k === 'captions') return (c as Caption).text;
    if (k === 'effects') { const e = EFFECTS.find((x) => x.value === (c as EffectClip).type); return e ? t(e.fr, e.en) : ''; }
    const a = c as AudioClip; const sx = SFX.find((x) => sfxAssetId(x.value) === a.assetId); return sx ? t(sx.fr, sx.en) : a.label;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <PlayerView player={player} maxH="46vh" />
        <Inspector p={p} sel={sel} clip={selected} editTl={editTl} style={style} />
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] p-2">
          <button className="btn-ghost btn-sm" disabled={!sel} onClick={split} title={t('Couper au curseur (S)', 'Split at playhead (S)')}><Scissors size={14} /> {t('Couper', 'Split')}</button>
          <button className="btn-ghost btn-sm" disabled={!sel} onClick={remove} title={t('Supprimer (Suppr)', 'Delete (Del)')}><Trash2 size={14} /> {t('Supprimer', 'Delete')}</button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button className="btn-ghost btn-sm" onClick={addMedia}><ImagePlus size={14} /> {t('Média', 'Media')}</button>
          <button className="btn-ghost btn-sm" onClick={addText}><Type size={14} /> {t('Carton texte', 'Text card')}</button>
          <button className="btn-ghost btn-sm" onClick={addCaption}><Captions size={14} /> {t('Sous-titre', 'Caption')}</button>
          <select className="input h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && addEffect(e.target.value as EffectType)}><option value="" className="bg-ink-900">+ {t('Effet', 'Effect')}</option>{EFFECTS.map((x) => <option key={x.value} value={x.value} className="bg-ink-900">{t(x.fr, x.en)}</option>)}</select>
          <select className="input h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && addSfx(e.target.value as SfxType)}><option value="" className="bg-ink-900">+ {t('Bruitage', 'SFX')}</option>{SFX.map((x) => <option key={x.value} value={x.value} className="bg-ink-900">{t(x.fr, x.en)}</option>)}</select>
          <button className="btn-ghost btn-sm" onClick={pack} title={t('Supprimer les vides entre les plans', 'Remove gaps between shots')}><Plus size={14} className="rotate-45" /> {t('Coller les plans', 'Close gaps')}</button>
          <div className="ml-auto flex items-center gap-1">
            <button className={`btn-icon h-8 w-8 ${snap ? 'text-violet-300' : ''}`} onClick={() => setSnap(!snap)} title={t('Magnétisme', 'Snapping')}><Magnet size={15} /></button>
            <button className="btn-icon h-8 w-8" onClick={() => setPps((x) => Math.max(10, x / 1.4))}><ZoomOut size={15} /></button>
            <button className="btn-icon h-8 w-8" onClick={() => setPps((x) => Math.min(400, x * 1.4))}><ZoomIn size={15} /></button>
          </div>
        </div>
        <div className="flex">
          <div className="w-[120px] shrink-0 border-r border-white/[0.06] bg-ink-900">
            <div className="h-7 border-b border-white/[0.06]" />
            {TRACKS.map((k) => <div key={k.key} className="flex h-12 items-center gap-2 border-b border-white/[0.04] px-3 text-xs text-ink-300"><k.icon size={13} /> {t(k.fr, k.en)}</div>)}
          </div>
          <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <div style={{ width }} className="relative select-none">
              <div className="relative h-7 cursor-pointer border-b border-white/[0.06] bg-ink-900/60" onPointerDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); player.seek((e.clientX - r.left) / pps); }}>
                {ticks.map((s) => <div key={s} className="absolute top-0 h-full border-l border-white/10 pl-1 font-mono text-[10px] leading-7 text-ink-400" style={{ left: s * pps }}>{Number.isInteger(s) ? formatTime(s) : ''}</div>)}
              </div>
              {TRACKS.map((k) => (
                <div key={k.key} className="relative h-12 border-b border-white/[0.04]" onPointerDown={(e) => { if (e.target === e.currentTarget) { setSel(null); const r = e.currentTarget.getBoundingClientRect(); player.seek((e.clientX - r.left) / pps); } }}>
                  {list(p, k.key).map((c) => {
                    const s = span(c); const on = sel?.id === c.id;
                    return (
                      <div key={c.id} onPointerDown={(e) => onDown(e, k.key, c, 'move')}
                        className={`absolute top-1.5 flex h-9 cursor-grab items-center overflow-hidden rounded-md border bg-gradient-to-b px-2 text-[11px] font-medium text-white/95 shadow-sm active:cursor-grabbing ${k.color} ${on ? 'ring-2 ring-white/80' : ''}`}
                        style={{ left: s.start * pps, width: Math.max(4, s.dur * pps) }} title={label(k.key, c)}>
                        <span className="pointer-events-none truncate">{label(k.key, c)}</span>
                        {k.key === 'video' && (c as VideoClip).transition?.type !== 'cut' && <span className="pointer-events-none absolute left-0 top-0 h-full w-2 bg-white/25" />}
                        <span onPointerDown={(e) => onDown(e, k.key, c, 'l')} className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-white/40" />
                        <span onPointerDown={(e) => onDown(e, k.key, c, 'r')} className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-white/40" />
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="pointer-events-none absolute top-0 h-full w-px bg-red-400" style={{ left: player.time * pps }}><div className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 bg-red-400" /></div>
              <div className="pointer-events-none absolute top-7 bottom-0 border-l border-dashed border-white/20" style={{ left: dur * pps }} />
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.06] px-3 py-2 text-[11px] text-ink-500">{t('Glisser pour déplacer · bords pour rogner · S couper · Suppr supprimer · ←/→ image par image · Ctrl/Cmd+Z annuler', 'Drag to move · edges to trim · S split · Del delete · ←/→ frame step · Ctrl/Cmd+Z undo')}</div>
      </div>
    </div>
  );
}

function Inspector({ p, sel, clip, editTl, style }: { p: Project; sel: Sel; clip: AnyClip | null; editTl: (fn: (p: Project) => void, history?: boolean) => void; style: StyleDef }) {
  const { t } = useI18n();
  void style;
  if (!sel || !clip) return <div className="panel grid place-items-center p-6 text-center text-sm text-ink-400">{t('Sélectionnez un élément du montage pour le modifier : durée, vitesse, recadrage, volume, transition…', 'Select an item in the timeline to edit it: duration, speed, crop, volume, transition…')}</div>;
  const upd = (patch: Record<string, any>, history = false) => editTl((pp) => { const c = list(pp, sel.track).find((x) => x.id === sel.id); if (c) Object.assign(c, patch); }, history);
  const s = span(clip);
  return (
    <div className="panel max-h-[60vh] space-y-3 overflow-y-auto p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-violet-300">{t('Inspecteur', 'Inspector')}</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('Début (s)', 'Start (s)')}><input type="number" step={0.05} className="input h-9" value={+s.start.toFixed(2)} onChange={(e) => { const v = Math.max(0, parseFloat(e.target.value) || 0); upd('end' in clip ? { start: v, end: v + s.dur } : { start: v }, true); }} /></Field>
        <Field label={t('Durée (s)', 'Duration (s)')}><input type="number" step={0.05} min={0.2} className="input h-9" value={+s.dur.toFixed(2)} onChange={(e) => { const v = Math.max(0.2, parseFloat(e.target.value) || 0.2); upd('end' in clip ? { end: s.start + v } : { duration: v }, true); }} /></Field>
      </div>
      {sel.track === 'video' && (() => { const c = clip as VideoClip; return (<>
        <Field label={t('Texte (remplace celui de la scène)', 'Text (overrides the scene)')}><textarea className="textarea text-xs" rows={2} value={c.text ?? ''} placeholder={p.scenes.find((x) => x.id === c.sceneId)?.onScreenText} onChange={(e) => upd({ text: e.target.value || undefined })} /></Field>
        <Field label={t('Vitesse', 'Speed')}><Slider value={c.speed} min={0.25} max={4} step={0.05} onChange={(v) => upd({ speed: v })} format={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label={t('Zoom / recadrage', 'Zoom / crop')}><Slider value={c.zoom} min={0.5} max={3} step={0.01} onChange={(v) => upd({ zoom: v })} format={(v) => `${Math.round(v * 100)} %`} /></Field>
        <Field label={t('Position horizontale', 'Horizontal position')}><Slider value={c.offsetX} min={-1} max={1} step={0.01} onChange={(v) => upd({ offsetX: v })} format={(v) => v.toFixed(2)} /></Field>
        <Field label={t('Position verticale', 'Vertical position')}><Slider value={c.offsetY} min={-1} max={1} step={0.01} onChange={(v) => upd({ offsetY: v })} format={(v) => v.toFixed(2)} /></Field>
        <Field label={t('Rotation', 'Rotation')}><Slider value={c.rotation} min={-180} max={180} step={1} onChange={(v) => upd({ rotation: v })} format={(v) => `${v}°`} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('Filtre', 'Filter')}><select className="input h-9 text-xs" value={c.filter} onChange={(e) => upd({ filter: e.target.value }, true)}>{FILTERS.map((x) => <option key={x.value} value={x.value} className="bg-ink-900">{t(x.fr, x.en)}</option>)}</select></Field>
          <Field label={t('Caméra', 'Camera')}><select className="input h-9 text-xs" value={c.camera ?? p.scenes.find((x) => x.id === c.sceneId)?.camera ?? 'static'} onChange={(e) => upd({ camera: e.target.value }, true)}>{CAMERAS.map((x) => <option key={x.value} value={x.value} className="bg-ink-900">{t(x.fr, x.en)}</option>)}</select></Field>
          <Field label={t('Transition d’entrée', 'In transition')}><select className="input h-9 text-xs" value={c.transition.type} onChange={(e) => upd({ transition: { ...c.transition, type: e.target.value, duration: c.transition.duration || 0.6 } }, true)}>{TRANSITIONS.map((x) => <option key={x.value} value={x.value} className="bg-ink-900">{t(x.fr, x.en)}</option>)}</select></Field>
          <Field label={t('Durée transition', 'Transition length')}><input type="number" step={0.1} min={0} max={3} className="input h-9" value={c.transition.duration} onChange={(e) => upd({ transition: { ...c.transition, duration: clamp(parseFloat(e.target.value) || 0, 0, 3) } }, true)} /></Field>
        </div>
      </>); })()}
      {(sel.track === 'voice' || sel.track === 'music' || sel.track === 'sfx') && (() => { const c = clip as AudioClip; return (<>
        <Field label={t('Volume', 'Volume')}><Slider value={c.gainDb} min={-40} max={12} step={0.5} onChange={(v) => upd({ gainDb: v })} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} /></Field>
        <Field label={t('Vitesse', 'Speed')}><Slider value={c.speed} min={0.5} max={2} step={0.05} onChange={(v) => upd({ speed: v })} format={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label={t('Fondu d’entrée', 'Fade in')}><Slider value={c.fadeIn} min={0} max={5} step={0.05} onChange={(v) => upd({ fadeIn: v })} format={(v) => `${v.toFixed(2)} s`} /></Field>
        <Field label={t('Fondu de sortie', 'Fade out')}><Slider value={c.fadeOut} min={0} max={5} step={0.05} onChange={(v) => upd({ fadeOut: v })} format={(v) => `${v.toFixed(2)} s`} /></Field>
        <Field label={t('Début dans le fichier (s)', 'Offset in file (s)')}><input type="number" step={0.05} min={0} className="input h-9" value={+c.srcIn.toFixed(2)} onChange={(e) => upd({ srcIn: Math.max(0, parseFloat(e.target.value) || 0) }, true)} /></Field>
      </>); })()}
      {sel.track === 'effects' && (() => { const c = clip as EffectClip; return (<>
        <Field label={t('Effet', 'Effect')}><select className="input h-9 text-xs" value={c.type} onChange={(e) => upd({ type: e.target.value }, true)}>{EFFECTS.map((x) => <option key={x.value} value={x.value} className="bg-ink-900">{t(x.fr, x.en)}</option>)}</select></Field>
        <Field label={t('Intensité', 'Intensity')}><Slider value={c.intensity} min={0} max={1} step={0.01} onChange={(v) => upd({ intensity: v })} format={(v) => `${Math.round(v * 100)} %`} /></Field>
      </>); })()}
      {sel.track === 'captions' && (() => { const c = clip as Caption; return (
        <Field label={t('Texte', 'Text')}><textarea className="textarea text-xs" rows={3} value={c.text} onChange={(e) => upd({ text: e.target.value, words: estimateWordTimings(e.target.value, c.end - c.start, c.start) })} /></Field>
      ); })()}
    </div>
  );
}
