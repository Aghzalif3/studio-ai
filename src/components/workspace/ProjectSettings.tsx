'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, LayoutTemplate, Plus, Trash2, Upload, UserRound } from 'lucide-react';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { api, assetUrl, toast } from '@/lib/client/api';
import { useStyle } from '@/lib/client/styles';
import { ASPECTS, LANGUAGES, PLATFORMS, opts } from '@/lib/client/options';
import { defaultVoiceFor, platformDefaults, syncTimeline } from '@/lib/project';
import type { Project } from '@/lib/types';
import { uid } from '@/lib/util';
import { StylePickerModal } from '../StylePicker';
import { StylePreview } from '../StylePreview';
import { Field, Modal, Select, Toggle } from '../ui';

export function ProjectSettings() {
  const { t, L } = useI18n();
  const router = useRouter();
  const { project: p, edit, run, flush } = useProject();
  const [pick, setPick] = useState(false);
  const [tpl, setTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const style = useStyle(p?.brief.styleId);
  if (!p) return null;
  const b = p.brief;
  const uploadRef = (cid: string) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => { const f = i.files?.[0]; if (!f) return; const fd = new FormData(); fd.set('file', f); fd.set('role', 'reference'); fd.set('characterId', cid); void run(`ref:${cid}`, () => api<Project>(`/api/projects/${p.id}/assets`, { form: fd })); };
    i.click();
  };
  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h3 className="mb-4 font-display text-lg font-semibold">{t('Style et format', 'Style & format')}</h3>
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <button onClick={() => setPick(true)} className="overflow-hidden rounded-xl border border-white/[0.07] text-left transition hover:border-violet-400/40"><StylePreview style={style} aspect={b.aspect} /><div className="p-2.5 text-sm">{L(style.name)} <span className="text-xs text-violet-300">· {t('changer', 'change')}</span></div></button>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Format', 'Format')}><Select value={b.aspect} onChange={(v) => edit((pp) => { pp.brief.aspect = v; })} options={opts(ASPECTS, t)} /></Field>
            <Field label={t('Réseau social', 'Social network')}><Select value={b.platform} onChange={(v) => edit((pp) => { pp.brief.platform = v; Object.assign(pp.captionStyle, platformDefaults(v).captions); })} options={opts(PLATFORMS, t)} /></Field>
            <Field label={t('Langue', 'Language')}><Select value={b.language} onChange={(v) => edit((pp) => { pp.brief.language = v; if (pp.voiceSettings.engine === 'edge') pp.voiceSettings.voice = defaultVoiceFor(v, pp.brief.narration); })} options={opts(LANGUAGES, t)} /></Field>
            <Field label={t('Ton', 'Tone')}><input className="input" value={b.tone} onChange={(e) => edit((pp) => { pp.brief.tone = e.target.value; }, { history: false })} /></Field>
            <Field label={t('Idée / brief', 'Idea / brief')} className="sm:col-span-2"><textarea className="textarea" rows={3} value={b.idea} onChange={(e) => edit((pp) => { pp.brief.idea = e.target.value; }, { history: false })} /></Field>
            <div className="sm:col-span-2"><Toggle checked={b.validateStoryboard} onChange={(v) => edit((pp) => { pp.brief.validateStoryboard = v; })} label={t('Exiger la validation du storyboard avant le rendu', 'Require storyboard approval before render')} /></div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-1 flex items-center justify-between"><h3 className="font-display text-lg font-semibold">{t('Personnages et références visuelles', 'Characters & visual references')}</h3>
          <button className="btn-outline btn-sm" onClick={() => edit((pp) => { pp.characters.push({ id: uid('ch_'), name: t('Personnage', 'Character'), description: '' }); })}><Plus size={13} /> {t('Ajouter', 'Add')}</button></div>
        <p className="mb-4 text-xs text-ink-400">{t('La description est ajoutée à chaque génération d’image pour garder le personnage cohérent. Une image de référence est utilisée par fal.ai et Replicate (modèle Kontext, plus cher : ≈ 0,04 $ l’image).', 'The description is added to every image prompt for consistency. A reference image is used by fal.ai and Replicate (Kontext model, ≈ $0.04 per image).')}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {p.characters.map((c, i) => (
            <div key={c.id} className="flex gap-3 rounded-xl border border-white/[0.06] p-3">
              <button onClick={() => uploadRef(c.id)} className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-800 text-ink-400 hover:text-white" title={t('Image de référence', 'Reference image')}>
                {c.refAssetId ? <img src={assetUrl(p.id, c.refAssetId)} alt="" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-[10px]"><UserRound size={18} /><Upload size={11} /></div>}
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex gap-2"><input className="input h-8 text-sm" value={c.name} onChange={(e) => edit((pp) => { pp.characters[i].name = e.target.value; }, { history: false })} /><button className="btn-icon h-8 w-8 hover:text-red-300" onClick={() => edit((pp) => { pp.characters.splice(i, 1); })}><Trash2 size={14} /></button></div>
                <textarea className="textarea text-xs" rows={2} placeholder={t('Apparence : âge, cheveux, vêtements…', 'Look: age, hair, clothes…')} value={c.description} onChange={(e) => edit((pp) => { pp.characters[i].description = e.target.value; }, { history: false })} />
              </div>
            </div>
          ))}
          {!p.characters.length && <div className="text-sm text-ink-500">{t('Aucun personnage.', 'No character.')}</div>}
        </div>
      </section>

      <section className="panel flex flex-wrap gap-2 p-5">
        <button className="btn-outline" onClick={() => { setTplName(p.name); setTpl(true); }}><LayoutTemplate size={15} /> {t('Enregistrer comme modèle', 'Save as template')}</button>
        <button className="btn-outline" onClick={async () => { await flush(); try { const d = await api<Project>(`/api/projects/${p.id}/duplicate`, { body: {} }); router.push(`/projects/${d.id}`); } catch (e) { toast.error(e); } }}><Copy size={15} /> {t('Dupliquer le projet', 'Duplicate project')}</button>
        <button className="btn-danger ml-auto" onClick={async () => { if (!confirm(t('Supprimer définitivement ce projet et ses médias ?', 'Delete this project and its media permanently?'))) return; await api(`/api/projects/${p.id}`, { method: 'DELETE' }); router.push('/projects'); }}><Trash2 size={15} /> {t('Supprimer le projet', 'Delete project')}</button>
      </section>

      <StylePickerModal open={pick} onClose={() => setPick(false)} value={b.styleId} onPick={(s) => edit((pp) => { pp.brief.styleId = s.id; syncTimeline(pp); })} />
      <Modal open={tpl} onClose={() => setTpl(false)} title={t('Enregistrer comme modèle', 'Save as template')}>
        <Field label={t('Nom du modèle', 'Template name')}><input className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} /></Field>
        <p className="mt-2 text-xs text-ink-400">{t('Le modèle garde la structure (brief, scènes, textes, réglages) sans les médias.', 'The template keeps the structure (brief, scenes, texts, settings) without media.')}</p>
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setTpl(false)}>{t('Annuler', 'Cancel')}</button><button className="btn-primary" disabled={!tplName.trim()} onClick={async () => { await flush(); try { await api(`/api/projects/${p.id}/template`, { body: { name: tplName } }); toast.ok(t('Modèle enregistré', 'Template saved')); setTpl(false); } catch (e) { toast.error(e); } }}>{t('Enregistrer', 'Save')}</button></div>
      </Modal>
    </div>
  );
}
