'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Film, ImagePlay, Megaphone, MonitorPlay, Smartphone, Sparkles, Type, Upload, Wand2, X } from 'lucide-react';
import { Field, Page, PageHeader, Segmented, Select, Spinner, Toggle } from '@/components/ui';
import { StylePickerModal } from '@/components/StylePicker';
import { StylePreview } from '@/components/StylePreview';
import { EngineSelect } from '@/components/EngineSelect';
import { useI18n } from '@/lib/client/i18n';
import { api, paid, toast } from '@/lib/client/api';
import { useEngines } from '@/lib/client/engines';
import { useStyle } from '@/lib/client/styles';
import { ASPECTS, LANGUAGES, MOODS, NARRATIONS, PLATFORMS, QUALITIES, opts } from '@/lib/client/options';
import { defaultBrief, platformDefaults } from '@/lib/project';
import { BUILTIN_TEMPLATES } from '@/lib/templates';
import type { Brief, CreationMode, Project } from '@/lib/types';

const MODES: { id: CreationMode; icon: any; fr: string; en: string; preset: Partial<Brief> }[] = [
  { id: 'video', icon: Wand2, fr: 'Idée → vidéo', en: 'Idea → video', preset: {} },
  { id: 'text', icon: Type, fr: 'Texte → vidéo', en: 'Text → video', preset: { styleId: 'minimal-motion' } },
  { id: 'image', icon: ImagePlay, fr: 'Images → vidéo', en: 'Images → video', preset: { styleId: 'cinematic-realism' } },
  { id: 'ad', icon: Megaphone, fr: 'Publicité', en: 'Ad', preset: { platform: 'ads', durationSec: 30, styleId: 'luxury-ad', musicMood: 'upbeat', tone: 'Persuasif' } },
  { id: 'tiktok', icon: Smartphone, fr: 'TikTok / Reels', en: 'TikTok / Reels', preset: { platform: 'tiktok', aspect: '9:16', durationSec: 30, styleId: 'futuristic-ui', musicMood: 'electronic', tone: 'Énergique' } },
  { id: 'youtube', icon: MonitorPlay, fr: 'YouTube', en: 'YouTube', preset: { platform: 'youtube', aspect: '16:9', durationSec: 60, styleId: 'documentary' } },
  { id: 'animation', icon: Film, fr: 'Animation', en: 'Animation', preset: { styleId: 'midcentury-toon', musicMood: 'upbeat', tone: 'Ludique' } },
];
const DURATIONS = [15, 30, 45, 60, 90];

function Wizard() {
  const { t } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const [step, setStep] = useState(0);
  const [b, setB] = useState<Brief>(() => defaultBrief());
  const [customDur, setCustomDur] = useState(false);
  const [engine, setEngine] = useState('offline');
  const [pickStyle, setPickStyle] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const engines = useEngines();
  const style = useStyle(b.styleId);
  const set = (patch: Partial<Brief>) => setB((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const m = sp.get('mode') as CreationMode | null;
    const tpl = BUILTIN_TEMPLATES.find((x) => x.id === sp.get('template'));
    const mode = MODES.find((x) => x.id === (tpl?.brief.mode ?? m));
    setB((x) => {
      const n = { ...x, ...(mode?.preset ?? {}), ...(tpl?.brief ?? {}), mode: mode?.id ?? x.mode };
      if (!tpl?.brief.aspect && !mode?.preset.aspect) n.aspect = platformDefaults(n.platform).aspect;
      return n;
    });
    if (mode?.id === 'ad' || tpl?.brief.mode === 'ad') setB((x) => ({ ...x, ad: x.ad ?? { product: '', brand: '', offer: '', cta: '', usp: '' } }));
    api<{ settings: { engines: { text: string } } }>('/api/settings').then((r) => setEngine(r.settings.engines.text)).catch(() => {});
  }, [sp]);
  useEffect(() => { void engines.load().catch(() => {}); }, []);

  const pickMode = (m: (typeof MODES)[number]) => {
    setB((x) => { const n = { ...x, ...m.preset, mode: m.id }; if (!m.preset.aspect) n.aspect = platformDefaults(n.platform).aspect; if (m.id === 'ad') n.ad = x.ad ?? { product: '', brand: '', offer: '', cta: '', usp: '' }; return n; });
  };

  const canNext = step === 0 ? (b.idea.trim().length >= 3 || b.subject.trim().length >= 3) && (b.mode !== 'image' || images.length > 0) : true;
  const engineInfo = engines.items.find((e) => e.id === engine);

  async function create() {
    setBusy(t('Création du projet…', 'Creating project…'));
    try {
      const p = await api<Project>('/api/projects', { body: { brief: b } });
      setBusy(t('Écriture du scénario…', 'Writing the script…'));
      const withScript = await paid<Project>(`/api/projects/${p.id}/script`, { engine }, t('Écriture du scénario', 'Script writing'));
      let proj = withScript ?? p;
      if (images.length && proj.scenes.length) {
        for (let i = 0; i < images.length; i++) {
          setBusy(t(`Import des images (${i + 1}/${images.length})…`, `Importing images (${i + 1}/${images.length})…`));
          const f = new FormData(); f.set('file', images[i]); f.set('role', 'image');
          const scene = proj.scenes[i % proj.scenes.length];
          if (i < proj.scenes.length) f.set('sceneId', scene.id);
          proj = await api<Project>(`/api/projects/${p.id}/assets`, { form: f });
        }
      }
      if (!withScript) toast.info(t('Projet créé sans scénario', 'Project created without script'), t('Vous pourrez générer le scénario depuis le storyboard.', 'You can generate the script from the storyboard.'));
      router.push(`/projects/${p.id}`);
    } catch (e) { toast.error(e); setBusy(null); }
  }

  const steps = [t('Idée', 'Idea'), t('Format et style', 'Format & style'), t('Voix, musique et moteur', 'Voice, music & engine')];
  const isText = b.mode === 'text';

  return (
    <Page>
      <PageHeader kicker={t('Assistant de création', 'Creation wizard')} title={t('Nouvelle vidéo', 'New video')} subtitle={t('Décrivez votre idée : Studio AI écrit le scénario complet, découpe les scènes et prépare le storyboard. Vous validez avant le rendu.', 'Describe your idea: Studio AI writes the full script, splits it into scenes and prepares the storyboard. You approve before rendering.')} />
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <button key={s} onClick={() => (i < step || canNext) && setStep(i)} className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${i === step ? 'bg-gradient-to-br from-violet-500 to-blue-600 text-white' : i < step ? 'bg-violet-500/25 text-violet-200' : 'bg-white/[0.06] text-ink-400'}`}>{i + 1}</span>
            <span className={`hidden text-sm sm:inline ${i === step ? 'text-white' : 'text-ink-400'}`}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-white/10 sm:w-10" />}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5 sm:p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <span className="label">{t('Type de création', 'Creation type')}</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODES.map((m) => (
                    <button key={m.id} onClick={() => pickMode(m)} className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition ${b.mode === m.id ? 'border-violet-400/70 bg-violet-500/10 text-white' : 'border-white/[0.07] text-ink-200 hover:border-white/20'}`}>
                      <m.icon size={16} className="text-violet-300" /> {t(m.fr, m.en)}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={isText ? t('Votre texte (article, notes, script)', 'Your text (article, notes, script)') : t('Votre idée', 'Your idea')}
                hint={isText ? t('Le texte est découpé en scènes ; chaque paragraphe devient une ou plusieurs scènes.', 'The text is split into scenes; each paragraph becomes one or more scenes.') : t('Une ou deux phrases suffisent. Plus vous êtes précis, meilleur sera le scénario.', 'One or two sentences are enough. The more precise, the better the script.')}>
                <textarea className="textarea" rows={isText ? 10 : 4} value={b.idea} onChange={(e) => set({ idea: e.target.value })}
                  placeholder={isText ? t('Collez votre texte ici…', 'Paste your text here…') : t('Ex. : Une vidéo qui explique comment l’énergie solaire peut réduire la facture d’un ménage belge.', 'E.g. A video explaining how solar energy can cut a household’s energy bill.')} />
              </Field>
              <Field label={t('Sujet / titre', 'Subject / title')}><input className="input" value={b.subject} onChange={(e) => set({ subject: e.target.value })} placeholder={t('Ex. : L’énergie solaire à la maison', 'E.g. Solar energy at home')} /></Field>
              {b.mode === 'ad' && b.ad && (
                <div className="grid gap-4 rounded-xl border border-white/[0.06] bg-ink-850/60 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 text-sm font-semibold">{t('Informations publicitaires', 'Ad details')}</div>
                  {([['product', 'Produit / service', 'Product / service'], ['brand', 'Marque', 'Brand'], ['usp', 'Avantage principal', 'Main benefit'], ['offer', 'Offre (ex. -20 %)', 'Offer (e.g. -20%)'], ['cta', 'Appel à l’action', 'Call to action']] as const).map(([k, fr, en]) => (
                    <Field key={k} label={t(fr, en)} className={k === 'cta' ? 'sm:col-span-2' : ''}><input className="input" value={b.ad![k]} onChange={(e) => set({ ad: { ...b.ad!, [k]: e.target.value } })} placeholder={k === 'cta' ? t('Ex. : Commandez sur notre site', 'E.g. Order on our website') : ''} /></Field>
                  ))}
                </div>
              )}
              {b.mode === 'image' && (
                <div>
                  <span className="label">{t('Vos images (dans l’ordre des scènes)', 'Your images (in scene order)')}</span>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-6 text-sm text-ink-300 transition hover:border-violet-400/50 hover:bg-white/[0.02]">
                    <Upload size={20} /> {t('Glissez ou choisissez des images (JPG, PNG, WebP)', 'Drop or choose images (JPG, PNG, WebP)')}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImages((x) => [...x, ...Array.from(e.target.files ?? [])].slice(0, 20))} />
                  </label>
                  {images.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">{images.map((f, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-lg bg-ink-800">
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 badge bg-black/70">{i + 1}</span>
                      <button onClick={() => setImages((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 hidden rounded bg-black/70 p-0.5 group-hover:block"><X size={12} /></button>
                    </div>))}</div>}
                  <p className="mt-2 text-xs text-ink-400">{t('Chaque image est placée dans une scène et animée par des mouvements de caméra. Pour un vrai mouvement dans l’image, utilisez un moteur image → vidéo depuis le storyboard.', 'Each image goes into a scene and is animated with camera moves. For real motion inside the picture, use an image-to-video engine from the storyboard.')}</p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <span className="label">{t('Durée', 'Duration')}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented value={customDur ? -1 : b.durationSec} onChange={(v) => { if (v === -1) setCustomDur(true); else { setCustomDur(false); set({ durationSec: v }); } }}
                    options={[...DURATIONS.map((d) => ({ value: d, label: `${d} s` })), { value: -1, label: t('Personnalisée', 'Custom') }]} />
                  {customDur && <input type="number" min={5} max={600} className="input w-28" value={b.durationSec} onChange={(e) => set({ durationSec: Math.max(5, Math.min(600, parseInt(e.target.value) || 30)) })} />}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Réseau social', 'Social network')}><Select value={b.platform} onChange={(v) => set({ platform: v, aspect: platformDefaults(v).aspect })} options={opts(PLATFORMS, t)} /></Field>
                <Field label={t('Format', 'Format')}><Select value={b.aspect} onChange={(v) => set({ aspect: v })} options={opts(ASPECTS, t)} /></Field>
                <Field label={t('Public cible', 'Target audience')}><input className="input" value={b.audience} onChange={(e) => set({ audience: e.target.value })} /></Field>
                <Field label={t('Ton', 'Tone')}><input className="input" value={b.tone} onChange={(e) => set({ tone: e.target.value })} placeholder={t('Inspirant, drôle, sérieux…', 'Inspiring, funny, serious…')} /></Field>
              </div>
              <div>
                <span className="label">{t('Style visuel', 'Visual style')}</span>
                <button onClick={() => setPickStyle(true)} className="group flex w-full items-center gap-4 rounded-xl border border-white/[0.07] bg-ink-850 p-2 text-left transition hover:border-violet-400/40">
                  <div className="w-40 shrink-0 overflow-hidden rounded-lg"><StylePreview style={style} /></div>
                  <div className="min-w-0"><div className="font-medium">{t(style.name.fr, style.name.en)}</div><div className="mt-0.5 line-clamp-2 text-xs text-ink-400">{t(style.description.fr, style.description.en)}</div><div className="mt-2 text-xs text-violet-300">{t('Changer de style', 'Change style')} →</div></div>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Langue', 'Language')} hint={b.language === 'fr-BE' ? t('Le scénario utilisera septante et nonante, et les voix belges Charline ou Gérard.', 'The script will use Belgian numbers and the Belgian voices.') : undefined}><Select value={b.language} onChange={(v) => set({ language: v })} options={opts(LANGUAGES, t)} /></Field>
                <Field label={t('Narration', 'Narration')} hint={b.narration === 'own' ? t('Vous enregistrerez ou importerez votre voix pour chaque scène dans l’onglet Voix.', 'You will record or import your voice per scene in the Voice tab.') : undefined}><Select value={b.narration} onChange={(v) => set({ narration: v })} options={opts(NARRATIONS, t)} /></Field>
                <Field label={t('Ambiance musicale', 'Music mood')} hint={t('Musique synthétisée par Studio AI, libre de droits.', 'Music synthesised by Studio AI, royalty-free.')}><Select value={b.musicMood} onChange={(v) => set({ musicMood: v })} options={opts(MOODS, t)} /></Field>
                <Field label={t('Qualité', 'Quality')}><Select value={b.quality} onChange={(v) => set({ quality: v })} options={opts(QUALITIES, t)} /></Field>
              </div>
              <Toggle checked={b.validateStoryboard} onChange={(v) => set({ validateStoryboard: v })} label={t('Valider le storyboard avant le rendu final', 'Approve the storyboard before the final render')} />
              <div>
                <span className="label">{t('Moteur d’écriture du scénario', 'Script engine')}</span>
                <EngineSelect kind="text" value={engine} onChange={setEngine} />
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-5">
            <button className="btn-ghost" disabled={step === 0 || !!busy} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> {t('Retour', 'Back')}</button>
            {step < 2
              ? <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{t('Continuer', 'Continue')} <ArrowRight size={16} /></button>
              : <button className="btn-primary" disabled={!!busy || !canNext} onClick={create}>{busy ? <><Spinner /> {busy}</> : <><Sparkles size={16} /> {t('Générer le scénario', 'Generate the script')}</>}</button>}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel overflow-hidden">
            <StylePreview style={style} aspect={b.aspect} text={b.subject || b.idea.slice(0, 50) || t(style.name.fr, style.name.en)} autoplay />
            <div className="space-y-1.5 p-4 text-xs text-ink-300">
              <div className="flex justify-between"><span>{t('Durée', 'Duration')}</span><span className="text-ink-100">{b.durationSec} s</span></div>
              <div className="flex justify-between"><span>{t('Format', 'Format')}</span><span className="text-ink-100">{b.aspect}</span></div>
              <div className="flex justify-between"><span>{t('Style', 'Style')}</span><span className="truncate pl-4 text-ink-100">{t(style.name.fr, style.name.en)}</span></div>
              <div className="flex justify-between"><span>{t('Moteur', 'Engine')}</span><span className="truncate pl-4 text-ink-100">{engineInfo?.name ?? engine}</span></div>
            </div>
          </div>
          {engineInfo && engineInfo.tier === 'paid' && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{t('Moteur payant : le coût estimé vous sera demandé avant la génération.', 'Paid engine: the estimated cost will be shown before generating.')}</div>}
          {engine === 'offline' && <div className="rounded-xl border border-white/[0.06] p-3 text-xs text-ink-400">{t('Le rédacteur hors-ligne n’est pas une IA : il structure votre idée avec des modèles narratifs. Pour un vrai texte rédigé, installez Ollama (gratuit) ou ajoutez une clé API.', 'The offline writer is not AI: it structures your idea with narrative templates. For real writing, install Ollama (free) or add an API key.')}</div>}
        </aside>
      </div>
      <StylePickerModal open={pickStyle} onClose={() => setPickStyle(false)} value={b.styleId} onPick={(s) => set({ styleId: s.id })} />
    </Page>
  );
}

export default function CreatePage() { return <Suspense fallback={null}><Wizard /></Suspense>; }
