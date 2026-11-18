import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { enqueueRender } from '@/lib/server/jobs';
import { getProject } from '@/lib/server/store';
import { pendingVoiceCost } from '@/lib/server/production';

export const runtime = 'nodejs';
const Body = z.object({ resolution: z.enum(['720p', '1080p', '4k']), fps: z.union([z.literal(24), z.literal(30), z.literal(60)]), quality: z.enum(['draft', 'standard', 'high']).optional(), confirmCost: z.boolean().optional() });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  const p = await getProject(id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  // The render synthesises missing narrations first: with a paid voice engine, ask before.
  const cost = pendingVoiceCost(p);
  if (cost > 0 && !body.confirmCost) return json({ needsConfirmation: true, costUsd: cost }, 402);
  return json(await enqueueRender(id, body), 202);
});
