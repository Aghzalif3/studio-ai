'use client';
import { Dice5, Music, Upload, Volume2 } from 'lucide-react';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { api, assetUrl, toast } from '@/lib/client/api';
import { MOODS, opts } from '@/lib/client/options';
import type { Project } from '@/lib/types';
import { Field, Select, Slider, Spinner, Toggle } from '../ui';
import { SFX } from './Storyboard';

export function AudioTab() {
  const { t } = useI18n();
  const { project: p, edit, run, busy } = useProject();
  if (!p) return null;
  const ms = p.musicSettings;
  const music = p.timeline.music[0];
  const asset = music && p.assets.find((a) => a.id === music.assetId);
  const generate = async (seed?: number) => {
    if (seed !== undefined) edit((pp) => { pp.musicSettings.seed = seed; });
    const r = await run('music', () => api<Project>(`/api/projects/${p.id}/music`, { body: { force: true } }));
    if (r) toast.ok(t('Musique composée', 'Music composed'), t('Musique originale synthétisée par Studio AI, libre de droits.', 'Original music synthesised by Studio AI, royalty-free.'));
  };
  const uploadMusic = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*';
    i.onchange = () => { const f = i.files?.[0]; if (!f) return; const fd = new FormData(); fd.set('file', f); fd.set('role', 'music'); void run('music', () => api(`/api/projects/${p.id}/assets`, { form: fd })); };
    i.click();
  };
  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h3 className="font-display text-lg font-semibold">{t('Musique', 'Music')}</h3>
        <p className="mb-4 text-xs text-ink-400">{t('Studio AI compose une musique originale à la durée exacte de la vidéo (synthèse locale, sans droits d’auteur). Vous pouvez aussi importer votre propre fichier si vous en détenez les droits.', 'Studio AI composes original music at the exact video length (local synthesis, no copyright). You can also import your own file if you hold the rights.')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('Ambiance', 'Mood')}><Select value={ms.mood} onChange={(v) => edit((pp) => { pp.musicSettings.mood = v; pp.brief.musicMood = v; })} options={opts(MOODS, t)} /></Field>
          <Field label={t('Volume de la musique', 'Music volume')}><Slider value={ms.gainDb} min={-36} max={0} step={1} onChange={(v) => edit((pp) => { pp.musicSettings.gainDb = v; }, { history: false })} format={(v) => `${v} dB`} /></Field>
          <div className="flex items-end pb-2"><Toggle checked={ms.ducking} onChange={(v) => edit((pp) => { pp.musicSettings.ducking = v; })} label={t('Baisser la musique sous la voix (ducking)', 'Duck music under the voice')} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary btn-sm" disabled={busy.music || ms.mood === 'none'} onClick={() => generate()}>{busy.music ? <Spinner size={13} /> : <Music size={13} />} {music ? t('Recomposer', 'Recompose') : t('Composer la musique', 'Compose music')}</button>
          <button className="btn-outline btn-sm" disabled={busy.music || ms.mood === 'none'} onClick={() => generate(Math.floor(Math.random() * 1e6))}><Dice5 size={13} /> {t('Autre variation', 'Another variation')}</button>
          <button className="btn-outline btn-sm" disabled={busy.music} onClick={uploadMusic}><Upload size={13} /> {t('Importer ma musique', 'Import my music')}</button>
        </div>
        {music && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-ink-850 p-3">
          <Volume2 size={16} className="text-emerald-300" />
          <div className="min-w-0 flex-1 text-sm"><div className="truncate">{music.label}</div><div className="text-[11px] text-ink-400">{asset?.source === 'synth' ? t('Composée par Studio AI', 'Composed by Studio AI') : t('Fichier importé', 'Imported file')} · {music.duration.toFixed(1)} s</div></div>
          <audio key={music.assetId} controls preload="none" src={assetUrl(p.id, music.assetId)} className="h-8 w-64" />
        </div>}
        {!music && ms.mood !== 'none' && <p className="mt-3 text-xs text-ink-500">{t('Si vous ne composez rien, la musique sera générée automatiquement au moment de l’export.', 'If you compose nothing, music is generated automatically at export.')}</p>}
      </section>
      <section className="panel p-5">
        <h3 className="font-display text-lg font-semibold">{t('Bruitages du projet', 'Project sound effects')}</h3>
        <p className="mb-4 text-xs text-ink-400">{t('Chaque scène peut déclencher des bruitages (choisis dans le storyboard). Ajoutez-en d’autres à n’importe quel moment depuis l’onglet Montage. Tous sont synthétisés localement.', 'Each scene can trigger sound effects (picked in the storyboard). Add more anywhere from the Editor tab. All are synthesised locally.')}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SFX.map((x) => <div key={x.value} className="rounded-xl border border-white/[0.06] p-2.5"><div className="mb-1.5 text-sm">{t(x.fr, x.en)}</div><audio controls preload="none" src={`/api/library/sfx/${x.value}`} className="h-8 w-full" /></div>)}
        </div>
        <div className="mt-4 text-xs text-ink-400">{p.timeline.sfx.length} {t('bruitages dans le montage', 'sound effects in the timeline')}</div>
      </section>
    </div>
  );
}
