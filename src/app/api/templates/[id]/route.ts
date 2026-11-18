import { handler, json } from '@/lib/server/http';
import { listTemplates, saveProject, saveTemplates } from '@/lib/server/store';
import { buildTimeline } from '@/lib/project';
import { uid } from '@/lib/util';

export const runtime = 'nodejs';
type P = { params: Promise<{ id: string }> };

/** Creates a new project from a saved template. */
export const POST = handler(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const t = (await listTemplates()).find((x) => x.id === id);
  if (!t) return json({ error: 'Modèle introuvable' }, 404);
  const p = structuredClone(t.project);
  const now = new Date().toISOString();
  Object.assign(p, { id: uid('p_'), name: `${t.name}`, createdAt: now, updatedAt: now, storyboardValidated: false, generationSeconds: 0, thumbnailAssetId: undefined });
  p.scenes.forEach((s) => (s.id = uid('s_')));
  p.timeline = buildTimeline(p, false);
  await saveProject(p);
  return json(p, 201);
});

export const DELETE = handler(async (_req: Request, { params }: P) => {
  const { id } = await params;
  await saveTemplates((await listTemplates()).filter((t) => t.id !== id));
  return json({ deleted: true });
});
