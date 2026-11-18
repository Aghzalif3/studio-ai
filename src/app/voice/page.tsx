'use client';
import { useState } from 'react';
import { Mic, Play, Square } from 'lucide-react';
import { Field, Page, PageHeader, Select, Slider, Spinner } from '@/components/ui';
import { EngineSelect } from '@/components/EngineSelect';
import { VoiceList, usePreview } from '@/components/VoicePicker';
import { Recorder } from '@/components/Recorder';
import { useI18n } from '@/lib/client/i18n';
import { LANGUAGES, opts } from '@/lib/client/options';

const SAMPLES: Record<string, string> = {
  fr: 'Bienvenue dans Studio AI. En septante secondes, découvrez comment transformer une simple idée en vidéo.',
  en: 'Welcome to Studio AI. In seventy seconds, discover how to turn a simple idea into a video.',
  es: 'Bienvenido a Studio AI. Descubre cómo convertir una simple idea en un vídeo.',
  ar: 'مرحبا بكم في ستوديو إيه آي. اكتشفوا كيف تحولون فكرة بسيطة إلى فيديو.',
};

export default function VoiceStudio() {
  const { t } = useI18n();
  const [engine, setEngine] = useState('edge');
  const [lang, setLang] = useState('fr-BE');
  const [voice, setVoice] = useState('fr-BE-CharlineNeural');
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [text, setText] = useState(SAMPLES.fr);
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const pv = usePreview();
  return (
    <Page wide>
      <PageHeader kicker={t('Studio vocal', 'Voice studio')} title={t('Voix et narration', 'Voices & narration')} subtitle={t('Essayez les voix (françaises de France, de Belgique, du Canada, de Suisse, anglaises, espagnoles, arabes), réglez vitesse et hauteur, ou enregistrez votre propre voix. Dans un projet, la voix choisie se règle dans l’onglet Voix.', 'Try voices, tune speed and pitch, or record your own voice. In a project, set the voice in the Voice tab.')} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="panel p-5"><span className="label">{t('Moteur de voix', 'Voice engine')}</span><EngineSelect kind="voice" value={engine} onChange={(e) => { setEngine(e); setVoice(''); }} /></section>
          <section className="panel p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><span className="label">{t('Voix', 'Voices')}</span><div className="w-56"><Select value={lang} onChange={(v) => { setLang(v); setText(SAMPLES[v.split('-')[0]] ?? SAMPLES.fr); }} options={opts(LANGUAGES, t)} /></div></div>
            <VoiceList engine={engine} lang={lang} value={voice} onChange={setVoice} sample={text} rate={rate} pitch={pitch} />
          </section>
        </div>
        <aside className="space-y-5">
          <section className="panel space-y-4 p-5">
            <Field label={t('Texte à lire', 'Text to read')}><textarea className="textarea" rows={5} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} dir={lang.startsWith('ar') ? 'rtl' : 'ltr'} /></Field>
            <Field label={t('Vitesse', 'Speed')}><Slider value={rate} min={-50} max={100} step={5} onChange={setRate} format={(v) => `${v > 0 ? '+' : ''}${v} %`} /></Field>
            <Field label={t('Hauteur', 'Pitch')}><Slider value={pitch} min={-50} max={50} step={5} onChange={setPitch} format={(v) => `${v > 0 ? '+' : ''}${v}`} /></Field>
            <button className="btn-primary w-full" disabled={!voice || !text.trim()} onClick={() => pv.state === 'playing' ? pv.stop() : pv.play({ engine, voice, text, lang, rate, pitch }, t('Échantillon de voix', 'Voice sample'))}>
              {pv.state === 'loading' ? <Spinner /> : pv.state === 'playing' ? <Square size={15} /> : <Play size={15} />} {pv.state === 'playing' ? t('Arrêter', 'Stop') : t('Écouter', 'Listen')}
            </button>
            {!voice && <p className="text-xs text-ink-500">{t('Choisissez une voix dans la liste.', 'Pick a voice from the list.')}</p>}
          </section>
          <section className="panel space-y-3 p-5">
            <div className="flex items-center gap-2 font-medium"><Mic size={16} className="text-violet-300" /> {t('Votre propre voix', 'Your own voice')}</div>
            <p className="text-xs text-ink-400">{t('Testez votre micro ici. Pour l’utiliser dans une vidéo : choisissez « Ma propre voix » dans l’assistant, puis enregistrez ou importez chaque scène dans l’onglet Voix du projet.', 'Test your mic here. To use it in a video, choose “My own voice” in the wizard, then record or import each scene in the project’s Voice tab.')}</p>
            <Recorder onDone={(f) => setRecUrl(URL.createObjectURL(f))} />
            {recUrl && <audio controls src={recUrl} className="w-full" />}
          </section>
        </aside>
      </div>
    </Page>
  );
}
