'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutTemplate, Trash2 } from 'lucide-react';
import { Empty, Page, PageHeader, Spinner } from '@/components/ui';
import { StylePreview } from '@/components/StylePreview';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';
import { ALL_STYLES, getBuiltinStyle } from '@/lib/styles/registry';
import type { BuiltinTemplate } from '@/lib/templates';
import type { Aspect } from '@/lib/types';

interface Saved { id: string; name: string; description: string; createdAt: string; styleId: string; aspect: Aspect; scenes: number; duration: number }

export default function Templates() {
  const { t, L } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<{ builtin: BuiltinTemplate[]; saved: Saved[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api('/api/templates').then(setData).catch(toast.error);
  useEffect(() => { void load(); }, []);
  const use = async (id: string) => { setBusy(id); try { const p = await api<{ id: string }>(`/api/templates/${id}`, { body: {} }); router.push(`/projects/${p.id}`); } catch (e) { toast.error(e); setBusy(null); } };
  if (!data) return <Page><Spinner /></Page>;
  return (
    <Page wide>
      <PageHeader title={t('Modèles', 'Templates')} subtitle={t('Partez d’une structure éprouvée (pub TikTok, Reels, Shorts, spot classique…) ou réutilisez vos propres projets enregistrés comme modèles.', 'Start from a proven structure (TikTok ad, Reels, Shorts, classic spot…) or reuse your own saved projects.')} />
      <h2 className="mb-3 font-display text-lg font-semibold">{t('Mes modèles', 'My templates')}</h2>
      {data.saved.length === 0 ? <div className="mb-10"><Empty icon={<LayoutTemplate />} title={t('Aucun modèle enregistré', 'No saved template')} text={t('Dans un projet, onglet Projet › « Enregistrer comme modèle ».', 'In a project: Project tab › “Save as template”.')} /></div> :
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.saved.map((s) => (
          <div key={s.id} className="panel overflow-hidden">
            <StylePreview style={getBuiltinStyle(s.styleId) ?? ALL_STYLES[0]} text={s.name} />
            <div className="p-3.5"><div className="font-medium">{s.name}</div><div className="text-xs text-ink-400">{s.scenes} {t('scènes', 'scenes')} · {s.duration} s · {s.aspect}</div>
              <div className="mt-3 flex gap-2"><button className="btn-primary btn-sm flex-1" disabled={busy === s.id} onClick={() => use(s.id)}>{busy === s.id ? <Spinner size={13} /> : null}{t('Utiliser', 'Use')}</button><button className="btn-icon h-8 w-8 hover:text-red-300" onClick={async () => { await api(`/api/templates/${s.id}`, { method: 'DELETE' }); void load(); }}><Trash2 size={14} /></button></div></div>
          </div>))}</div>}
      <h2 className="mb-3 font-display text-lg font-semibold">{t('Modèles Studio AI', 'Studio AI templates')}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.builtin.map((b) => (
          <Link key={b.id} href={`/create?template=${b.id}`} className="panel group overflow-hidden transition hover:-translate-y-0.5 hover:border-violet-400/30">
            <StylePreview style={getBuiltinStyle(b.brief.styleId ?? '') ?? ALL_STYLES[0]} text={L(b.name)} />
            <div className="p-3.5"><div className="font-medium">{L(b.name)}</div><div className="mt-1 text-xs text-ink-400">{L(b.description)}</div><div className="mt-2 text-[11px] text-violet-300">{b.brief.aspect} · {b.brief.durationSec} s →</div></div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
