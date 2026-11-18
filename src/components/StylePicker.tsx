'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Sparkles } from 'lucide-react';
import { ALL_STYLES } from '@/lib/styles/registry';
import { CATEGORIES, type StyleDef } from '@/lib/styles/types';
import { useI18n } from '@/lib/client/i18n';
import { useCustomStyles } from '@/lib/client/styles';
import { StylePreview } from './StylePreview';
import { Modal } from './ui';

export function filterStyles(all: StyleDef[], cat: string, q: string, L: (o: { fr: string; en: string }) => string) {
  const s = q.trim().toLowerCase();
  return all.filter((x) => (cat === 'all' || (cat === 'featured' ? x.featured : x.category === cat)) &&
    (!s || L(x.name).toLowerCase().includes(s) || x.uses.join(' ').toLowerCase().includes(s) || L(x.description).toLowerCase().includes(s)));
}

export function StyleGrid({ value, onPick, compact = false }: { value?: string; onPick: (s: StyleDef) => void; compact?: boolean }) {
  const { t, L } = useI18n();
  const custom = useCustomStyles();
  useEffect(() => { void custom.load().catch(() => {}); }, []);
  const [cat, setCat] = useState('featured');
  const [q, setQ] = useState('');
  const all = useMemo(() => [...custom.items, ...ALL_STYLES], [custom.items]);
  const list = filterStyles(all, cat, q, L);
  const cats = [{ id: 'all', fr: 'Tous', en: 'All' }, ...CATEGORIES.filter((c) => c.id === 'featured' || c.id === 'custom' ? (c.id !== 'custom' || custom.items.length > 0) : all.some((s) => s.category === c.id))];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder={t('Rechercher un style…', 'Search a style…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`chip ${cat === c.id ? 'chip-on' : ''}`}>{c.id === 'featured' && <Sparkles size={12} />}{t(c.fr, c.en)}</button>)}
        </div>
      </div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
        {list.map((s) => (
          <button key={s.id} onClick={() => onPick(s)} className={`group overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 ${value === s.id ? 'border-violet-400 ring-2 ring-violet-500/30' : 'border-white/[0.07] hover:border-white/20'}`}>
            <div className="relative"><StylePreview style={s} />{value === s.id && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-violet-500"><Check size={14} /></span>}</div>
            <div className="bg-ink-850 p-2.5">
              <div className="flex items-center gap-1.5 truncate text-sm font-medium">{L(s.name)}{s.needsImageGen && <span className="badge bg-blue-500/15 text-blue-300" title={t('Ce style donne son meilleur résultat avec un moteur d’images IA', 'This style works best with an AI image engine')}>IA</span>}</div>
              {!compact && <div className="mt-0.5 line-clamp-2 text-xs text-ink-400">{L(s.description)}</div>}
            </div>
          </button>
        ))}
        {list.length === 0 && <div className="col-span-full py-10 text-center text-sm text-ink-400">{t('Aucun style ne correspond.', 'No matching style.')}</div>}
      </div>
    </div>
  );
}

export function StylePickerModal({ open, onClose, value, onPick }: { open: boolean; onClose: () => void; value?: string; onPick: (s: StyleDef) => void }) {
  const { t } = useI18n();
  return <Modal open={open} onClose={onClose} title={t('Choisir un style', 'Pick a style')} wide><div className="max-h-[70vh] overflow-y-auto pr-1"><StyleGrid value={value} compact onPick={(s) => { onPick(s); onClose(); }} /></div></Modal>;
}
