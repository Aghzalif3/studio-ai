'use client';
import { Loader2, X } from 'lucide-react';
import { useEffect } from 'react';

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-10 ${wide ? 'max-w-[1600px]' : 'max-w-6xl'} animate-fade-up`}>{children}</main>;
}

export function PageHeader({ title, subtitle, actions, kicker }: { title: string; subtitle?: string; actions?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.2em] text-violet-300/80">{kicker}</div>}
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}</label>;
}

export function Select<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`input cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238b8ba3%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9 ${className}`}>
      {options.map((o) => <option key={o.value} value={o.value} className="bg-ink-900">{o.label}</option>)}
    </select>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-ink-850 p-1">
      {options.map((o) => (
        <button type="button" key={String(o.value)} onClick={() => onChange(o.value)}
          className={`rounded-lg font-medium transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${value === o.value ? 'bg-gradient-to-b from-violet-500/30 to-blue-500/20 text-white shadow-[0_0_0_1px_rgba(167,139,250,.35)_inset]' : 'text-ink-300 hover:text-white'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-ink-200">
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-violet-500' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function Slider({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" className="w-full" value={value} min={min} max={max} step={step} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="w-16 shrink-0 text-right font-mono text-xs text-ink-300">{format ? format(value) : value}</span>
    </div>
  );
}

export const Spinner = ({ size = 16 }: { size?: number }) => <Loader2 size={size} className="animate-spin" />;

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-ink-300">{icon}</div>
      <div className="font-display text-lg font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-md text-sm text-ink-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`panel-hi my-8 w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} animate-fade-up`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function TierBadge({ tier, t }: { tier: string; t: (fr: string, en: string) => string }) {
  const m: Record<string, [string, string, string]> = {
    'free-local': ['Gratuit · local', 'Free · local', 'bg-emerald-500/15 text-emerald-300'],
    'free-online': ['Gratuit · en ligne', 'Free · online', 'bg-sky-500/15 text-sky-300'],
    'free-limited': ['Gratuit limité', 'Free, limited', 'bg-amber-500/15 text-amber-300'],
    paid: ['Payant', 'Paid', 'bg-rose-500/15 text-rose-300'],
  };
  const [fr, en, cls] = m[tier] ?? m.paid;
  return <span className={`badge ${cls}`}>{t(fr, en)}</span>;
}
