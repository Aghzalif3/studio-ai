'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Palette, Pencil, Plus, Trash2, Wand2, X } from 'lucide-react';
import { Field, Modal, Page, PageHeader, Segmented, Select, Spinner } from '@/components/ui';
import { StyleGrid } from '@/components/StylePicker';
import { StylePreview } from '@/components/StylePreview';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';
import { useCustomStyles } from '@/lib/client/styles';
import { ALL_STYLES, getBuiltinStyle, styleCount } from '@/lib/styles/registry';
import { buildCustomStyle } from '@/lib/styles/custom';
import type { StyleDef } from '@/lib/styles/types';
import type { CustomStyleInput, SceneLayout } from '@/lib/types';
import { FONT_FAMILIES } from '@/lib/fonts';

/** Reads an image file into a small data URL (keeps the style file light). */
function toDataUrl(f: File, max = 512): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86)); URL.revokeObjectURL(img.src);
    }; img.onerror = rej; img.src = URL.createObjectURL(f);
  });
}

function Detail({ s, onClose }: { s: StyleDef; onClose: () => void }) {
  const { t, L } = useI18n();
  const [layout, setLayout] = useState<SceneLayout>('title');
  return (
    <Modal open onClose={onClose} title={L(s.name)} wide>
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div><div className="overflow-hidden rounded-xl border border-white/[0.07]"><StylePreview style={s} layout={layout} autoplay /></div>
          <div className="mt-3"><Segmented size="sm" value={layout} onChange={setLayout} options={[['title', 'Titre', 'Title'], ['statement', 'Phrase', 'Statement'], ['list', 'Liste', 'List'], ['stat', 'Chiffre', 'Figure'], ['quote', 'Citation', 'Quote'], ['cta', 'Appel à l’action', 'CTA']].map(([v, fr, en]) => ({ value: v as SceneLayout, label: t(fr, en) }))} /></div></div>
        <div className="space-y-3 text-sm">
          <p className="text-ink-200">{L(s.description)}</p>
          {s.uses.length > 0 && <div><span className="label">{t('Usages', 'Uses')}</span><div className="flex flex-wrap gap-1">{s.uses.slice(0, 8).map((u) => <span key={u} className="badge bg-white/[0.06] normal-case tracking-normal text-ink-200">{u}</span>)}</div></div>}
          <div><span className="label">{t('Palette', 'Palette')}</span><div className="flex gap-1.5">{[...s.palette.bg, s.palette.ink, ...s.palette.accent].map((c, i) => <span key={i} className="h-7 w-7 rounded-md border border-white/10" style={{ background: c }} />)}</div></div>
          <div className="text-xs text-ink-400">{t('Police', 'Font')} : {s.fonts.display}</div>
          {s.needsImageGen && <div className="rounded-lg bg-blue-500/10 p-2.5 text-xs text-blue-200">{t('Ce style donne son meilleur résultat avec un moteur d’images IA (le rendu procédural en donne une version stylisée).', 'This style shines with an AI image engine (procedural rendering gives a stylised version).')}</div>}
          <div className="text-[11px] text-ink-500">{s.origin === 'lemo' ? t('Nom et catégorie issus du catalogue Lemo-Opuscar (MIT). Rendu et description : Studio AI.', 'Name and category from the Lemo-Opuscar catalogue (MIT). Rendering and description: Studio AI.') : s.origin === 'custom' ? t('Style personnalisé', 'Custom style') : t('Style original Studio AI', 'Original Studio AI style')}</div>
          <Link href={`/create?style=${encodeURIComponent(s.id)}`} className="btn-primary w-full"><Wand2 size={15} /> {t('Créer une vidéo dans ce style', 'Create a video in this style')}</Link>
        </div>
      </div>
    </Modal>
  );
}

const EMPTY: CustomStyleInput = { name: '', baseStyleId: 'dark-keynote', colors: ['#0b0b14', '#ffffff', '#8b5cf6', '#3b82f6'], displayFont: 'Space Grotesk', bodyFont: 'Inter', promptHints: '', referenceImages: [] };

function Creator({ initial, id, onClose }: { initial: CustomStyleInput; id?: string; onClose: () => void }) {
  const { t, L } = useI18n();
  const [f, setF] = useState<CustomStyleInput>(initial);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const base = getBuiltinStyle(f.baseStyleId) ?? ALL_STYLES[0];
  const preview = useMemo(() => buildCustomStyle({ ...f, name: f.name || t('Mon style', 'My style') }, base, 'custom-preview'), [f, base]);
  useEffect(() => { if (!f.logoAssetDataUrl) { setLogo(null); return; } const i = new Image(); i.onload = () => setLogo(i); i.src = f.logoAssetDataUrl; }, [f.logoAssetDataUrl]);
  const set = (p: Partial<CustomStyleInput>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setSaving(true);
    try { await api('/api/styles', { body: { ...f, id } }); await useCustomStyles.getState().load(true); toast.ok(t('Style enregistré', 'Style saved')); onClose(); }
    catch (e) { toast.error(e); } finally { setSaving(false); }
  };
  const colorLabels = [t('Fond', 'Background'), t('Texte', 'Text'), t('Accent', 'Accent'), t('Accent 2', 'Accent 2')];
  return (
    <Modal open onClose={onClose} title={id ? t('Modifier le style', 'Edit style') : t('Créer un style', 'Create a style')} wide>
      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Nom', 'Name')}><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('Ex. : Ma marque', 'E.g. My brand')} /></Field>
            <Field label={t('Style de base', 'Base style')}><Select value={f.baseStyleId} onChange={(v) => set({ baseStyleId: v })} options={ALL_STYLES.map((s) => ({ value: s.id, label: L(s.name) }))} /></Field>
          </div>
          <div><span className="label">{t('Couleurs', 'Colours')}</span><div className="grid grid-cols-4 gap-2">{f.colors.map((c, i) => (
            <label key={i} className="flex flex-col items-center gap-1 text-[11px] text-ink-400"><input type="color" value={c} onChange={(e) => { const n = [...f.colors]; n[i] = e.target.value; set({ colors: n }); }} className="h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" />{colorLabels[i]}</label>))}</div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Police des titres', 'Display font')}><Select value={f.displayFont} onChange={(v) => set({ displayFont: v })} options={FONT_FAMILIES.map((x) => ({ value: x, label: x }))} /></Field>
            <Field label={t('Police du texte', 'Body font')}><Select value={f.bodyFont} onChange={(v) => set({ bodyFont: v })} options={FONT_FAMILIES.map((x) => ({ value: x, label: x }))} /></Field>
          </div>
          <Field label={t('Indications pour les images IA', 'Hints for AI images')} hint={t('Ajoutées au prompt de chaque image générée (ex. : « tons pastel, lumière douce »).', 'Added to every generated image prompt.')}><input className="input" value={f.promptHints} onChange={(e) => set({ promptHints: e.target.value })} /></Field>
          <div className="flex flex-wrap items-start gap-4">
            <div><span className="label">{t('Logo', 'Logo')}</span>
              <div className="flex items-center gap-2">
                <label className="btn-outline btn-sm cursor-pointer"><ImagePlus size={13} /> {f.logoAssetDataUrl ? t('Changer', 'Change') : t('Ajouter', 'Add')}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) set({ logoAssetDataUrl: await toDataUrl(x, 400) }); }} /></label>
                {f.logoAssetDataUrl && <><img src={f.logoAssetDataUrl} alt="" className="h-8 rounded bg-white/5" /><button className="btn-icon h-7 w-7" onClick={() => set({ logoAssetDataUrl: undefined })}><X size={13} /></button></>}
              </div></div>
            <div><span className="label">{t('Images de référence (4 max)', 'Reference images (max 4)')}</span>
              <div className="flex flex-wrap items-center gap-2">
                {f.referenceImages.map((r, i) => <div key={i} className="group relative"><img src={r} alt="" className="h-12 w-12 rounded object-cover" /><button className="absolute -right-1 -top-1 hidden rounded-full bg-black p-0.5 group-hover:block" onClick={() => set({ referenceImages: f.referenceImages.filter((_, j) => j !== i) })}><X size={10} /></button></div>)}
                {f.referenceImages.length < 4 && <label className="btn-outline btn-sm cursor-pointer"><Plus size={13} /><input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) set({ referenceImages: [...f.referenceImages, await toDataUrl(x)] }); }} /></label>}
              </div></div>
          </div>
          <p className="text-[11px] text-ink-500">{t('Les images de référence servent de mémo visuel pour votre style. Pour garder un personnage cohérent dans les images IA, ajoutez une image de référence au personnage dans l’onglet Projet.', 'Reference images are a visual memo for your style. For character consistency, add a reference image to the character in the Project tab.')}</p>
        </div>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-white/[0.07]"><StylePreview style={preview} autoplay logo={logo} text={f.name || t('Mon style', 'My style')} /></div>
          <div className="overflow-hidden rounded-xl border border-white/[0.07]"><StylePreview style={preview} layout="list" logo={logo} /></div>
          <button className="btn-primary w-full" disabled={!f.name.trim() || saving} onClick={save}>{saving ? <Spinner /> : null} {t('Enregistrer le style', 'Save style')}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Styles() {
  const { t } = useI18n();
  const custom = useCustomStyles();
  const [detail, setDetail] = useState<StyleDef | null>(null);
  const [creator, setCreator] = useState<{ input: CustomStyleInput; id?: string } | null>(null);
  useEffect(() => { void custom.load().catch(() => {}); }, []);
  return (
    <Page wide>
      <PageHeader kicker={t('Bibliothèque', 'Library')} title={t('Styles visuels', 'Visual styles')} subtitle={t(`${styleCount()} styles dessinés par le moteur de Studio AI, avec aperçu animé (survolez une vignette). Créez aussi vos propres styles avec vos couleurs, polices et logo.`, `${styleCount()} styles drawn by the Studio AI engine with animated previews (hover a card). Create your own with your colours, fonts and logo.`)}
        actions={<button className="btn-primary" onClick={() => setCreator({ input: EMPTY })}><Palette size={16} /> {t('Créer un style', 'Create a style')}</button>} />
      {custom.items.length > 0 && <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('Mes styles', 'My styles')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {custom.items.map((s) => (
            <div key={s.id} className="panel overflow-hidden">
              <button className="block w-full" onClick={() => setDetail(s)}><StylePreview style={s} /></button>
              <div className="flex items-center gap-1 p-2"><span className="min-w-0 flex-1 truncate text-sm">{s.name.fr}</span>
                <button className="btn-icon h-7 w-7" onClick={() => setCreator({ input: (s as any).input ?? { ...EMPTY, name: s.name.fr }, id: s.id })}><Pencil size={13} /></button>
                <button className="btn-icon h-7 w-7 hover:text-red-300" onClick={async () => { if (!confirm(t('Supprimer ce style ?', 'Delete this style?'))) return; await api(`/api/styles/${s.id}`, { method: 'DELETE' }); void custom.load(true); }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>}
      <StyleGrid onPick={setDetail} />
      {detail && <Detail s={detail} onClose={() => setDetail(null)} />}
      {creator && <Creator initial={creator.input} id={creator.id} onClose={() => setCreator(null)} />}
    </Page>
  );
}
