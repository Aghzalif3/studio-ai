'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Film, Loader2, Sparkles, Square, Undo2, Upload, X } from 'lucide-react';
import { useMontage } from '@/lib/montage/store';
import { exportMime, exportMontage } from '@/lib/montage/export';
import { AGENTS } from '@/lib/montage/agents';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';

export function MontageStudio() {
  const media = useMontage((s) => s.media);
  const running = useMontage((s) => s.running);
  const tasks = useMontage((s) => s.tasks);
  const error = useMontage((s) => s.error);
  const history = useMontage((s) => s.history.length);
  const [exportOpen, setExportOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const ready = tasks.watch.state === 'done';
  const edited = tasks.place.state === 'done';

  useEffect(() => { void useMontage.getState().restore(); }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(x.name));
    if (f) void useMontage.getState().importFile(f);
  };

  return (
    <div className="montage flex h-screen flex-col overflow-hidden bg-[#08080a] text-ink-100" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }} onDrop={onDrop}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0c0c0f] px-3">
        <Link href="/" className="mbtn-icon" title="Retour à l’accueil"><ArrowLeft size={16} /></Link>
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-orange-500 text-black"><Film size={15} strokeWidth={2.6} /></div>
          <div className="font-display text-[15px] font-bold tracking-tight">Studio<span className="text-orange-400"> AI</span></div>
          <span className="hidden rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-orange-300 sm:inline">Montage auto</span>
        </div>
        <div className="mx-2 hidden items-center gap-1.5 md:flex">
          {AGENTS.slice(0, 16).map((a) => <span key={a.id} className="h-2 w-2 rounded-full" style={{ background: a.color, opacity: running ? 1 : 0.35 }} title={a.id} />)}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="mbtn-icon" disabled={!history || running} onClick={() => useMontage.getState().undo()} title="Annuler (Cmd+Z)"><Undo2 size={15} /></button>
          {running ? (
            <button onClick={() => useMontage.getState().stop()} className="flex h-9 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/[0.06]"><Square size={13} fill="currentColor" /> Arrêter</button>
          ) : (
            <button disabled={!media || !ready} onClick={() => void useMontage.getState().runAgents()} className="flex h-9 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-black shadow-[0_0_30px_-6px_rgba(255,107,44,.9)] transition hover:bg-orange-400 disabled:opacity-40 disabled:shadow-none">
              <Sparkles size={15} /> {edited ? 'Remonter avec les 16 agents' : 'Lancer les 16 agents'}
            </button>
          )}
          <button disabled={!media || running} onClick={() => setExportOpen(true)} className="flex h-9 items-center gap-2 rounded-xl border border-orange-500/50 px-3 text-sm font-semibold text-orange-200 transition hover:bg-orange-500/10 disabled:opacity-40"><Download size={15} /> Exporter</button>
        </div>
      </header>
      {error && <div className="flex items-center gap-2 bg-rose-500/15 px-4 py-1.5 text-xs text-rose-200"><X size={13} /> {error}</div>}

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_270px] grid-rows-[minmax(0,1fr)_minmax(0,300px)]">
        <aside className="row-span-2 min-h-0 border-r border-white/[0.06] bg-[#0c0c0f]"><LeftPanel /></aside>
        <main className="relative min-h-0 p-2">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-orange-500/40 bg-[#0f0f13] shadow-[0_0_0_1px_rgba(255,107,44,.08),0_0_60px_-30px_rgba(255,107,44,.6)]">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${running ? 'bg-orange-500 text-black' : 'bg-white/[0.06] text-ink-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-black animate-pulse' : 'bg-orange-400'}`} /> {running ? 'Montage en direct' : 'Aperçu'}</span>
              {media && <span className="truncate text-[11px] text-ink-400">{media.name}</span>}
            </div>
            <div className="min-h-0 flex-1">{media ? <Preview /> : <EmptyState />}</div>
          </div>
          {dragOver && <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-orange-400 bg-orange-500/10 text-lg font-bold text-orange-200">Lâche ta vidéo ici</div>}
        </main>
        <aside className="min-h-0 border-l border-white/[0.06] bg-[#0c0c0f]"><RightPanel /></aside>
        <section className="col-span-2 min-h-0 border-t border-white/[0.06] bg-[#0a0a0d]"><Timeline /></section>
      </div>
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function EmptyState() {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-lg text-center">
        <input ref={input} type="file" accept="video/*,.mov,.mp4,.m4v,.webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void useMontage.getState().importFile(f); }} />
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/40"><Upload size={28} /></div>
        <h2 className="font-display text-2xl font-bold text-white">Dépose ta vidéo, 16 agents la montent</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">Ils coupent les blancs et les « euh », posent les sous-titres mot par mot, ajoutent lettres géantes, compteurs, flèches, cadres et zooms, puis placent les bruitages. Tu vois tout arriver en direct sur la timeline, et tu peux tout modifier.</p>
        <button onClick={() => input.current?.click()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 font-semibold text-black hover:bg-orange-400"><Upload size={16} /> Choisir une vidéo</button>
        <p className="mt-3 text-[11px] text-ink-500">Face caméra de préférence · MP4, MOV ou WebM · tout reste sur ton ordinateur</p>
      </div>
    </div>
  );
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const media = useMontage((s) => s.media)!;
  const plan = useMontage((s) => s.plan);
  const st = useMontage((s) => s.settings);
  const [quality, setQuality] = useState<'720p' | '1080p'>('1080p');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fmt = exportMime();
  const start = async () => {
    setErr(null); setResult(null); setProgress(0);
    abort.current = new AbortController();
    useMontage.getState().setTask('render', { state: 'doing', progress: 0 });
    try {
      const { blob, ext } = await exportMontage({ url: media.url, plan, look: st.captionLook, aspect: st.aspect, quality, signal: abort.current.signal, onProgress: (p) => { setProgress(p); useMontage.getState().setTask('render', { progress: p }); } });
      const name = media.name.replace(/\.[^.]+$/, '') + `-monte.${ext}`;
      setResult({ url: URL.createObjectURL(blob), name, size: blob.size });
      useMontage.getState().setTask('render', { state: 'done', progress: 1 });
    } catch (e: any) {
      setErr(e.name === 'AbortError' ? 'Export annulé.' : e.message); setProgress(null);
      useMontage.getState().setTask('render', { state: 'todo', progress: 0 });
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-orange-500/30 bg-[#111114] p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold text-white">Exporter le montage</h3><button className="mbtn-icon" onClick={() => { abort.current?.abort(); onClose(); }}><X size={16} /></button></div>
        <p className="mt-1 text-[12px] text-ink-400">{st.aspect} · {plan.duration.toFixed(1)} s · fichier {fmt.ext.toUpperCase()} · sous-titres, motions et bruitages incrustés</p>
        <div className="mt-4 flex gap-1.5">{(['720p', '1080p'] as const).map((q) => <button key={q} disabled={progress != null && !result} onClick={() => setQuality(q)} className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${quality === q ? 'border-orange-500 bg-orange-500/15 text-orange-200' : 'border-white/10 text-ink-300'}`}>{q}</button>)}</div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">Le navigateur rejoue le montage en temps réel pour l’enregistrer : compte environ {Math.ceil(plan.duration)} s. Garde cet onglet visible pendant l’export.</p>
        {progress != null && !result && (
          <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div><div className="mt-1 text-right font-mono text-[11px] text-ink-300">{Math.round(progress * 100)} %</div></div>
        )}
        {err && <p className="mt-3 text-[12px] text-rose-300">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          {result ? (
            <a href={result.url} download={result.name} className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-black hover:bg-orange-400"><Download size={15} /> Télécharger ({(result.size / 1e6).toFixed(1)} Mo)</a>
          ) : progress != null ? (
            <button onClick={() => abort.current?.abort()} className="h-10 rounded-xl border border-white/15 px-4 text-sm text-white"><Loader2 size={14} className="mr-1 inline animate-spin" /> Annuler</button>
          ) : (
            <button onClick={start} className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-black hover:bg-orange-400"><Download size={15} /> Lancer l’export</button>
          )}
        </div>
      </div>
    </div>
  );
}
