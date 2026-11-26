'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AudioLines, Clapperboard, Scissors, FolderOpen, Home, LayoutTemplate, Menu, Mic, Palette, Settings, Sparkles, Upload, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { I18nProvider, useI18n } from '@/lib/client/i18n';
import { useCostDialog, useToasts } from '@/lib/client/api';

const NAV = [
  { href: '/', icon: Home, fr: 'Accueil', en: 'Home' },
  { href: '/montage', icon: Scissors, fr: 'Montage auto', en: 'Auto edit' },
  { href: '/create', icon: Sparkles, fr: 'Créer', en: 'Create' },
  { href: '/projects', icon: FolderOpen, fr: 'Projets', en: 'Projects' },
  { href: '/templates', icon: LayoutTemplate, fr: 'Modèles', en: 'Templates' },
  { href: '/styles', icon: Palette, fr: 'Styles', en: 'Styles' },
  { href: '/voice', icon: Mic, fr: 'Studio vocal', en: 'Voice studio' },
  { href: '/audio', icon: AudioLines, fr: 'Audio', en: 'Audio' },
  { href: '/exports', icon: Upload, fr: 'Exports', en: 'Exports' },
  { href: '/settings', icon: Settings, fr: 'Paramètres', en: 'Settings' },
];

function Sidebar({ onNav }: { onNav?: () => void }) {
  const path = usePathname();
  const { t, lang, setLang } = useI18n();
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link href="/" onClick={onNav} className="mb-5 flex items-center gap-2.5 px-2 pt-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-[0_6px_20px_-6px_rgba(255,107,44,.8)]">
          <Clapperboard size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold tracking-wide">STUDIO AI</div>
          <div className="text-[10px] uppercase tracking-[.2em] text-ink-400">{t('Création vidéo', 'Video creation')}</div>
        </div>
      </Link>
      {NAV.map((n) => {
        const on = n.href === '/' ? path === '/' : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={onNav}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${on ? 'bg-white/[0.07] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'}`}>
            {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-orange-400 to-amber-400" />}
            <n.icon size={17} className={on ? 'text-violet-300' : 'text-ink-400 group-hover:text-ink-200'} />
            {t(n.fr, n.en)}
          </Link>
        );
      })}
      <div className="mt-auto flex items-center gap-1 rounded-xl border border-white/[0.06] p-1 text-xs">
        {(['fr', 'en'] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`flex-1 rounded-lg py-1.5 font-semibold uppercase tracking-wider transition ${lang === l ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function CostDialog() {
  const { ask, close } = useCostDialog();
  const { t } = useI18n();
  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-fade-up">
      <div className="panel-hi w-full max-w-md p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-300">{t('Génération payante', 'Paid generation')}</div>
        <h3 className="font-display text-xl font-semibold">{ask.label}</h3>
        <p className="mt-3 text-sm text-ink-200">{t('Coût estimé facturé par le fournisseur sur votre compte :', 'Estimated cost billed by the provider to your account:')}</p>
        <div className="mt-2 font-display text-4xl font-bold">≈ {ask.costUsd < 0.01 ? ask.costUsd.toFixed(4) : ask.costUsd.toFixed(3)} $</div>
        <p className="mt-3 text-xs text-ink-400">{t('Estimation indicative : le prix exact dépend du fournisseur et de votre abonnement.', 'Indicative estimate: the exact price depends on the provider and your plan.')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => close(false)}>{t('Annuler', 'Cancel')}</button>
          <button className="btn-primary" onClick={() => close(true)}>{t('Confirmer et générer', 'Confirm and generate')}</button>
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { items, drop } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((x) => {
        const I = x.kind === 'ok' ? CheckCircle2 : x.kind === 'error' ? AlertTriangle : Info;
        return (
          <div key={x.id} onClick={() => drop(x.id)} className={`pointer-events-auto panel-hi flex cursor-pointer gap-3 p-3.5 animate-fade-up ${x.kind === 'error' ? 'border-red-500/30' : ''}`}>
            <I size={18} className={x.kind === 'ok' ? 'text-emerald-400' : x.kind === 'error' ? 'text-red-400' : 'text-blue-400'} />
            <div className="min-w-0 text-sm"><div className="font-medium">{x.title}</div>{x.hint && <div className="mt-0.5 text-xs text-ink-300">{x.hint}</div>}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Le studio de montage occupe tout l'écran, sans la barre latérale.
  if (path.startsWith('/montage')) return <I18nProvider>{children}<CostDialog /><Toasts /></I18nProvider>;
  return (
    <I18nProvider>
      <div className="noise-bg flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-white/[0.05] bg-ink-950/80 lg:block"><Sidebar /></aside>
        {open && (
          <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-64 border-r border-white/10 bg-ink-950" onClick={(e) => e.stopPropagation()}><Sidebar onNav={() => setOpen(false)} /></aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.05] bg-ink-950/80 px-4 backdrop-blur lg:hidden">
            <button className="btn-icon" onClick={() => setOpen(true)} aria-label="Menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
            <span className="font-display font-bold tracking-wide">STUDIO AI</span>
          </div>
          {children}
        </div>
      </div>
      <CostDialog />
      <Toasts />
    </I18nProvider>
  );
}
