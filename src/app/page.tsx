'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Clapperboard, Film, FolderOpen, ImagePlay, LayoutTemplate, Megaphone, Palette, Smartphone, Sparkles, Type, Wand2, MonitorPlay, Clock, CheckCircle2, Loader, Upload } from 'lucide-react';
import { Page, Spinner } from '@/components/ui';
import { ProjectCard, type ProjectSummary } from '@/components/ProjectCard';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';
import { formatTime } from '@/lib/util';

interface Stats { projects: number; projectsDone: number; projectsInProgress: number; exports: number; generationSeconds: number; latest: ProjectSummary[]; inProgress: ProjectSummary[]; exportHistory: any[] }

const ACTIONS = [
  { href: '/create', icon: Sparkles, fr: 'Nouveau projet', en: 'New project', d: ['Partir d’une idée', 'Start from an idea'], hi: true },
  { href: '/create?mode=video', icon: Wand2, fr: 'Générer une vidéo', en: 'Generate a video', d: ['Idée → vidéo complète', 'Idea → full video'] },
  { href: '/create?mode=image', icon: ImagePlay, fr: 'Image → vidéo', en: 'Image → video', d: ['Animer vos images', 'Animate your images'] },
  { href: '/create?mode=text', icon: Type, fr: 'Texte → vidéo', en: 'Text → video', d: ['Article, script, notes', 'Article, script, notes'] },
  { href: '/create?mode=ad', icon: Megaphone, fr: 'Publicité', en: 'Ad', d: ['Accroche, offre, CTA', 'Hook, offer, CTA'] },
  { href: '/create?mode=tiktok', icon: Smartphone, fr: 'TikTok / Reels', en: 'TikTok / Reels', d: ['Vertical 9:16', 'Vertical 9:16'] },
  { href: '/create?mode=youtube', icon: MonitorPlay, fr: 'YouTube', en: 'YouTube', d: ['Horizontal 16:9', 'Horizontal 16:9'] },
  { href: '/create?mode=animation', icon: Film, fr: 'Animation', en: 'Animation', d: ['Histoire animée', 'Animated story'] },
  { href: '/projects', icon: FolderOpen, fr: 'Mes projets', en: 'My projects', d: ['Reprendre un montage', 'Resume editing'] },
  { href: '/templates', icon: LayoutTemplate, fr: 'Mes modèles', en: 'My templates', d: ['Structures réutilisables', 'Reusable structures'] },
  { href: '/styles', icon: Palette, fr: 'Bibliothèque de styles', en: 'Style library', d: ['110 styles visuels', '110 visual styles'] },
];

export default function Home() {
  const { t } = useI18n();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { api<Stats>('/api/stats').then(setS).catch((e) => toast.error(e)); }, []);

  const stats = [
    { icon: CheckCircle2, v: s?.projectsDone, fr: 'Projets exportés', en: 'Projects exported' },
    { icon: Loader, v: s?.projectsInProgress, fr: 'En cours', en: 'In progress' },
    { icon: Upload, v: s?.exports, fr: 'Exports MP4', en: 'MP4 exports' },
    { icon: Clock, v: s ? formatTime(s.generationSeconds) : undefined, fr: 'Temps de génération', en: 'Generation time' },
  ];

  return (
    <Page wide>
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-40 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-200"><Clapperboard size={13} className="text-violet-300" /> {t('Local d’abord · moteurs gratuits par défaut', 'Local first · free engines by default')}</div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"><span className="glow-text">{t('De l’idée à la vidéo', 'From idea to video')}</span><br />{t('en quelques minutes.', 'in minutes.')}</h1>
          <p className="mt-4 text-ink-300">{t('Scénario, storyboard, voix, sous-titres, musique et montage : tout se fait sur votre Mac. Les moteurs payants restent optionnels et leur coût est affiché avant chaque génération.', 'Script, storyboard, voice, captions, music and editing all run on your Mac. Paid engines are optional and their cost is shown before each generation.')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/create" className="btn-primary h-11 px-5">{t('Créer une vidéo', 'Create a video')} <ArrowRight size={16} /></Link>
            <Link href="/templates" className="btn-outline h-11 px-5">{t('Partir d’un modèle', 'Start from a template')}</Link>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((x) => (
          <div key={x.fr} className="panel p-4">
            <div className="flex items-center gap-2 text-xs text-ink-400"><x.icon size={14} /> {t(x.fr, x.en)}</div>
            <div className="mt-2 font-display text-3xl font-bold">{x.v === undefined ? <span className="skeleton inline-block h-8 w-14 rounded" /> : x.v}</div>
          </div>
        ))}
      </section>

      <h2 className="mb-4 font-display text-xl font-semibold">{t('Actions rapides', 'Quick actions')}</h2>
      <section className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {ACTIONS.map((a) => (
          <Link key={a.href + a.fr} href={a.href} className={`group panel relative flex flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-violet-400/30 ${a.hi ? 'bg-gradient-to-br from-violet-600/25 to-blue-600/10' : ''}`}>
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${a.hi ? 'bg-white/15 text-white' : 'bg-white/[0.05] text-violet-300'} transition group-hover:scale-105`}><a.icon size={18} /></div>
            <div><div className="text-sm font-semibold">{t(a.fr, a.en)}</div><div className="mt-0.5 text-xs text-ink-400">{t(a.d[0], a.d[1])}</div></div>
          </Link>
        ))}
      </section>

      <div className="grid gap-10 xl:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">{t('Dernières créations', 'Latest creations')}</h2><Link href="/projects" className="btn-ghost btn-sm">{t('Tout voir', 'See all')} <ArrowRight size={13} /></Link></div>
          {!s ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton aspect-[4/3] rounded-2xl" />)}</div>
            : s.latest.length === 0 ? <div className="panel p-8 text-center text-sm text-ink-400">{t('Aucun projet pour l’instant. Créez votre première vidéo !', 'No project yet. Create your first video!')}</div>
            : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{s.latest.slice(0, 6).map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">{t('Historique des exports', 'Export history')}</h2><Link href="/exports" className="btn-ghost btn-sm">{t('Tout voir', 'See all')} <ArrowRight size={13} /></Link></div>
          <div className="panel divide-y divide-white/[0.05]">
            {!s ? <div className="p-6"><Spinner /></div> : s.exportHistory.length === 0 ? <div className="p-6 text-sm text-ink-400">{t('Aucun export pour l’instant.', 'No export yet.')}</div> :
              s.exportHistory.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3.5">
                  <span className={`h-2 w-2 rounded-full ${r.status === 'done' ? 'bg-emerald-400' : r.status === 'error' ? 'bg-red-400' : r.status === 'cancelled' ? 'bg-ink-400' : 'bg-amber-400 animate-pulse'}`} />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm">{r.projectName}</div><div className="text-xs text-ink-400">{r.resolution} · {r.fps} i/s · {new Date(r.createdAt).toLocaleString()}</div></div>
                  {r.status === 'done' && <a href={`/api/renders/${r.id}/file?download`} className="btn-ghost btn-sm">MP4</a>}
                </div>
              ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
