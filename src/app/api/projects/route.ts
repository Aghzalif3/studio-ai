import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { listProjects, saveProject } from '@/lib/server/store';
import { defaultBrief, newProject, platformDefaults } from '@/lib/project';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const all = await listProjects();
  return json(all.map((p) => ({
    id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, mode: p.brief.mode, styleId: p.brief.styleId, aspect: p.brief.aspect,
    scenes: p.scenes.length, duration: p.timeline.video.reduce((a, c) => Math.max(a, c.start + c.duration), 0), validated: p.storyboardValidated,
    thumbnail: p.scenes.find((s) => s.imageAssetId) ? p.assets.find((a) => a.id === p.scenes.find((s) => s.imageAssetId)!.imageAssetId)?.file : undefined,
    generationSeconds: p.generationSeconds,
  })));
});

const Create = z.object({ name: z.string().max(120).optional(), brief: z.record(z.string(), z.any()).optional() });

export const POST = handler(async (req: Request) => {
  const body = Create.parse(await req.json());
  const s = await getSettings();
  const b = defaultBrief({ quality: s.quality, ...(body.brief ?? {}) } as any);
  if (!body.brief?.aspect) b.aspect = platformDefaults(b.platform).aspect;
  const p = newProject(body.name || b.subject || b.idea.slice(0, 40) || 'Nouveau projet', b);
  p.timeline.fps = s.video.fps;
  p.musicSettings.ducking = s.audio.ducking;
  await saveProject(p);
  return json(p, 201);
});
