'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Copy, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { Empty, Page, PageHeader, Spinner } from '@/components/ui';
import { ProjectCard } from '@/components/ProjectCard';
import { useI18n } from '@/lib/client/i18n';
import { api, toast } from '@/lib/client/api';

interface Row { id: string; name: string; updatedAt: string; styleId: string; aspect: string; scenes: number; duration: number; validated: boolean; thumbnailAssetId?: string }

export default function Projects() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const load = () => api<Row[]>('/api/projects').then(setRows).catch((e) => { toast.error(e); setRows([]); });
  useEffect(() => { void load(); }, []);
  const del = async (r: Row) => { if (!confirm(t(`Supprimer « ${r.name} » et tous ses médias ?`, `Delete “${r.name}” and all its media?`))) return; await api(`/api/projects/${r.id}`, { method: 'DELETE' }).catch(toast.error); void load(); };
  const dup = async (r: Row) => { await api(`/api/projects/${r.id}/duplicate`, { body: {} }).catch(toast.error); void load(); };
  const list = (rows ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page wide>
      <PageHeader title={t('Mes projets', 'My projects')} subtitle={t('Tous vos projets sont enregistrés automatiquement sur votre ordinateur.', 'All projects are saved automatically on your computer.')}
        actions={<Link href="/create" className="btn-primary"><Plus size={16} /> {t('Nouveau projet', 'New project')}</Link>} />
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty icon={<FolderOpen />} title={t('Aucun projet', 'No project')} text={t('Créez votre première vidéo en quelques minutes.', 'Create your first video in minutes.')} action={<Link href="/create" className="btn-primary">{t('Créer une vidéo', 'Create a video')}</Link>} /> : (<>
        <div className="relative mb-5 w-full sm:w-72"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9" placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((r) => <ProjectCard key={r.id} p={{ ...r }} actions={<div className="flex"><button className="btn-icon h-8 w-8" title={t('Dupliquer', 'Duplicate')} onClick={() => dup(r)}><Copy size={14} /></button><button className="btn-icon h-8 w-8 hover:text-red-300" title={t('Supprimer', 'Delete')} onClick={() => del(r)}><Trash2 size={14} /></button></div>} />)}
        </div>
      </>)}
    </Page>
  );
}
