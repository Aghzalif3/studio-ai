'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CloudOff, Download, LayoutGrid, Loader2, Mic, Music, Redo2, Settings2, Subtitles, Undo2, Clapperboard } from 'lucide-react';
import { useProject } from '@/lib/client/project-store';
import { useI18n } from '@/lib/client/i18n';
import { useStyle } from '@/lib/client/styles';
import { usePlayer } from '@/lib/client/player';
import { PlayerView } from '@/components/workspace/PlayerView';
import { Storyboard } from '@/components/workspace/Storyboard';
import { Editor } from '@/components/workspace/Editor';
import { VoiceTab } from '@/components/workspace/VoiceTab';
import { CaptionsTab } from '@/components/workspace/CaptionsTab';
import { AudioTab } from '@/components/workspace/AudioTab';
import { ExportTab } from '@/components/workspace/ExportTab';
import { ProjectSettings } from '@/components/workspace/ProjectSettings';
import { Spinner } from '@/components/ui';

const TABS = [
  { id: 'storyboard', icon: LayoutGrid, fr: 'Storyboard', en: 'Storyboard' },
  { id: 'editor', icon: Clapperboard, fr: 'Montage', en: 'Editor' },
  { id: 'voice', icon: Mic, fr: 'Voix', en: 'Voice' },
  { id: 'captions', icon: Subtitles, fr: 'Sous-titres', en: 'Captions' },
  { id: 'audio', icon: Music, fr: 'Musique & sons', en: 'Music & sound' },
  { id: 'export', icon: Download, fr: 'Export', en: 'Export' },
  { id: 'settings', icon: Settings2, fr: 'Projet', en: 'Project' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { project: p, status, load, edit, undo, redo, past, future, flush } = useProject();
  const [tab, setTab] = useState<Tab>('storyboard');
  const [err, setErr] = useState<string | null>(null);
  const style = useStyle(p?.brief.styleId);
  const player = usePlayer(p, style, { gains: { voice: 0, music: p ? p.musicSettings.gainDb : -16, sfx: -8 } });

  useEffect(() => { load(id).catch((e) => setErr(e.message)); }, [id, load]);
  useEffect(() => { const h = new URLSearchParams(location.search).get('tab') as Tab | null; if (h && TABS.some((x) => x.id === h)) setTab(h); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    };
    const before = (e: BeforeUnloadEvent) => { if (useProject.getState().status === 'dirty' || useProject.getState().status === 'saving') { void flush(); e.preventDefault(); } };
    window.addEventListener('keydown', k); window.addEventListener('beforeunload', before);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('beforeunload', before); void flush(); };
  }, [undo, redo, flush]);

  if (err) return <div className="p-10 text-center"><div className="text-lg font-semibold">{t('Projet introuvable', 'Project not found')}</div><p className="mt-1 text-sm text-ink-400">{err}</p><Link href="/projects" className="btn-outline mt-4">{t('Mes projets', 'My projects')}</Link></div>;
  if (!p) return <div className="grid h-[70vh] place-items-center"><Spinner size={24} /></div>;

  const switchTab = (x: Tab) => { setTab(x); history.replaceState(null, '', `?tab=${x}`); };
  const showPlayer = tab !== 'editor' && tab !== 'export';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink-950/85 backdrop-blur lg:top-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <Link href="/projects" className="btn-icon" aria-label={t('Retour', 'Back')}><ArrowLeft size={17} /></Link>
          <input className="min-w-0 max-w-sm flex-1 rounded-lg bg-transparent px-2 py-1 font-display text-lg font-semibold outline-none hover:bg-white/[0.04] focus:bg-white/[0.05]" value={p.name} onChange={(e) => edit((pp) => { pp.name = e.target.value; }, { history: false })} />
          <span className="flex items-center gap-1.5 text-xs text-ink-400">
            {status === 'saving' || status === 'dirty' ? <><Loader2 size={12} className="animate-spin" /> {t('Enregistrement…', 'Saving…')}</> : status === 'error' ? <><CloudOff size={12} className="text-red-400" /> {t('Non enregistré', 'Not saved')}</> : <><Check size={12} className="text-emerald-400" /> {t('Enregistré', 'Saved')}</>}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-icon" disabled={!past.length} onClick={undo} title={t('Annuler (Ctrl/Cmd+Z)', 'Undo (Ctrl/Cmd+Z)')}><Undo2 size={16} /></button>
            <button className="btn-icon" disabled={!future.length} onClick={redo} title={t('Rétablir (Maj+Ctrl/Cmd+Z)', 'Redo')}><Redo2 size={16} /></button>
            <button className="btn-primary btn-sm ml-2" onClick={() => switchTab('export')}><Download size={14} /> {t('Exporter', 'Export')}</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((x) => (
            <button key={x.id} onClick={() => switchTab(x.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition ${tab === x.id ? 'border-violet-400 text-white' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>
              <x.icon size={15} /> {t(x.fr, x.en)}
            </button>
          ))}
        </nav>
      </header>
      <div className={`flex-1 px-4 py-5 sm:px-6 ${showPlayer ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]' : ''}`}>
        <div className="min-w-0 animate-fade-up" key={tab}>
          {tab === 'storyboard' && <Storyboard style={style} />}
          {tab === 'editor' && <Editor style={style} player={player} />}
          {tab === 'voice' && <VoiceTab />}
          {tab === 'captions' && <CaptionsTab />}
          {tab === 'audio' && <AudioTab />}
          {tab === 'export' && <ExportTab player={player} />}
          {tab === 'settings' && <ProjectSettings />}
        </div>
        {showPlayer && <aside className="order-first xl:order-none"><div className="sticky top-[118px]"><PlayerView player={player} maxH="62vh" /><p className="mt-2 text-center text-[11px] text-ink-500">{t('Aperçu en temps réel, dessiné par le même moteur que l’export. Espace = lecture/pause.', 'Real-time preview drawn by the same engine as the export. Space = play/pause.')}</p></div></aside>}
      </div>
    </div>
  );
}
