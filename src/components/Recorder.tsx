'use client';
import { useEffect, useRef, useState } from 'react';
import { Circle, Square } from 'lucide-react';
import { useI18n } from '@/lib/client/i18n';
import { toast } from '@/lib/client/api';

/** Microphone recorder (MediaRecorder). Calls onDone with the recorded file. */
export function Recorder({ onDone, compact = false }: { onDone: (f: File) => void; compact?: boolean }) {
  const { t } = useI18n();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [sec, setSec] = useState(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => { if (!rec) return; const id = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(id); }, [rec]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((x) => x.stop()); const type = r.mimeType || 'audio/webm'; onDone(new File([new Blob(chunks.current, { type })], `enregistrement.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type })); };
      r.start(); setSec(0); setRec(r);
    } catch { toast.error(new Error(t('Micro inaccessible : autorisez le micro dans le navigateur (et dans Réglages macOS › Confidentialité › Micro).', 'Microphone unavailable: allow it in the browser and macOS privacy settings.'))); }
  };
  const stop = () => { rec?.stop(); setRec(null); };
  return rec
    ? <button className="btn-danger btn-sm" onClick={stop}><Square size={12} /> {t('Arrêter', 'Stop')} · {sec}s</button>
    : <button className="btn-outline btn-sm" onClick={start}><Circle size={12} className="fill-red-500 text-red-500" /> {compact ? t('Enregistrer', 'Record') : t('Enregistrer ma voix', 'Record my voice')}</button>;
}
