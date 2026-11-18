import { handler, json } from '@/lib/server/http';
import { listProjects, listRenders } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real numbers for the home dashboard, computed from the local data. */
export const GET = handler(async () => {
  const [projects, renders] = await Promise.all([listProjects(), listRenders()]);
  const done = renders.filter((r) => r.status === 'done');
  const doneProjects = new Set(done.map((r) => r.projectId));
  const genSec = projects.reduce((a, p) => a + (p.generationSeconds || 0), 0) + done.reduce((a, r) => a + (r.elapsedSec || 0), 0);
  const summary = (p: (typeof projects)[number]) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, styleId: p.brief.styleId, aspect: p.brief.aspect, scenes: p.scenes.length, thumbnailAssetId: p.thumbnailAssetId ?? p.scenes.find((s) => s.imageAssetId)?.imageAssetId, rendered: doneProjects.has(p.id) });
  return json({
    projects: projects.length,
    projectsDone: doneProjects.size,
    projectsInProgress: projects.filter((p) => !doneProjects.has(p.id)).length,
    exports: done.length,
    generationSeconds: Math.round(genSec),
    latest: projects.slice(0, 8).map(summary),
    inProgress: projects.filter((p) => !doneProjects.has(p.id)).slice(0, 6).map(summary),
    exportHistory: renders.slice(0, 8),
  });
});
