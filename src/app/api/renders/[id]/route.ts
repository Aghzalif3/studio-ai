import { handler, json } from '@/lib/server/http';
import { deleteRender, listRenders } from '@/lib/server/store';
import { cancelRender, getJob } from '@/lib/server/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const j = getJob(id);
  if (j) return json(j);
  const r = (await listRenders()).find((x) => x.id === id);
  return r ? json({ ...r, progress: r.status === 'done' ? 1 : 0, phase: r.status }) : json({ error: 'Rendu introuvable' }, 404);
});

/** Cancels a running/queued render, or deletes a finished one (and its file). */
export const DELETE = handler(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const j = getJob(id);
  if (j && (j.status === 'queued' || j.status === 'running')) { await cancelRender(id); return json({ cancelled: true }); }
  await deleteRender(id);
  return json({ deleted: true });
});
