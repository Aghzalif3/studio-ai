import { handler, json, sendFile } from '@/lib/server/http';
import { getProject, updateProject } from '@/lib/server/store';
import { assetPath } from '@/lib/server/paths';
import { removeAsset } from '@/lib/server/production';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string; assetId: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  const p = await getProject(id);
  const a = p?.assets.find((x) => x.id === assetId);
  if (!p || !a) return json({ error: 'Fichier introuvable' }, 404);
  const dl = new URL(req.url).searchParams.has('download');
  return sendFile(req, assetPath(id, a.file), a.mime, dl ? a.name : undefined);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  return json(await updateProject(id, (p) => {
    for (const s of p.scenes) {
      if (s.imageAssetId === assetId) delete s.imageAssetId;
      if (s.videoAssetId === assetId) delete s.videoAssetId;
      if (s.voice?.assetId === assetId) delete s.voice;
    }
    for (const c of p.characters) if (c.refAssetId === assetId) delete c.refAssetId;
    p.timeline.video.forEach((c) => { if (c.assetId === assetId) delete c.assetId; });
    p.timeline.voice = p.timeline.voice.filter((c) => c.assetId !== assetId);
    p.timeline.music = p.timeline.music.filter((c) => c.assetId !== assetId);
    p.timeline.sfx = p.timeline.sfx.filter((c) => c.assetId !== assetId);
    removeAsset(p, assetId);
  }));
});
