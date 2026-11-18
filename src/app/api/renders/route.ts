import { handler, json } from '@/lib/server/http';
import { listRenders } from '@/lib/server/store';
import { activeJobs, getJob } from '@/lib/server/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Render history merged with live progress of running jobs. */
export const GET = handler(async () => {
  const history = await listRenders();
  const live = new Map(activeJobs().map((j) => [j.id, j]));
  const items = history.map((r) => {
    const j = getJob(r.id);
    // A job marked queued/running in the file but unknown in memory was interrupted by a server restart.
    if ((r.status === 'queued' || r.status === 'running') && !j) return { ...r, status: 'error' as const, error: 'Interrompu (le serveur a redémarré).' };
    return j ? { ...r, ...j } : r;
  });
  return json({ items, active: [...live.values()] });
});
