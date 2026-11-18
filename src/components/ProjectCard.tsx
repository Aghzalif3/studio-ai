'use client';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getBuiltinStyle, ALL_STYLES } from '@/lib/styles/registry';
import { StylePreview } from './StylePreview';
import { useI18n } from '@/lib/client/i18n';

export interface ProjectSummary { id: string; name: string; updatedAt: string; styleId: string; aspect: string; scenes: number; thumbnailAssetId?: string; rendered?: boolean }

export function ProjectCard({ p, actions }: { p: ProjectSummary; actions?: React.ReactNode }) {
  const { t, lang } = useI18n();
  const style = getBuiltinStyle(p.styleId) ?? ALL_STYLES[0];
  return (
    <div className="group panel overflow-hidden transition hover:-translate-y-0.5 hover:border-white/15">
      <Link href={`/projects/${p.id}`} className="block">
        <div className="relative aspect-video overflow-hidden bg-ink-800">
          {p.thumbnailAssetId
            ? <img src={`/api/projects/${p.id}/assets/${p.thumbnailAssetId}`} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            : <StylePreview style={style} text={p.name} />}
          <span className="badge absolute left-2 top-2 bg-black/60 text-ink-100 backdrop-blur">{p.aspect}</span>
          {p.rendered && <span className="badge absolute right-2 top-2 bg-emerald-500/20 text-emerald-300 backdrop-blur"><CheckCircle2 size={11} /> {t('Exporté', 'Exported')}</span>}
        </div>
      </Link>
      <div className="flex items-center gap-2 p-3.5">
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
          <div className="truncate font-medium">{p.name}</div>
          <div className="mt-0.5 truncate text-xs text-ink-400">{p.scenes} {t('scènes', 'scenes')} · {style.name[lang]} · {new Date(p.updatedAt).toLocaleDateString(lang === 'fr' ? 'fr-BE' : 'en-GB', { day: 'numeric', month: 'short' })}</div>
        </Link>
        {actions}
      </div>
    </div>
  );
}
