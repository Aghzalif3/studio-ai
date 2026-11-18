import { handler, json } from '@/lib/server/http';
import { getProject, updateProject } from '@/lib/server/store';
import { generateSceneVoice, pendingVoiceCost, syncTimeline, voiceIsStale } from '@/lib/server/production';

export const runtime = 'nodejs';
export const maxDuration = 900;
/** Generates every missing or outdated narration. Body {force:true} regenerates all. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const force = !!body?.force;
  let p = await getProject(id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  const cost = pendingVoiceCost(p, { force });
  if (cost > 0 && !body?.confirmCost) return json({ needsConfirmation: true, costUsd: cost }, 402);
  const errors: string[] = [];
  for (const s of p.scenes) {
    if (!s.narration.trim() || p.brief.narration === 'none') continue;
    if (!force && !voiceIsStale(p, s)) continue;
    try { p = await generateSceneVoice(id, s.id); } catch (e: any) { errors.push(`${s.title} : ${e.message}`); break; }
  }
  p = await updateProject(id, (pp) => syncTimeline(pp));
  return json({ project: p, errors });
});
