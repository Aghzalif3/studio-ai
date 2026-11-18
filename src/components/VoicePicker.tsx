'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useI18n } from '@/lib/client/i18n';
import { ApiError, api, useCostDialog, toast } from '@/lib/client/api';
import { Spinner } from './ui';

export interface VoiceOption { id: string; name: string; lang: string; gender: 'F' | 'M'; engine: string; note?: string }

export function useVoices(engine: string) {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setVoices(null); setErr(null); api<{ voices: VoiceOption[] }>(`/api/voices?engine=${engine}`).then((r) => setVoices(r.voices)).catch((e) => { setErr(e.message); setVoices([]); }); }, [engine]);
  return { voices, err };
}

/** Synthesises a sample through the server and plays it. */
export function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const stop = () => { audio.current?.pause(); setState('idle'); };
  const play = async (body: { engine: string; voice: string; text: string; lang: string; rate: number; pitch: number }, label: string) => {
    stop(); setState('loading');
    const go = async (confirmCost?: boolean) => {
      const r = await fetch('/api/voice-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, confirmCost }) });
      if (r.status === 402) { const d = await r.json(); if (await useCostDialog.getState().open(d.costUsd, label)) return go(true); return null; }
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new ApiError(d.error || `Erreur ${r.status}`, d.hint, r.status); }
      return r.blob();
    };
    try {
      const b = await go(); if (!b) { setState('idle'); return; }
      const a = new Audio(URL.createObjectURL(b)); audio.current = a; a.onended = () => setState('idle');
      await a.play(); setState('playing');
    } catch (e) { toast.error(e); setState('idle'); }
  };
  useEffect(() => () => audio.current?.pause(), []);
  return { state, play, stop };
}

export function VoiceList({ engine, lang, value, onChange, sample, rate, pitch }: { engine: string; lang: string; value: string; onChange: (id: string) => void; sample: string; rate: number; pitch: number }) {
  const { t } = useI18n();
  const { voices, err } = useVoices(engine);
  const pv = usePreview();
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!voices) return <div className="skeleton h-24 rounded-xl" />;
  if (!voices.length) return <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{err || t('Aucune voix disponible pour ce moteur sur cette machine.', 'No voice available for this engine on this machine.')}</div>;
  const base = lang.split('-')[0];
  const matching = voices.filter((v) => v.lang === lang || v.lang.startsWith(base) || v.lang === 'multi');
  const shown = showAll || !matching.length ? voices : matching;
  return (
    <div>
      <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {shown.map((v) => (
          <div key={v.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${value === v.id ? 'border-violet-400/70 bg-violet-500/10' : 'border-white/[0.06] hover:border-white/20'}`}>
            <button className="min-w-0 flex-1 text-left" onClick={() => onChange(v.id)}>
              <div className="truncate text-sm">{v.name}</div>
              <div className="truncate text-[11px] text-ink-400">{v.lang === 'multi' ? t('multilingue', 'multilingual') : v.lang}{engine === 'macos-say' ? '' : ` · ${v.gender === 'F' ? t('féminine', 'female') : t('masculine', 'male')}`}{v.note ? ` · ${v.note}` : ''}</div>
            </button>
            <button className="btn-icon h-7 w-7" title={t('Écouter', 'Listen')} onClick={() => { if (pv.state !== 'idle' && previewing === v.id) { pv.stop(); return; } setPreviewing(v.id); void pv.play({ engine, voice: v.id, text: sample, lang: v.lang === 'multi' ? lang : v.lang, rate, pitch }, t('Échantillon de voix', 'Voice sample')); }}>
              {previewing === v.id && pv.state === 'loading' ? <Spinner size={13} /> : previewing === v.id && pv.state === 'playing' ? <Square size={12} /> : <Play size={13} />}
            </button>
          </div>
        ))}
      </div>
      {matching.length > 0 && matching.length < voices.length && <button className="btn-ghost btn-sm mt-2" onClick={() => setShowAll(!showAll)}>{showAll ? t('Voix de la langue du projet uniquement', 'Project language only') : t(`Toutes les langues (${voices.length})`, `All languages (${voices.length})`)}</button>}
    </div>
  );
}
