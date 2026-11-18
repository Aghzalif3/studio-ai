'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Copy, Film, GripVertical, ImagePlus, Lock, Mic, Plus, RefreshCw, Sparkles, Trash2, Upload, Wand2, X } from 'lucide-react';
import type { CameraMove, Project, Scene, SceneLayout, SfxType, TransitionType } from '@/lib/types';
import type { StyleDef } from '@/lib/styles/types';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { ApiError, api, assetUrl, paid, toast, useCostDialog } from '@/lib/client/api';
import { useEngines } from '@/lib/client/engines';
import { syncTimeline, buildTimeline } from '@/lib/project';
import { uid } from '@/lib/util';
import { EngineSelect } from '../EngineSelect';
import { Field, Modal, Select, Spinner } from '../ui';
import { SceneThumb } from './SceneThumb';

export const CAMERAS: { value: CameraMove; fr: string; en: string }[] = [
  { value: 'static', fr: 'Fixe', en: 'Static' }, { value: 'push-in', fr: 'Travelling avant', en: 'Push in' }, { value: 'pull-out', fr: 'Travelling arrière', en: 'Pull out' },
  { value: 'pan-left', fr: 'Panoramique gauche', en: 'Pan left' }, { value: 'pan-right', fr: 'Panoramique droite', en: 'Pan right' }, { value: 'tilt-up', fr: 'Bascule haut', en: 'Tilt up' },
  { value: 'tilt-down', fr: 'Bascule bas', en: 'Tilt down' }, { value: 'orbit', fr: 'Orbite', en: 'Orbit' }, { value: 'shake', fr: 'Caméra à l’épaule', en: 'Handheld' }, { value: 'dolly-zoom', fr: 'Effet vertigo', en: 'Dolly zoom' },
];
export const TRANSITIONS: { value: TransitionType; fr: string; en: string }[] = [
  { value: 'cut', fr: 'Coupe franche', en: 'Cut' }, { value: 'fade', fr: 'Fondu au noir', en: 'Fade' }, { value: 'crossfade', fr: 'Fondu enchaîné', en: 'Crossfade' },
  { value: 'slide-left', fr: 'Glissement', en: 'Slide' }, { value: 'slide-up', fr: 'Glissement haut', en: 'Slide up' }, { value: 'zoom', fr: 'Zoom', en: 'Zoom' },
  { value: 'wipe', fr: 'Volet', en: 'Wipe' }, { value: 'glitch', fr: 'Glitch', en: 'Glitch' }, { value: 'flash', fr: 'Flash', en: 'Flash' }, { value: 'blur', fr: 'Flou', en: 'Blur' },
];
export const LAYOUTS: { value: SceneLayout; fr: string; en: string }[] = [
  { value: 'title', fr: 'Titre', en: 'Title' }, { value: 'statement', fr: 'Phrase forte', en: 'Statement' }, { value: 'list', fr: 'Liste', en: 'List' },
  { value: 'stat', fr: 'Chiffre clé', en: 'Key figure' }, { value: 'quote', fr: 'Citation', en: 'Quote' }, { value: 'cta', fr: 'Appel à l’action', en: 'Call to action' }, { value: 'image', fr: 'Image + légende', en: 'Image + caption' },
];
export const SFX: { value: SfxType; fr: string; en: string }[] = [
  { value: 'whoosh', fr: 'Whoosh', en: 'Whoosh' }, { value: 'swoosh', fr: 'Swoosh', en: 'Swoosh' }, { value: 'impact', fr: 'Impact', en: 'Impact' }, { value: 'boom', fr: 'Boom', en: 'Boom' },
  { value: 'riser', fr: 'Montée', en: 'Riser' }, { value: 'click', fr: 'Clic', en: 'Click' }, { value: 'pop', fr: 'Pop', en: 'Pop' }, { value: 'ding', fr: 'Ding', en: 'Ding' },
  { value: 'shimmer', fr: 'Scintillement', en: 'Shimmer' }, { value: 'typing', fr: 'Clavier', en: 'Typing' },
];

const blankScene = (n: number): Scene => ({ id: uid('s_'), title: `Scène ${n}`, layout: 'statement', visual: '', onScreenText: '', narration: '', duration: 4, camera: 'push-in', transition: 'crossfade', music: '', sfx: [], keywords: [] });

export function useSceneEdit() {
  const edit = useProject((s) => s.edit);
  return (fn: (p: Project) => void) => edit((p) => { fn(p); syncTimeline(p); });
}

function SceneCard({ p, s, i, style, onDragStart, onDrop }: { p: Project; s: Scene; i: number; style: StyleDef; onDragStart: () => void; onDrop: () => void }) {
  const { t } = useI18n();
  const editScene = useSceneEdit();
  const { run, busy } = useProject();
  const [imgEngine, setImgEngine] = useState<string>('');
  const [vidOpen, setVidOpen] = useState(false);
  const [vidEngine, setVidEngine] = useState('fal-video');
  const engines = useEngines();
  useEffect(() => { setImgEngine((x) => x || engines.selected.image || 'procedural'); }, [engines.selected.image]);
  const up = (patch: Partial<Scene>) => editScene((pp) => { Object.assign(pp.scenes.find((x) => x.id === s.id)!, patch); });
  const kImg = `img:${s.id}`, kVoice = `voice:${s.id}`, kVid = `vid:${s.id}`;
  const img = s.imageAssetId && p.assets.find((a) => a.id === s.imageAssetId);
  const vid = s.videoAssetId && p.assets.find((a) => a.id === s.videoAssetId);
  const engineName = engines.items.find((e) => e.id === imgEngine)?.name ?? imgEngine;

  const genImage = () => run(kImg, () => paid(`/api/projects/${p.id}/scenes/${s.id}/image`, { engine: imgEngine }, t(`Image de la scène ${i + 1} (${engineName})`, `Scene ${i + 1} image (${engineName})`)));
  const genVoice = () => run(kVoice, () => paid(`/api/projects/${p.id}/scenes/${s.id}/voice`, {}, t('Narration de la scène', 'Scene narration')));
  const genVideo = async () => { setVidOpen(false); await run(kVid, () => paid(`/api/projects/${p.id}/scenes/${s.id}/video`, { engine: vidEngine }, t(`Vidéo IA de la scène ${i + 1}`, `Scene ${i + 1} AI video`))); };
  const upload = (role: 'image' | 'video') => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = role === 'image' ? 'image/*' : 'video/*';
    inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const fd = new FormData(); fd.set('file', f); fd.set('role', role); fd.set('sceneId', s.id); void run(kImg, () => api(`/api/projects/${p.id}/assets`, { form: fd })); };
    inp.click();
  };
  const move = (d: number) => editScene((pp) => { const j = i + d; if (j < 0 || j >= pp.scenes.length) return; const [x] = pp.scenes.splice(i, 1); pp.scenes.splice(j, 0, x); pp.storyboardValidated = false; });

  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
      className="panel group/card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2">
        <GripVertical size={15} className="cursor-grab text-ink-500" />
        <span className="grid h-6 min-w-6 place-items-center rounded-md bg-violet-500/20 px-1.5 text-xs font-bold text-violet-200">{i + 1}</span>
        <input className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" value={s.title} onChange={(e) => up({ title: e.target.value })} />
        <div className="flex items-center opacity-70 transition group-hover/card:opacity-100">
          <button className="btn-icon h-7 w-7" title={t('Monter', 'Move up')} onClick={() => move(-1)}><ArrowUp size={14} /></button>
          <button className="btn-icon h-7 w-7" title={t('Descendre', 'Move down')} onClick={() => move(1)}><ArrowDown size={14} /></button>
          <button className="btn-icon h-7 w-7" title={t('Dupliquer', 'Duplicate')} onClick={() => editScene((pp) => { const c = structuredClone(pp.scenes[i]); c.id = uid('s_'); delete c.voice; delete c.imageAssetId; delete c.videoAssetId; pp.scenes.splice(i + 1, 0, c); })}><Copy size={14} /></button>
          <button className="btn-icon h-7 w-7 hover:text-red-300" title={t('Supprimer', 'Delete')} onClick={() => editScene((pp) => { pp.scenes.splice(i, 1); pp.storyboardValidated = false; })}><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="grid gap-4 p-3 md:grid-cols-[minmax(0,300px)_1fr]">
        <div>
          <div className="relative overflow-hidden rounded-lg border border-white/[0.06]">
            <SceneThumb project={p} style={style} sceneId={s.id} />
            {(busy[kImg] || busy[kVid]) && <div className="absolute inset-0 grid place-items-center bg-black/60"><Spinner size={22} /></div>}
            {vid && <span className="badge absolute left-2 top-2 bg-blue-500/80 text-white"><Film size={10} /> {t('Vidéo', 'Video')}</span>}
            {!vid && img && <span className="badge absolute left-2 top-2 bg-black/70 text-white">{img.source === 'generated' ? (img.engine ?? 'IA') : t('Image importée', 'Uploaded')}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select className="input h-8 w-auto flex-1 text-xs" value={imgEngine} onChange={(e) => setImgEngine(e.target.value)}>
              {engines.items.filter((e) => e.kind === 'image').map((e) => <option key={e.id} value={e.id} className="bg-ink-900">{e.name}{e.tier === 'paid' ? ' ($)' : ''}{!e.ready ? ' ⚠' : ''}</option>)}
            </select>
            <button className="btn-outline btn-sm" disabled={busy[kImg]} onClick={genImage} title={t('Générer / régénérer l’image', 'Generate / regenerate image')}>{img ? <RefreshCw size={13} /> : <Wand2 size={13} />}{imgEngine === 'procedural' ? t('Procédural', 'Procedural') : img ? t('Régénérer', 'Regenerate') : t('Générer', 'Generate')}</button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => upload('image')}><ImagePlus size={13} /> {t('Importer', 'Upload')}</button>
            <button className="btn-ghost btn-sm" onClick={() => upload('video')}><Upload size={13} /> {t('Vidéo', 'Video')}</button>
            {img && !vid && <button className="btn-ghost btn-sm" onClick={() => setVidOpen(true)}><Film size={13} /> {t('Image → vidéo IA', 'Image → AI video')}</button>}
            {vid && <button className="btn-ghost btn-sm" onClick={() => run(kVid, () => api(`/api/projects/${p.id}/scenes/${s.id}/video`, { body: { engine: 'local-motion', remove: true } }))}><X size={13} /> {t('Retirer la vidéo', 'Remove video')}</button>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Description visuelle', 'Visual description')} className="sm:col-span-2"><textarea className="textarea text-xs" rows={2} value={s.visual} onChange={(e) => up({ visual: e.target.value })} placeholder={t('Ce qu’on voit à l’image (sert de consigne aux moteurs d’images)', 'What we see (used as the image engine prompt)')} /></Field>
          <Field label={t('Texte à l’écran', 'On-screen text')}><textarea className="textarea text-xs" rows={2} value={s.onScreenText} onChange={(e) => up({ onScreenText: e.target.value })} /></Field>
          <Field label={t('Narration', 'Narration')}>
            <textarea className="textarea text-xs" rows={2} value={s.narration} onChange={(e) => up({ narration: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:grid-cols-4">
            <Field label={t('Durée (s)', 'Duration (s)')}><input type="number" step={0.5} min={1} max={60} className="input h-9 text-xs" value={s.duration} onChange={(e) => up({ duration: Math.max(1, Math.min(60, parseFloat(e.target.value) || 1)) })} /></Field>
            <Field label={t('Mise en page', 'Layout')}><select className="input h-9 text-xs" value={s.layout} onChange={(e) => up({ layout: e.target.value as SceneLayout })}>{LAYOUTS.map((o) => <option key={o.value} value={o.value} className="bg-ink-900">{t(o.fr, o.en)}</option>)}</select></Field>
            <Field label={t('Caméra', 'Camera')}><select className="input h-9 text-xs" value={s.camera} onChange={(e) => up({ camera: e.target.value as CameraMove })}>{CAMERAS.map((o) => <option key={o.value} value={o.value} className="bg-ink-900">{t(o.fr, o.en)}</option>)}</select></Field>
            <Field label={t('Transition d’entrée', 'In transition')}><select className="input h-9 text-xs" value={s.transition} onChange={(e) => up({ transition: e.target.value as TransitionType })}>{TRANSITIONS.map((o) => <option key={o.value} value={o.value} className="bg-ink-900">{t(o.fr, o.en)}</option>)}</select></Field>
          </div>
          <Field label={t('Musique (intention)', 'Music (cue)')}><input className="input h-9 text-xs" value={s.music} onChange={(e) => up({ music: e.target.value })} /></Field>
          <Field label={t('Mots-clés surlignés', 'Highlighted keywords')}><input className="input h-9 text-xs" value={s.keywords.join(', ')} onChange={(e) => up({ keywords: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
          <div className="sm:col-span-2">
            <span className="label">{t('Bruitages', 'Sound effects')}</span>
            <div className="flex flex-wrap gap-1.5">{SFX.map((o) => { const on = s.sfx.includes(o.value); return <button key={o.value} className={`chip h-7 ${on ? 'chip-on' : ''}`} onClick={() => up({ sfx: on ? s.sfx.filter((x) => x !== o.value) : [...s.sfx, o.value] })}>{t(o.fr, o.en)}</button>; })}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            {p.brief.narration !== 'none' && p.brief.narration !== 'own' && <button className="btn-outline btn-sm" disabled={busy[kVoice] || !s.narration.trim()} onClick={genVoice}>{busy[kVoice] ? <Spinner size={13} /> : <Mic size={13} />}{s.voice ? t('Régénérer la voix', 'Regenerate voice') : t('Générer la voix', 'Generate voice')}</button>}
            {s.voice && <audio key={s.voice.assetId} controls preload="none" src={assetUrl(p.id, s.voice.assetId)} className="h-8 max-w-[240px]" />}
            {s.voice && <span className="text-[11px] text-ink-400">{s.voice.duration.toFixed(1)} s · {s.voice.voice}</span>}
          </div>
        </div>
      </div>
      <Modal open={vidOpen} onClose={() => setVidOpen(false)} title={t('Générer une vraie vidéo IA depuis l’image', 'Generate a real AI video from the image')}>
        <p className="mb-4 text-sm text-ink-300">{t('Sans moteur vidéo, Studio AI anime déjà l’image avec la caméra choisie. Un moteur image → vidéo crée un vrai mouvement dans l’image (personnages, éléments). Ces moteurs sont payants.', 'Without a video engine, Studio AI already animates the image with the chosen camera. An image-to-video engine creates real motion inside the picture. These engines are paid.')}</p>
        <EngineSelect kind="video" value={vidEngine} onChange={setVidEngine} dense />
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setVidOpen(false)}>{t('Annuler', 'Cancel')}</button><button className="btn-primary" disabled={vidEngine === 'local-motion'} onClick={genVideo}><Sparkles size={15} /> {t('Générer', 'Generate')}</button></div>
      </Modal>
    </div>
  );
}

export function Storyboard({ style }: { style: StyleDef }) {
  const { t } = useI18n();
  const { project: p, run, busy, edit } = useProject();
  const editScene = useSceneEdit();
  const engines = useEngines();
  const [drag, setDrag] = useState<number | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptEngine, setScriptEngine] = useState('');
  const [batchEngine, setBatchEngine] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  useEffect(() => { void engines.load().catch(() => {}); }, []);
  useEffect(() => { setScriptEngine((x) => x || p?.scriptEngine || engines.selected.text || 'offline'); setBatchEngine((x) => x || engines.selected.image || 'procedural'); }, [engines.selected, p?.scriptEngine]);
  if (!p) return null;
  const total = p.scenes.reduce((a, s) => a + s.duration, 0);

  const regenScript = async () => { setScriptOpen(false); await run('script', () => paid(`/api/projects/${p.id}/script`, { engine: scriptEngine }, t('Réécriture du scénario', 'Rewriting the script'))); };
  const allVoices = () => run('voices', async () => { const r = await paid<{ project: Project; errors: string[] }>(`/api/projects/${p.id}/voices`, {}, t('Toutes les narrations', 'All narrations')); if (r?.errors.length) toast.error(new Error(r.errors[0])); return r; });
  const allImages = async () => {
    const todo = p.scenes.filter((s) => !s.imageAssetId);
    const list = todo.length ? todo : p.scenes;
    const info = engines.items.find((e) => e.id === batchEngine);
    let confirm = false;
    if (info?.tier === 'paid') {
      confirm = await useCostDialog.getState().open((info.unitCostUsd ?? 0) * list.length, t(`${list.length} images avec ${info.name}`, `${list.length} images with ${info.name}`));
      if (!confirm) return;
    }
    useProject.getState().setBusy('images', true);
    try {
      await useProject.getState().flush();
      for (let k = 0; k < list.length; k++) {
        setProgress(`${k + 1}/${list.length}`);
        useProject.getState().setBusy(`img:${list[k].id}`, true);
        try { useProject.getState().replace(await api<Project>(`/api/projects/${p.id}/scenes/${list[k].id}/image`, { body: { engine: batchEngine, confirmCost: confirm } })); }
        catch (e) { toast.error(e); if (!(e instanceof ApiError) || e.status !== 400) break; }
        finally { useProject.getState().setBusy(`img:${list[k].id}`, false); }
      }
    } finally { setProgress(null); useProject.getState().setBusy('images', false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto text-sm text-ink-300">{p.scenes.length} {t('scènes', 'scenes')} · {total.toFixed(1)} s {p.scriptEngine && <span className="text-ink-500">· {t('scénario', 'script')} : {engines.items.find((e) => e.id === p.scriptEngine)?.name ?? p.scriptEngine}</span>}</div>
        <button className="btn-outline btn-sm" disabled={busy.script} onClick={() => setScriptOpen(true)}>{busy.script ? <Spinner size={13} /> : <Sparkles size={13} />} {p.scenes.length ? t('Réécrire le scénario', 'Rewrite script') : t('Générer le scénario', 'Generate script')}</button>
        <div className="flex items-center gap-1">
          <select className="input h-8 w-auto text-xs" value={batchEngine} onChange={(e) => setBatchEngine(e.target.value)}>{engines.items.filter((e) => e.kind === 'image').map((e) => <option key={e.id} value={e.id} className="bg-ink-900">{e.name}{e.tier === 'paid' ? ' ($)' : ''}{!e.ready ? ' ⚠' : ''}</option>)}</select>
          <button className="btn-outline btn-sm" disabled={busy.images || !p.scenes.length || batchEngine === 'procedural'} onClick={allImages}>{busy.images ? <><Spinner size={13} /> {progress}</> : <><ImagePlus size={13} /> {t('Toutes les images', 'All images')}</>}</button>
        </div>
        {p.brief.narration !== 'none' && p.brief.narration !== 'own' && <button className="btn-outline btn-sm" disabled={busy.voices || !p.scenes.length} onClick={allVoices}>{busy.voices ? <Spinner size={13} /> : <Mic size={13} />} {t('Toutes les voix', 'All voices')}</button>}
        <button className={p.storyboardValidated ? 'btn-outline btn-sm border-emerald-500/40 text-emerald-300' : 'btn-primary btn-sm'} disabled={!p.scenes.length} onClick={() => edit((pp) => { pp.storyboardValidated = !pp.storyboardValidated; })}>
          {p.storyboardValidated ? <><CheckCircle2 size={13} /> {t('Storyboard validé', 'Storyboard approved')}</> : <><Lock size={13} /> {t('Valider le storyboard', 'Approve storyboard')}</>}
        </button>
      </div>
      {p.timeline.edited && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
        {t('Le montage a été modifié à la main : les changements de durée, d’ordre ou de transition du storyboard ne s’y appliquent plus automatiquement.', 'The timeline was edited by hand: storyboard changes to duration, order or transitions no longer apply automatically.')}
        <button className="btn-outline btn-sm" onClick={() => edit((pp) => { pp.timeline.edited = false; pp.timeline = buildTimeline(pp, true); })}>{t('Reconstruire le montage depuis le storyboard', 'Rebuild timeline from storyboard')}</button>
      </div>}
      {p.brief.validateStoryboard && !p.storyboardValidated && p.scenes.length > 0 && <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-200">{t('Mode validation activé : relisez les scènes, puis cliquez sur « Valider le storyboard ». Le rendu final reste bloqué jusque-là.', 'Approval mode is on: review the scenes, then click “Approve storyboard”. The final render stays locked until then.')}</div>}
      <div className="space-y-3">
        {p.scenes.map((s, i) => <SceneCard key={s.id} p={p} s={s} i={i} style={style} onDragStart={() => setDrag(i)} onDrop={() => { if (drag === null || drag === i) return; editScene((pp) => { const [x] = pp.scenes.splice(drag, 1); pp.scenes.splice(i, 0, x); pp.storyboardValidated = false; }); setDrag(null); }} />)}
      </div>
      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-4 text-sm text-ink-300 transition hover:border-violet-400/40 hover:text-white" onClick={() => editScene((pp) => { pp.scenes.push(blankScene(pp.scenes.length + 1)); pp.storyboardValidated = false; })}><Plus size={16} /> {t('Ajouter une scène', 'Add a scene')}</button>
      <Modal open={scriptOpen} onClose={() => setScriptOpen(false)} title={t('Générer le scénario', 'Generate the script')} wide>
        <p className="mb-4 text-sm text-ink-300">{t('Le scénario actuel (scènes, textes, narrations) sera remplacé. Les images et voix déjà créées seront retirées des scènes remplacées.', 'The current script (scenes, texts, narrations) will be replaced.')}</p>
        <EngineSelect kind="text" value={scriptEngine} onChange={setScriptEngine} />
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setScriptOpen(false)}>{t('Annuler', 'Cancel')}</button><button className="btn-primary" onClick={regenScript}><Sparkles size={15} /> {t('Générer', 'Generate')}</button></div>
      </Modal>
    </div>
  );
}
