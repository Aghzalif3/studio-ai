import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { getProject, listCustomStyles, updateProject } from '@/lib/server/store';
import { generateScript } from '@/lib/engines/text';
import { normalizeScenes } from '@/lib/engines/script-shared';
import { resolveStyle } from '@/lib/styles/registry';
import { buildTimeline } from '@/lib/project';
import { uid } from '@/lib/util';
import { estimateCost } from '@/lib/engines/catalog';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const maxDuration = 300;
const Body = z.object({ engine: z.string(), confirmCost: z.boolean().optional() });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { engine, confirmCost } = Body.parse(await req.json());
  const settings = await getSettings();
  // Groq / OpenRouter / Mistral free tiers are not billed; OpenAI and Anthropic are.
  const billed = engine === 'anthropic' || (engine === 'openai-compat' && settings.textModels.openaiCompat.provider === 'openai');
  const cost = billed ? estimateCost(engine, 1) : 0;
  if (cost > 0 && !confirmCost) return json({ needsConfirmation: true, costUsd: cost }, 402);
  const p0 = await getProject(id);
  if (!p0) return json({ error: 'Projet introuvable' }, 404);
  if (!p0.brief.idea.trim() && !p0.brief.subject.trim()) return json({ error: 'Décrivez votre idée avant de générer le scénario.' }, 400);
  const style = resolveStyle(p0.brief.styleId, await listCustomStyles());
  const t = Date.now();
  const raw = await generateScript(engine, p0.brief, style.name.fr);
  const scenes = normalizeScenes(raw, p0.brief);
  const p = await updateProject(id, (p) => {
    p.scenes = scenes;
    p.characters = (raw.characters ?? []).slice(0, 6).map((c) => ({ id: uid('ch_'), name: String(c.name).slice(0, 60), description: String(c.description).slice(0, 400) }));
    if (raw.title && /^Nouveau projet|^Projet sans titre/.test(p.name)) p.name = String(raw.title).slice(0, 80);
    p.storyboardValidated = false;
    p.scriptEngine = engine;
    p.timeline.edited = false;
    p.timeline = buildTimeline(p, true);
    p.generationSeconds += (Date.now() - t) / 1000;
  });
  return json(p);
});
