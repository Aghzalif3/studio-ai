'use client';
import { useState } from 'react';
import { Mic, RefreshCw, Upload } from 'lucide-react';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { api, assetUrl, paid, toast } from '@/lib/client/api';
import { defaultVoiceFor } from '@/lib/project';
import type { Project } from '@/lib/types';
import { EngineSelect } from '../EngineSelect';
import { VoiceList } from '../VoicePicker';
import { Recorder } from '../Recorder';
import { Field, Select, Slider, Spinner } from '../ui';
import { NARRATIONS, opts } from '@/lib/client/options';

export function VoiceTab() {
  const { t } = useI18n();
  const { project: p, edit, run, busy } = useProject();
  const [open, setOpen] = useState(false);
  if (!p) return null;
  const vs = p.voiceSettings;
  const setVs = (patch: Partial<typeof vs>) => edit((pp) => { Object.assign(pp.voiceSettings, patch); });
  const sample = p.scenes.find((s) => s.narration.trim())?.narration.slice(0, 160) || t('Bonjour, voici un aperçu de la voix de votre vidéo.', 'Hello, this is a preview of your video’s voice.');
  const upload = (sceneId: string, f: File, recorded = false) => {
    const fd = new FormData(); fd.set('file', f); fd.set('role', 'voice'); fd.set('sceneId', sceneId); if (recorded) fd.set('recorded', '1');
    return run(`voice:${sceneId}`, () => api<Project>(`/api/projects/${p.id}/assets`, { form: fd })).then((r) => r && toast.ok(t('Voix importée et synchronisée', 'Voice imported and synced')));
  };
  const pick = (sceneId: string) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*'; i.onchange = () => i.files?.[0] && upload(sceneId, i.files[0]); i.click(); };
  const regenAll = () => run('voices', async () => { const r = await paid<{ project: Project; errors: string[] }>(`/api/projects/${p.id}/voices`, { force: true }, t('Toutes les narrations', 'All narrations')); if (r?.errors.length) toast.error(new Error(r.errors[0])); return r; });

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-display text-lg font-semibold">{t('Voix off du projet', 'Project voice-over')}</h3><p className="text-xs text-ink-400">{t('La voix est synchronisée automatiquement : chaque scène s’allonge si la narration est plus longue.', 'Voice is synced automatically: each scene grows if its narration is longer.')}</p></div>
          <div className="w-48"><Select value={p.brief.narration} onChange={(v) => edit((pp) => { pp.brief.narration = v; if (v === 'male' || v === 'female') pp.voiceSettings.voice = defaultVoiceFor(pp.brief.language, v); })} options={opts(NARRATIONS, t)} /></div>
        </div>
        {p.brief.narration !== 'none' && p.brief.narration !== 'own' && (<>
          <button className="btn-ghost btn-sm mb-3" onClick={() => setOpen(!open)}>{open ? t('Masquer les moteurs', 'Hide engines') : t('Changer de moteur de voix', 'Change voice engine')}</button>
          {open && <div className="mb-4"><EngineSelect kind="voice" value={vs.engine} onChange={(e) => setVs({ engine: e, voice: e === 'edge' ? defaultVoiceFor(p.brief.language, p.brief.narration) : '' })} /></div>}
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <VoiceList engine={vs.engine} lang={p.brief.language} value={vs.voice} onChange={(v) => setVs({ voice: v })} sample={sample} rate={vs.rate} pitch={vs.pitch} />
            <div className="space-y-3">
              <Field label={t('Vitesse', 'Speed')}><Slider value={vs.rate} min={-50} max={100} step={5} onChange={(v) => setVs({ rate: v })} format={(v) => `${v > 0 ? '+' : ''}${v} %`} /></Field>
              <Field label={t('Hauteur', 'Pitch')}><Slider value={vs.pitch} min={-50} max={50} step={5} onChange={(v) => setVs({ pitch: v })} format={(v) => `${v > 0 ? '+' : ''}${v}`} /></Field>
              <button className="btn-primary w-full" disabled={busy.voices || !vs.voice} onClick={regenAll}>{busy.voices ? <Spinner /> : <RefreshCw size={15} />} {t('Appliquer à toutes les scènes', 'Apply to all scenes')}</button>
              <p className="text-[11px] text-ink-500">{t('Les voix déjà générées avec d’autres réglages sont refaites. Les enregistrements personnels sont conservés.', 'Voices made with other settings are redone. Personal recordings are kept.')}</p>
            </div>
          </div>
        </>)}
        {p.brief.narration === 'own' && <p className="text-sm text-ink-300">{t('Enregistrez ou importez votre voix pour chaque scène ci-dessous. Le minutage des mots est estimé pour les sous-titres ; ajustez-les si besoin dans l’onglet Sous-titres.', 'Record or import your voice for each scene below. Word timings are estimated for captions.')}</p>}
      </section>

      <section className="panel divide-y divide-white/[0.05]">
        {p.scenes.map((s, i) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-xs font-bold">{i + 1}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm">{s.narration || <span className="text-ink-500">{t('(pas de narration)', '(no narration)')}</span>}</div>
              <div className="text-[11px] text-ink-500">{s.voice ? `${s.voice.duration.toFixed(1)} s · ${s.voice.engine === 'recording' ? t('enregistrement', 'recording') : s.voice.engine === 'upload' ? t('fichier importé', 'uploaded file') : s.voice.voice}` : t('Pas encore de voix', 'No voice yet')}</div></div>
            {busy[`voice:${s.id}`] && <Spinner />}
            {s.voice && <audio key={s.voice.assetId} controls preload="none" src={assetUrl(p.id, s.voice.assetId)} className="h-8 w-56" />}
            {p.brief.narration !== 'none' && p.brief.narration !== 'own' && <button className="btn-ghost btn-sm" disabled={!s.narration.trim() || busy[`voice:${s.id}`]} onClick={() => run(`voice:${s.id}`, () => paid(`/api/projects/${p.id}/scenes/${s.id}/voice`, {}, t('Narration de la scène', 'Scene narration')))}><Mic size={13} /> {t('Générer', 'Generate')}</button>}
            <Recorder compact onDone={(f) => upload(s.id, f, true)} />
            <button className="btn-ghost btn-sm" onClick={() => pick(s.id)}><Upload size={13} /> {t('Importer', 'Upload')}</button>
          </div>
        ))}
        {!p.scenes.length && <div className="p-6 text-sm text-ink-400">{t('Aucune scène : générez d’abord le scénario dans le storyboard.', 'No scene: generate the script in the storyboard first.')}</div>}
      </section>
    </div>
  );
}
