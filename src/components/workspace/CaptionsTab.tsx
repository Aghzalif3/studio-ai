'use client';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { estimateWordTimings, rebuildCaptions } from '@/lib/project';
import { FONT_FAMILIES } from '@/lib/fonts';
import type { CaptionPreset, CaptionStyle } from '@/lib/types';
import { Field, Segmented, Select, Slider, Toggle } from '../ui';

const PRESETS: { value: CaptionPreset; fr: string; en: string }[] = [
  { value: 'karaoke', fr: 'Karaoké', en: 'Karaoke' }, { value: 'pop', fr: 'Pop', en: 'Pop' }, { value: 'bounce', fr: 'Rebond', en: 'Bounce' },
  { value: 'fade', fr: 'Fondu', en: 'Fade' }, { value: 'typewriter', fr: 'Machine à écrire', en: 'Typewriter' }, { value: 'boxed', fr: 'Encadré', en: 'Boxed' }, { value: 'minimal', fr: 'Minimal', en: 'Minimal' },
];

export function CaptionsTab() {
  const { t } = useI18n();
  const { project: p, edit } = useProject();
  if (!p) return null;
  const cs = p.captionStyle;
  const set = (patch: Partial<CaptionStyle>, rebuild = false) => edit((pp) => { Object.assign(pp.captionStyle, patch); if (rebuild) pp.timeline.captions = rebuildCaptions(pp); });
  const color = (k: 'color' | 'highlightColor' | 'strokeColor', label: string) => (
    <Field label={label}><div className="flex items-center gap-2"><input type="color" value={cs[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent" /><span className="font-mono text-xs text-ink-300">{cs[k]}</span></div></Field>
  );
  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-display text-lg font-semibold">{t('Sous-titres automatiques', 'Automatic captions')}</h3><p className="text-xs text-ink-400">{t('Générés depuis la narration et synchronisés mot à mot (minutage réel avec Edge TTS et ElevenLabs, estimé sinon).', 'Generated from the narration and synced word by word (real timing with Edge TTS and ElevenLabs, estimated otherwise).')}</p></div>
          <Toggle checked={cs.enabled} onChange={(v) => set({ enabled: v })} label={t('Incruster dans la vidéo', 'Burn into the video')} />
        </div>
        <div className="mb-4"><span className="label">{t('Animation', 'Animation')}</span><Segmented size="sm" value={cs.preset} onChange={(v) => set({ preset: v })} options={PRESETS.map((x) => ({ value: x.value, label: t(x.fr, x.en) }))} /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('Police', 'Font')}><Select value={cs.font} onChange={(v) => set({ font: v })} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} /></Field>
          <Field label={t('Position', 'Position')}><Select value={cs.position} onChange={(v) => set({ position: v })} options={[{ value: 'bottom', label: t('Bas', 'Bottom') }, { value: 'center', label: t('Centre', 'Center') }, { value: 'top', label: t('Haut', 'Top') }]} /></Field>
          <Field label={t('Taille', 'Size')}><Slider value={cs.size} min={0.025} max={0.09} step={0.001} onChange={(v) => set({ size: v })} format={(v) => `${(v * 100).toFixed(1)} %`} /></Field>
          <Field label={t('Mots par sous-titre', 'Words per caption')}><Slider value={cs.maxWords} min={1} max={12} step={1} onChange={(v) => set({ maxWords: v }, true)} /></Field>
          {color('color', t('Couleur du texte', 'Text colour'))}
          {color('highlightColor', t('Couleur de surlignage', 'Highlight colour'))}
          {color('strokeColor', t('Contour', 'Outline'))}
          <Field label={t('Épaisseur du contour', 'Outline width')}><Slider value={cs.strokeWidth} min={0} max={14} step={1} onChange={(v) => set({ strokeWidth: v })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <Toggle checked={cs.uppercase} onChange={(v) => set({ uppercase: v })} label={t('Majuscules', 'Uppercase')} />
          <Toggle checked={cs.highlightKeywords} onChange={(v) => set({ highlightKeywords: v })} label={t('Surligner les mots-clés', 'Highlight keywords')} />
          <Toggle checked={!!cs.background} onChange={(v) => set({ background: v ? 'rgba(0,0,0,0.55)' : '' })} label={t('Fond sombre', 'Dark background')} />
        </div>
      </section>
      <section className="panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
          <span className="mr-auto text-sm text-ink-300">{p.timeline.captions.length} {t('sous-titres', 'captions')}</span>
          <button className="btn-ghost btn-sm" onClick={() => edit((pp) => { pp.timeline.captions = rebuildCaptions(pp); })}><RefreshCw size={13} /> {t('Regénérer depuis la narration', 'Rebuild from narration')}</button>
          <a className="btn-outline btn-sm" href={`/api/projects/${p.id}/subtitles?format=srt`}><Download size={13} /> SRT</a>
          <a className="btn-outline btn-sm" href={`/api/projects/${p.id}/subtitles?format=vtt`}><Download size={13} /> VTT</a>
        </div>
        <p className="border-b border-white/[0.05] px-3 py-2 text-[11px] text-ink-500">{t('Les sous-titres sont recalculés quand la narration change. Vos corrections manuelles restent tant que vous ne modifiez pas la narration.', 'Captions are recomputed when the narration changes. Manual fixes stay until you change the narration.')}</p>
        <div className="max-h-[55vh] divide-y divide-white/[0.04] overflow-y-auto">
          {p.timeline.captions.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-1.5">
              <input type="number" step={0.05} className="input h-8 w-20 font-mono text-xs" value={+c.start.toFixed(2)} onChange={(e) => edit((pp) => { pp.timeline.captions[i].start = Math.max(0, parseFloat(e.target.value) || 0); }, { history: false })} />
              <input type="number" step={0.05} className="input h-8 w-20 font-mono text-xs" value={+c.end.toFixed(2)} onChange={(e) => edit((pp) => { pp.timeline.captions[i].end = Math.max(pp.timeline.captions[i].start + 0.1, parseFloat(e.target.value) || 0); }, { history: false })} />
              <input className="input h-8 flex-1 text-sm" value={c.text} onChange={(e) => edit((pp) => { const c2 = pp.timeline.captions[i]; c2.text = e.target.value; c2.words = estimateWordTimings(c2.text, c2.end - c2.start, c2.start); }, { history: false })} />
              <button className="btn-icon h-8 w-8 hover:text-red-300" onClick={() => edit((pp) => { pp.timeline.captions.splice(i, 1); })}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
