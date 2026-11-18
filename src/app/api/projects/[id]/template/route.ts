import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { getProject, listTemplates, saveTemplates } from '@/lib/server/store';
import { uid } from '@/lib/util';

export const runtime = 'nodejs';
const Body = z.object({ name: z.string().min(1).max(80), description: z.string().max(300).optional() });

/** Saves the project's structure (brief, scenes, captions, voice & music settings) as a reusable template, without media. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const body = Body.parse(await req.json());
  const p = await getProject((await params).id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  const clean = structuredClone(p);
  clean.assets = []; clean.scenes.forEach((s) => { delete s.imageAssetId; delete s.videoAssetId; delete s.voice; });
  clean.characters.forEach((c) => delete c.refAssetId);
  clean.timeline = { ...clean.timeline, voice: [], music: [], video: [], captions: [], sfx: clean.timeline.sfx.filter((s) => s.assetId.startsWith('lib:')), edited: false };
  const all = await listTemplates();
  const t = { id: uid('t_'), name: body.name, description: body.description ?? '', createdAt: new Date().toISOString(), project: clean };
  await saveTemplates([t, ...all]);
  return json(t, 201);
});
