'use client';
import { useEffect } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEngines } from '@/lib/client/engines';
import { useI18n } from '@/lib/client/i18n';
import type { EngineKind } from '@/lib/engines/catalog';
import { TierBadge } from './ui';

/** Lists the engines of one kind with their real availability and cost. */
export function EngineSelect({ kind, value, onChange, dense = false }: { kind: EngineKind; value: string; onChange: (id: string) => void; dense?: boolean }) {
  const { items, load } = useEngines();
  const { t, L } = useI18n();
  useEffect(() => { void load().catch(() => {}); }, [load]);
  const list = items.filter((e) => e.kind === kind);
  if (!list.length) return <div className="skeleton h-24 rounded-xl" />;
  return (
    <div className={`grid gap-2 ${dense ? '' : 'sm:grid-cols-2'}`}>
      {list.map((e) => (
        <button type="button" key={e.id} onClick={() => onChange(e.id)}
          className={`rounded-xl border p-3 text-left transition ${value === e.id ? 'border-violet-400/70 bg-violet-500/10' : 'border-white/[0.07] bg-ink-850 hover:border-white/20'}`}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
            <TierBadge tier={e.tier} t={t} />
          </div>
          <div className="mt-1 text-xs text-ink-300">{L(e.costNote)}</div>
          {!dense && <div className="mt-1 text-xs text-ink-400">{L(e.description)}</div>}
          <div className={`mt-1.5 flex items-center gap-1 text-[11px] ${e.ready ? 'text-emerald-300/90' : 'text-amber-300/90'}`}>
            {e.ready ? <CircleCheck size={12} /> : <CircleAlert size={12} />} {e.reason || (e.ready ? t('Disponible', 'Available') : '')}
          </div>
          {!e.ready && e.setup && <div className="mt-1 text-[11px] text-ink-400">{L(e.setup)}</div>}
          {e.commercialNote && value === e.id && <div className="mt-1.5 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-200">{L(e.commercialNote)}</div>}
        </button>
      ))}
    </div>
  );
}
