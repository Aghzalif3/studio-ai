'use client';
import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { Field, Page, PageHeader, Segmented, Select, Slider, Spinner, Toggle } from '@/components/ui';
import { EngineSelect } from '@/components/EngineSelect';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';
import { useEngines } from '@/lib/client/engines';
import { ASPECTS, QUALITIES, opts } from '@/lib/client/options';
import type { Settings } from '@/lib/server/settings';
import { formatBytes } from '@/lib/util';

interface SecretRow { name: string; label: string; set: boolean; source: 'env' | 'stored' | null; hint: string }
const KEY_URLS: Record<string, string> = {
  FAL_KEY: 'https://fal.ai/dashboard/keys', REPLICATE_API_TOKEN: 'https://replicate.com/account/api-tokens', STABILITY_API_KEY: 'https://platform.stability.ai/account/keys',
  OPENAI_API_KEY: 'https://platform.openai.com/api-keys', ANTHROPIC_API_KEY: 'https://console.anthropic.com/settings/keys', GROQ_API_KEY: 'https://console.groq.com/keys',
  OPENROUTER_API_KEY: 'https://openrouter.ai/keys', MISTRAL_API_KEY: 'https://console.mistral.ai/api-keys', ELEVENLABS_API_KEY: 'https://elevenlabs.io/app/settings/api-keys',
  POLLINATIONS_TOKEN: 'https://auth.pollinations.ai', HF_TOKEN: 'https://huggingface.co/settings/tokens',
};
const SECTIONS = [['general', 'Général', 'General'], ['keys', 'Clés API', 'API keys'], ['engines', 'Moteurs', 'Engines'], ['render', 'Vidéo et audio', 'Video & audio'], ['data', 'Données', 'Data']] as const;

function KeyRowView({ r, onSaved }: { r: SecretRow; onSaved: (rows: SecretRow[]) => void }) {
  const { t } = useI18n();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (value: string | null) => { setBusy(true); try { const x = await api<{ items: SecretRow[] }>('/api/secrets', { method: 'PUT', body: { name: r.name, value } }); onSaved(x.items); setV(''); toast.ok(value ? t('Clé enregistrée (chiffrée)', 'Key saved (encrypted)') : t('Clé supprimée', 'Key removed')); } catch (e) { toast.error(e); } finally { setBusy(false); } };
  return (
    <div className="flex flex-wrap items-center gap-3 p-3.5">
      <div className="w-44 shrink-0"><div className="text-sm font-medium">{r.label}</div><div className="font-mono text-[10px] text-ink-500">{r.name}</div></div>
      <div className="min-w-[120px] text-xs">{r.set ? <span className="flex items-center gap-1 text-emerald-300"><Check size={12} /> {r.hint}{r.source === 'env' ? ` (${t('variable d’environnement', 'environment variable')})` : ''}</span> : <span className="text-ink-500">{t('Non configurée', 'Not set')}</span>}</div>
      <input type="password" autoComplete="off" className="input h-9 min-w-[200px] flex-1" placeholder={r.set ? t('Remplacer la clé…', 'Replace key…') : t('Coller la clé…', 'Paste key…')} value={v} onChange={(e) => setV(e.target.value)} disabled={r.source === 'env'} />
      <button className="btn-outline btn-sm" disabled={!v.trim() || busy} onClick={() => save(v)}>{busy ? <Spinner size={13} /> : t('Enregistrer', 'Save')}</button>
      {r.set && r.source === 'stored' && <button className="btn-icon h-8 w-8 hover:text-red-300" title={t('Supprimer', 'Remove')} onClick={() => save(null)}><Trash2 size={14} /></button>}
      <a href={KEY_URLS[r.name]} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><ExternalLink size={12} /> {t('Obtenir', 'Get one')}</a>
    </div>
  );
}

export default function SettingsPage() {
  const { t, setLang } = useI18n();
  const [s, setS] = useState<Settings | null>(null);
  const [info, setInfo] = useState<{ dataDir: string; dataBytes: number; platform: string } | null>(null);
  const [keys, setKeys] = useState<SecretRow[]>([]);
  const [sec, setSec] = useState<(typeof SECTIONS)[number][0]>('general');
  const [wipe, setWipe] = useState({ projects: false, renders: false, templates: false, styles: false, secrets: false, confirm: '' });
  const engines = useEngines();
  useEffect(() => {
    api<{ settings: Settings; dataDir: string; dataBytes: number; platform: string }>('/api/settings').then((r) => { setS(r.settings); setInfo(r); }).catch(toast.error);
    api<{ items: SecretRow[] }>('/api/secrets').then((r) => setKeys(r.items)).catch(toast.error);
    const h = location.hash.slice(1); if (SECTIONS.some((x) => x[0] === h)) setSec(h as any);
  }, []);
  if (!s) return <Page><Spinner /></Page>;
  const save = async (patch: any) => {
    setS((x) => (x ? (JSON.parse(JSON.stringify({ ...x, ...patch })) as Settings) : x));
    try { const r = await api<{ settings: Settings }>('/api/settings', { method: 'PUT', body: patch }); setS(r.settings); void engines.load(true); } catch (e) { toast.error(e); }
  };
  const deep = (path: string, value: unknown) => { const [a, b, c] = path.split('.'); const cur: any = s; const patch: any = { [a]: b ? { ...cur[a], [b]: c ? { ...cur[a][b], [c]: value } : value } : value }; void save(patch); };

  return (
    <Page wide>
      <PageHeader title={t('Paramètres', 'Settings')} subtitle={t('Les réglages et les clés sont enregistrés uniquement sur cet ordinateur.', 'Settings and keys are stored only on this computer.')} />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">{SECTIONS.map(([id, fr, en]) => <button key={id} onClick={() => { setSec(id); history.replaceState(null, '', `#${id}`); }} className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm transition ${sec === id ? 'bg-white/[0.07] text-white' : 'text-ink-400 hover:text-white'}`}>{t(fr, en)}</button>)}</nav>
        <div className="min-w-0 space-y-5">
          {sec === 'general' && <section className="panel space-y-5 p-5">
            <Field label={t('Langue de l’interface', 'Interface language')}><Segmented value={s.language} onChange={(v) => { setLang(v); void save({ language: v }); }} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} /></Field>
            <Field label={t('Enregistrement automatique (délai)', 'Autosave delay')}><Slider value={s.autosaveMs} min={300} max={5000} step={100} onChange={(v) => deep('autosaveMs', v)} format={(v) => `${(v / 1000).toFixed(1)} s`} /></Field>
            <div className="rounded-xl border border-white/[0.06] p-3 text-xs text-ink-400">{t('Le coût estimé est toujours affiché, et doit être confirmé, avant chaque génération payante.', 'The estimated cost is always shown, and must be confirmed, before each paid generation.')}</div>
          </section>}

          {sec === 'keys' && <section className="panel">
            <div className="flex items-start gap-3 border-b border-white/[0.06] p-4 text-sm text-ink-300"><KeyRound size={18} className="mt-0.5 shrink-0 text-violet-300" /><div>{t('Les clés sont chiffrées (AES-256-GCM) dans le dossier de données et ne sont jamais renvoyées au navigateur : seuls les 4 derniers caractères s’affichent. Aucune clé n’est nécessaire pour utiliser Studio AI : les moteurs gratuits fonctionnent sans.', 'Keys are encrypted (AES-256-GCM) in the data folder and never sent back to the browser; only the last 4 characters are shown. No key is required: free engines work without.')}</div></div>
            <div className="divide-y divide-white/[0.05]">{keys.map((r) => <KeyRowView key={r.name} r={r} onSaved={(x) => { setKeys(x); void engines.load(true); }} />)}</div>
          </section>}

          {sec === 'engines' && <>
            {(['text', 'image', 'video', 'voice'] as const).map((k) => (
              <section key={k} className="panel p-5"><h3 className="mb-3 font-display font-semibold">{t({ text: 'Écriture du scénario', image: 'Images', video: 'Vidéo', voice: 'Voix' }[k], { text: 'Script writing', image: 'Images', video: 'Video', voice: 'Voice' }[k])} <span className="text-xs font-normal text-ink-400">· {t('moteur par défaut', 'default engine')}</span></h3><EngineSelect kind={k} value={s.engines[k]} onChange={(v) => deep(`engines.${k}`, v)} /></section>
            ))}
            <section className="panel grid gap-4 p-5 sm:grid-cols-2">
              <h3 className="font-display font-semibold sm:col-span-2">{t('Modèles et adresses locales', 'Models & local URLs')}</h3>
              <Field label={t('Modèle Ollama', 'Ollama model')} hint={engines.ollamaModels.length ? `${t('Installés', 'Installed')} : ${engines.ollamaModels.join(', ')}` : t('Aucun modèle détecté (ollama pull llama3.2)', 'No model detected')}><input className="input" value={s.textModels.ollama} onChange={(e) => setS({ ...s, textModels: { ...s.textModels, ollama: e.target.value } })} onBlur={(e) => deep('textModels.ollama', e.target.value)} /></Field>
              <Field label={t('Adresse Ollama', 'Ollama URL')}><input className="input" value={s.localUrls.ollama} onChange={(e) => setS({ ...s, localUrls: { ...s.localUrls, ollama: e.target.value } })} onBlur={(e) => deep('localUrls.ollama', e.target.value)} /></Field>
              <Field label={t('Fournisseur compatible OpenAI', 'OpenAI-compatible provider')}><Select value={s.textModels.openaiCompat.provider} onChange={(v) => deep('textModels.openaiCompat', { ...s.textModels.openaiCompat, provider: v, model: { groq: 'llama-3.3-70b-versatile', openrouter: 'meta-llama/llama-3.3-70b-instruct:free', mistral: 'mistral-small-latest', openai: 'gpt-4o-mini' }[v] ?? '' })} options={[{ value: 'groq', label: t('Groq (offre gratuite limitée)', 'Groq (limited free tier)') }, { value: 'openrouter', label: t('OpenRouter (modèles :free gratuits)', 'OpenRouter (:free models)') }, { value: 'mistral', label: t('Mistral (offre gratuite limitée)', 'Mistral (limited free tier)') }, { value: 'openai', label: t('OpenAI (payant)', 'OpenAI (paid)') }]} /></Field>
              <Field label={t('Modèle', 'Model')}><input className="input" value={s.textModels.openaiCompat.model} onChange={(e) => setS({ ...s, textModels: { ...s.textModels, openaiCompat: { ...s.textModels.openaiCompat, model: e.target.value } } })} onBlur={(e) => deep('textModels.openaiCompat', { ...s.textModels.openaiCompat, model: e.target.value })} /></Field>
              <Field label={t('Modèle Claude (Anthropic)', 'Claude model (Anthropic)')}><input className="input" value={s.textModels.anthropic} onChange={(e) => setS({ ...s, textModels: { ...s.textModels, anthropic: e.target.value } })} onBlur={(e) => deep('textModels.anthropic', e.target.value)} /></Field>
              <Field label={t('Adresse Stable Diffusion local', 'Local Stable Diffusion URL')}><input className="input" value={s.localUrls.sdwebui} onChange={(e) => setS({ ...s, localUrls: { ...s.localUrls, sdwebui: e.target.value } })} onBlur={(e) => deep('localUrls.sdwebui', e.target.value)} /></Field>
              <Field label={t('Modèle fal.ai (images)', 'fal.ai model (images)')}><Select value={s.imageModels.fal} onChange={(v) => deep('imageModels.fal', v)} options={[{ value: 'fal-ai/flux/schnell', label: 'Flux schnell (≈ 0,003 $)' }, { value: 'fal-ai/flux/dev', label: 'Flux dev (≈ 0,025 $)' }, { value: 'fal-ai/flux-pro/v1.1', label: 'Flux Pro 1.1 (≈ 0,04 $)' }]} /></Field>
              <Field label={t('Modèle Stability', 'Stability model')}><Select value={s.imageModels.stability} onChange={(v) => deep('imageModels.stability', v)} options={[{ value: 'core', label: 'Stable Image Core (≈ 0,03 $)' }, { value: 'ultra', label: 'Stable Image Ultra (≈ 0,08 $)' }]} /></Field>
              <Field label={t('Modèle fal.ai (vidéo)', 'fal.ai model (video)')}><Select value={s.videoModels.fal} onChange={(v) => deep('videoModels.fal', v)} options={[{ value: 'fal-ai/ltx-video/image-to-video', label: 'LTX Video (≈ 0,02 $ / clip)' }, { value: 'fal-ai/kling-video/v2.1/standard/image-to-video', label: 'Kling 2.1 (≈ 0,25 $ / 5 s)' }, { value: 'fal-ai/minimax/hailuo-02/standard/image-to-video', label: 'Hailuo 02 (≈ 0,27 $ / 6 s)' }]} /></Field>
              <Field label={t('Modèle Replicate (vidéo)', 'Replicate model (video)')}><input className="input" value={s.videoModels.replicate} onChange={(e) => setS({ ...s, videoModels: { ...s.videoModels, replicate: e.target.value } })} onBlur={(e) => deep('videoModels.replicate', e.target.value)} /></Field>
              <p className="text-[11px] text-ink-500 sm:col-span-2">{t('Prix indicatifs relevés en novembre 2026 : vérifiez la page tarifaire du fournisseur.', 'Indicative prices checked in November 2026: check the provider’s pricing page.')}</p>
            </section>
          </>}

          {sec === 'render' && <section className="panel grid gap-5 p-5 sm:grid-cols-2">
            <Field label={t('Qualité par défaut', 'Default quality')}><Select value={s.quality} onChange={(v) => deep('quality', v)} options={opts(QUALITIES, t)} /></Field>
            <Field label={t('Format par défaut', 'Default format')}><Select value={s.video.aspect} onChange={(v) => deep('video.aspect', v)} options={opts(ASPECTS, t)} /></Field>
            <Field label={t('Résolution d’export', 'Export resolution')}><Segmented value={s.video.resolution} onChange={(v) => deep('video.resolution', v)} options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }, { value: '4k', label: '4K' }]} /></Field>
            <Field label={t('Images par seconde', 'Frames per second')}><Segmented value={s.video.fps} onChange={(v) => deep('video.fps', v)} options={[24, 30, 60].map((v) => ({ value: v, label: `${v}` }))} /></Field>
            <Field label={t('Volume voix', 'Voice volume')}><Slider value={s.audio.voiceGainDb} min={-12} max={12} step={0.5} onChange={(v) => deep('audio.voiceGainDb', v)} format={(v) => `${v} dB`} /></Field>
            <Field label={t('Volume musique (global)', 'Music volume (global)')}><Slider value={s.audio.musicGainDb} min={-36} max={0} step={1} onChange={(v) => deep('audio.musicGainDb', v)} format={(v) => `${v} dB`} /></Field>
            <Field label={t('Volume bruitages', 'SFX volume')}><Slider value={s.audio.sfxGainDb} min={-30} max={6} step={1} onChange={(v) => deep('audio.sfxGainDb', v)} format={(v) => `${v} dB`} /></Field>
            <Field label={t('Niveau sonore final', 'Final loudness')} hint={t('−14 LUFS : norme YouTube, TikTok, Instagram.', '−14 LUFS: YouTube, TikTok, Instagram standard.')}><Slider value={s.audio.loudnessLufs} min={-24} max={-9} step={1} onChange={(v) => deep('audio.loudnessLufs', v)} format={(v) => `${v} LUFS`} /></Field>
            <Toggle checked={s.audio.ducking} onChange={(v) => deep('audio.ducking', v)} label={t('Baisser la musique sous la voix', 'Duck music under voice')} />
          </section>}

          {sec === 'data' && info && <section className="panel space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('Dossier de données', 'Data folder')} hint={t('Pour le changer, lancez l’app avec la variable STUDIO_DATA_DIR (voir README).', 'To change it, start the app with STUDIO_DATA_DIR (see README).')}><div className="input flex items-center truncate font-mono text-xs">{info.dataDir}</div></Field>
              <Field label={t('Espace utilisé', 'Space used')}><div className="input flex items-center">{formatBytes(info.dataBytes)}</div></Field>
            </div>
            <div className="rounded-xl border border-red-500/20 p-4">
              <div className="mb-3 font-medium text-red-300">{t('Supprimer des données', 'Delete data')}</div>
              <div className="flex flex-wrap gap-4">{([['projects', 'Projets et médias', 'Projects & media'], ['renders', 'Vidéos exportées', 'Exported videos'], ['templates', 'Modèles', 'Templates'], ['styles', 'Styles personnalisés', 'Custom styles'], ['secrets', 'Clés API', 'API keys']] as const).map(([k, fr, en]) => <Toggle key={k} checked={wipe[k]} onChange={(v) => setWipe({ ...wipe, [k]: v })} label={t(fr, en)} />)}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2"><input className="input h-9 w-56" placeholder={t('Tapez SUPPRIMER pour confirmer', 'Type SUPPRIMER to confirm')} value={wipe.confirm} onChange={(e) => setWipe({ ...wipe, confirm: e.target.value })} />
                <button className="btn-danger btn-sm" disabled={wipe.confirm !== 'SUPPRIMER' || !(wipe.projects || wipe.renders || wipe.templates || wipe.styles || wipe.secrets)} onClick={async () => { try { await api('/api/data', { method: 'DELETE', body: wipe }); toast.ok(t('Données supprimées', 'Data deleted')); setWipe({ projects: false, renders: false, templates: false, styles: false, secrets: false, confirm: '' }); const r = await api<any>('/api/settings'); setInfo(r); } catch (e) { toast.error(e); } }}><Trash2 size={13} /> {t('Supprimer définitivement', 'Delete permanently')}</button></div>
            </div>
          </section>}
        </div>
      </div>
    </Page>
  );
}
