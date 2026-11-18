'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, Film, Lock, Trash2, X } from 'lucide-react';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { api, paid, toast } from '@/lib/client/api';
import type { usePlayer } from '@/lib/client/player';
import { timelineDuration } from '@/lib/render/compose';
import { ASPECT_SIZES } from '@/lib/types';
import { formatBytes, formatTime } from '@/lib/util';
import { Field, Segmented, Spinner } from '../ui';

interface Job { id: string; projectId: string; status: string; progress: number; phase: string; etaSec?: number; fpsRender?: number; resolution: string; fps: number; width: number; height: number; createdAt: string; sizeBytes?: number; elapsedSec?: number; error?: string; file?: string }

const PHASE: Record<string, [string, string]> = {
  queued: ['En file d’attente', 'Queued'], prepare: ['Préparation', 'Preparing'], audio: ['Mixage audio', 'Mixing audio'], media: ['Chargement des médias', 'Loading media'],
  frames: ['Rendu des images', 'Rendering frames'], encode: ['Encodage', 'Encoding'], done: ['Terminé', 'Done'],
};

export function ExportTab({ player }: { player: ReturnType<typeof usePlayer> }) {
  const { t } = useI18n();
  const { project: p, flush } = useProject();
  const [res, setRes] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [starting, setStarting] = useState(false);
  void player;

  useEffect(() => { api<{ settings: any }>('/api/settings').then((r) => { setRes(r.settings.video.resolution); setFps(r.settings.video.fps); setQuality(p?.brief.quality ?? r.settings.quality); }).catch(() => {}); }, []);
  const refresh = useCallback(() => api<{ items: Job[] }>('/api/renders').then((r) => setJobs(r.items.filter((j) => j.projectId === p?.id))).catch(() => {}), [p?.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => { if (!active) return; const id = setInterval(refresh, 700); return () => clearInterval(id); }, [active, refresh]);

  if (!p) return null;
  const dur = timelineDuration(p);
  const [w, h] = ASPECT_SIZES[p.brief.aspect][res];
  const locked = p.brief.validateStoryboard && !p.storyboardValidated;
  const start = async () => {
    setStarting(true);
    try { await flush(); const r = await paid(`/api/projects/${p.id}/render`, { resolution: res, fps, quality }, t('Voix manquantes avant le rendu', 'Missing voices before render')); if (r) await refresh(); }
    catch (e) { toast.error(e); } finally { setStarting(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <section className="panel h-fit space-y-5 p-5">
        <h3 className="font-display text-lg font-semibold">{t('Exporter en MP4', 'Export to MP4')}</h3>
        <Field label={t('Résolution', 'Resolution')}><Segmented value={res} onChange={setRes} options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }, { value: '4k', label: '4K' }]} /></Field>
        <Field label={t('Images par seconde', 'Frames per second')}><Segmented value={fps} onChange={setFps} options={[24, 30, 60].map((v) => ({ value: v as 24 | 30 | 60, label: `${v} i/s` }))} /></Field>
        <Field label={t('Qualité d’encodage', 'Encoding quality')}><Segmented value={quality} onChange={setQuality} options={[{ value: 'draft', label: t('Brouillon', 'Draft') }, { value: 'standard', label: 'Standard' }, { value: 'high', label: t('Haute', 'High') }]} /></Field>
        <div className="space-y-1 rounded-xl bg-ink-850 p-3 text-xs text-ink-300">
          <div className="flex justify-between"><span>{t('Taille', 'Size')}</span><span className="text-ink-100">{w} × {h}</span></div>
          <div className="flex justify-between"><span>{t('Durée', 'Duration')}</span><span className="text-ink-100">{formatTime(dur)}</span></div>
          <div className="flex justify-between"><span>{t('Images à calculer', 'Frames to render')}</span><span className="text-ink-100">{Math.ceil(dur * fps)}</span></div>
          <div className="flex justify-between"><span>{t('Sous-titres', 'Captions')}</span><span className="text-ink-100">{p.captionStyle.enabled ? t('incrustés', 'burned in') : t('non', 'no')}</span></div>
        </div>
        {res === '4k' && <p className="text-xs text-amber-200/80">{t('La 4K est environ 4 fois plus longue à calculer que la 1080p.', '4K takes about 4× longer than 1080p.')}</p>}
        {locked
          ? <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-200"><Lock size={14} className="mt-0.5 shrink-0" /> {t('Validez d’abord le storyboard (onglet Storyboard). Vous pouvez aussi désactiver le mode validation dans l’onglet Projet.', 'Approve the storyboard first (Storyboard tab), or turn approval mode off in the Project tab.')}</div>
          : <button className="btn-primary h-11 w-full" disabled={starting || !p.scenes.length || active} onClick={start}>{starting ? <Spinner /> : <Film size={16} />} {active ? t('Rendu en cours…', 'Rendering…') : t('Lancer le rendu', 'Start render')}</button>}
        <p className="text-[11px] text-ink-500">{t('Le rendu se fait sur votre ordinateur (FFmpeg). Les voix manquantes et la musique sont générées automatiquement avant.', 'Rendering happens on your computer (FFmpeg). Missing voices and music are generated first.')}</p>
      </section>
      <section className="space-y-3">
        {jobs.length === 0 && <div className="panel p-8 text-center text-sm text-ink-400">{t('Aucun rendu pour ce projet.', 'No render for this project yet.')}</div>}
        {jobs.map((j) => {
          const running = j.status === 'queued' || j.status === 'running';
          const ph = PHASE[j.phase?.split(':')[0]] ?? [j.phase, j.phase];
          return (
            <div key={j.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">{j.resolution} · {j.fps} i/s · {j.width}×{j.height}</div><div className="text-xs text-ink-400">{new Date(j.createdAt).toLocaleString()}</div></div>
                {running && <button className="btn-ghost btn-sm" onClick={() => api(`/api/renders/${j.id}`, { method: 'DELETE' }).then(refresh)}><X size={13} /> {t('Annuler', 'Cancel')}</button>}
                {j.status === 'done' && <a className="btn-primary btn-sm" href={`/api/renders/${j.id}/file?download`}><Download size={13} /> {t('Télécharger', 'Download')}</a>}
                {!running && <button className="btn-icon h-8 w-8 hover:text-red-300" title={t('Supprimer', 'Delete')} onClick={() => api(`/api/renders/${j.id}`, { method: 'DELETE' }).then(refresh)}><Trash2 size={14} /></button>}
              </div>
              {running && <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all" style={{ width: `${Math.round((j.progress || 0) * 100)}%` }} /></div>
                <div className="mt-1.5 flex justify-between text-xs text-ink-400"><span>{t(ph[0], ph[1])} · {Math.round((j.progress || 0) * 100)} %{j.fpsRender ? ` · ${j.fpsRender.toFixed(0)} i/s` : ''}</span><span>{j.etaSec !== undefined ? `${t('reste', 'left')} ${formatTime(j.etaSec)}` : ''}</span></div>
              </div>}
              {j.status === 'error' && <div className="mt-3 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-300">{j.error}</div>}
              {j.status === 'cancelled' && <div className="mt-2 text-xs text-ink-400">{t('Annulé', 'Cancelled')}</div>}
              {j.status === 'done' && <>
                <video controls preload="metadata" src={`/api/renders/${j.id}/file`} className="mt-3 max-h-[50vh] w-full rounded-lg bg-black" />
                <div className="mt-2 text-xs text-ink-400">{j.sizeBytes ? formatBytes(j.sizeBytes) : ''}{j.elapsedSec ? ` · ${t('calculé en', 'rendered in')} ${formatTime(j.elapsedSec)}` : ''}</div>
              </>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
