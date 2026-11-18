import fs from 'node:fs';
import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { addAssetFile, getProject, updateProject } from '@/lib/server/store';
import { generateVideo } from '@/lib/engines/image';
import { engineById } from '@/lib/engines/catalog';
import { assetPath } from '@/lib/server/paths';
import { probe } from '@/lib/server/ffmpeg';
import { removeAsset } from '@/lib/server/production';

export const runtime = 'nodejs';
export const maxDuration = 900;
const Body = z.object({ engine: z.string(), confirmCost: z.boolean().optional(), remove: z.boolean().optional() });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) => {
  const { id, sceneId } = await params;
  const body = Body.parse(await req.json());
  const p = await getProject(id);
  const scene = p?.scenes.find((s) => s.id === sceneId);
  if (!p || !scene) return json({ error: 'Scène introuvable' }, 404);
  if (body.remove) return json(await updateProject(id, (pp) => { const s = pp.scenes.find((x) => x.id === sceneId)!; if (s.videoAssetId) removeAsset(pp, s.videoAssetId); delete s.videoAssetId; }));
  const info = engineById(body.engine);
  if (!info || info.kind !== 'video' || info.id === 'local-motion') return json({ error: 'Choisissez un moteur vidéo IA (fal.ai ou Replicate). L’animation locale est automatique.' }, 400);
  const img = p.assets.find((a) => a.id === scene.imageAssetId);
  if (!img) return json({ error: 'Générez ou importez d’abord une image pour cette scène : la vidéo IA part de cette image.' }, 400);
  const secs = Math.min(10, Math.max(5, Math.round(scene.duration)));
  const cost = (info.unitCostUsd ?? 0) * secs;
  if (!body.confirmCost) return json({ needsConfirmation: true, costUsd: cost, engine: info.name, note: info.costNote }, 402);
  const t = Date.now();
  const r = await generateVideo(body.engine, { image: { data: await fs.promises.readFile(assetPath(id, img.file)), mime: img.mime }, prompt: `${scene.visual}. ${scene.camera} camera movement`, durationSec: secs, aspect: p.brief.aspect });
  const asset = await addAssetFile(id, r.data, { kind: 'video', mime: 'video/mp4', name: `${scene.title} (vidéo IA)`, source: 'generated', engine: r.model, costUsd: r.costUsd, ext: 'mp4' });
  const meta = await probe(assetPath(id, asset.file)).catch(() => null);
  asset.duration = meta?.duration; asset.width = meta?.width; asset.height = meta?.height;
  return json(await updateProject(id, (pp) => {
    const s = pp.scenes.find((x) => x.id === sceneId)!;
    pp.assets.push(asset);
    if (s.videoAssetId) removeAsset(pp, s.videoAssetId);
    s.videoAssetId = asset.id;
    pp.generationSeconds += (Date.now() - t) / 1000;
  }));
});
