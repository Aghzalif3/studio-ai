import { handler, json } from '@/lib/server/http';
import { generateSceneVoice, pendingVoiceCost } from '@/lib/server/production';
import { getProject } from '@/lib/server/store';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) => {
  const { id, sceneId } = await params;
  const body = await req.json().catch(() => ({}));
  const p = await getProject(id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  const cost = pendingVoiceCost(p, { sceneId });
  if (cost > 0 && !body?.confirmCost) return json({ needsConfirmation: true, costUsd: cost }, 402);
  return json(await generateSceneVoice(id, sceneId));
});
