import fs from 'node:fs';
import { handler, json } from '@/lib/server/http';
import { deleteProject, getProject, updateProject } from '@/lib/server/store';
import type { Project } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const p = await getProject((await params).id);
  return p ? json(p) : json({ error: 'Projet introuvable' }, 404);
});

/** Autosave. The server stays authoritative for assets and generated voices (background jobs may have added some). */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const incoming = (await req.json()) as Project;
  if (incoming.id !== id) return json({ error: 'Identifiant incohérent' }, 400);
  const saved = await updateProject(id, (p) => {
    const serverVoices = new Map(p.scenes.map((s) => [s.id, s.voice]));
    const assetIds = new Set(p.assets.map((a) => a.id));
    const keepAssets = p.assets;
    Object.assign(p, incoming, { id, createdAt: p.createdAt, assets: keepAssets, generationSeconds: Math.max(p.generationSeconds, incoming.generationSeconds ?? 0) });
    for (const s of p.scenes) {
      const sv = serverVoices.get(s.id);
      if (sv && (!s.voice || !assetIds.has(s.voice.assetId))) s.voice = sv;
      if (s.voice && !assetIds.has(s.voice.assetId)) delete s.voice;
      if (s.imageAssetId && !assetIds.has(s.imageAssetId)) delete s.imageAssetId;
      if (s.videoAssetId && !assetIds.has(s.videoAssetId)) delete s.videoAssetId;
    }
    const valid = (aid: string) => aid.startsWith('lib:') || assetIds.has(aid);
    p.timeline.voice = p.timeline.voice.filter((c) => valid(c.assetId));
    p.timeline.music = p.timeline.music.filter((c) => valid(c.assetId));
    p.timeline.sfx = p.timeline.sfx.filter((c) => valid(c.assetId));
  });
  return json({ ok: true, updatedAt: saved.updatedAt, assets: saved.assets });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await deleteProject((await params).id);
  return json({ ok: true });
});
void fs;
