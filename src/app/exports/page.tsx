'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, Trash2, Upload, X } from 'lucide-react';
import { Empty, Page, PageHeader, Spinner } from '@/components/ui';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';
import { formatBytes, formatDate, formatTime } from '@/lib/util';

interface R { id: string; projectId: string; projectName: string; status: string; progress?: number; etaSec?: number; resolution: string; fps: number; width: number; height: number; createdAt: string; sizeBytes?: number; elapsedSec?: number; durationSec?: number; error?: string }

export default function Exports() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<R[] | null>(null);
  const load = useCallback(() => api<{ items: R[] }>('/api/renders').then((r) => setItems(r.items)).catch((e) => { toast.error(e); setItems([]); }), []);
  useEffect(() => { void load(); }, [load]);
  const active = items?.some((r) => r.status === 'queued' || r.status === 'running');
  useEffect(() => { if (!active) return; const id = setInterval(load, 1000); return () => clearInterval(id); }, [active, load]);
  const label: Record<string, [string, string, string]> = { done: ['Terminé', 'Done', 'text-emerald-300'], error: ['Erreur', 'Error', 'text-red-300'], cancelled: ['Annulé', 'Cancelled', 'text-ink-400'], running: ['En cours', 'Running', 'text-amber-300'], queued: ['En attente', 'Queued', 'text-amber-300'] };
  return (
    <Page wide>
      <PageHeader title={t('Historique des exports', 'Export history')} subtitle={t('Toutes vos vidéos rendues, stockées dans le dossier studio-data/renders de votre ordinateur.', 'All rendered videos, stored in studio-data/renders on your computer.')} />
      {!items ? <Spinner /> : items.length === 0 ? <Empty icon={<Upload />} title={t('Aucun export', 'No export')} text={t('Exportez un projet depuis son onglet Export.', 'Export a project from its Export tab.')} /> :
        <div className="panel divide-y divide-white/[0.05]">
          {items.map((r) => { const l = label[r.status] ?? [r.status, r.status, '']; const running = r.status === 'running' || r.status === 'queued'; return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.projectName}</div>
                <div className="text-xs text-ink-400">{r.width}×{r.height} · {r.fps} i/s · {formatDate(r.createdAt, lang)}{r.durationSec ? ` · ${formatTime(r.durationSec)}` : ''}{r.sizeBytes ? ` · ${formatBytes(r.sizeBytes)}` : ''}{r.elapsedSec ? ` · ${t('calculé en', 'rendered in')} ${formatTime(r.elapsedSec)}` : ''}</div>
                {r.error && <div className="mt-1 text-xs text-red-300">{r.error}</div>}
                {running && <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${Math.round((r.progress ?? 0) * 100)}%` }} /></div>}
              </div>
              <span className={`text-xs font-medium ${l[2]}`}>{t(l[0], l[1])}{running && r.progress ? ` · ${Math.round(r.progress * 100)} %` : ''}</span>
              <Link href={`/projects/${r.projectId}?tab=export`} className="btn-icon h-8 w-8" title={t('Ouvrir le projet', 'Open project')}><ExternalLink size={14} /></Link>
              {r.status === 'done' && <a href={`/api/renders/${r.id}/file?download`} className="btn-outline btn-sm"><Download size={13} /> MP4</a>}
              <button className="btn-icon h-8 w-8 hover:text-red-300" title={running ? t('Annuler', 'Cancel') : t('Supprimer', 'Delete')} onClick={() => api(`/api/renders/${r.id}`, { method: 'DELETE' }).then(load).catch(toast.error)}>{running ? <X size={14} /> : <Trash2 size={14} />}</button>
            </div>); })}
        </div>}
    </Page>
  );
}
