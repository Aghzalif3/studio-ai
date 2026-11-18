import fs from 'node:fs';
import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { addAssetFile, getProject, listCustomStyles, updateProject } from '@/lib/server/store';
import { generateImage } from '@/lib/engines/image';
import { engineById } from '@/lib/engines/catalog';
import { resolveStyle } from '@/lib/styles/registry';
import { ASPECT_SIZES } from '@/lib/types';
import { assetPath } from '@/lib/server/paths';
import { removeAsset } from '@/lib/server/production';
import { strHash } from '@/lib/util';

export const runtime = 'nodejs';
export const maxDuration = 600;
const Body = z.object({ engine: z.string(), confirmCost: z.boolean().optional(), seed: z.number().optional(), useReference: z.boolean().optional() });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) => {
  const { id, sceneId } = await params;
  const body = Body.parse(await req.json());
  const p = await getProject(id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  const scene = p.scenes.find((s) => s.id === sceneId);
  if (!scene) return json({ error: 'Scène introuvable' }, 404);
  const info = engineById(body.engine);
  if (!info || info.kind !== 'image') return json({ error: 'Moteur d’image inconnu' }, 400);
  if (body.engine === 'procedural') {
    const updated = await updateProject(id, (pp) => { const s = pp.scenes.find((x) => x.id === sceneId)!; if (s.imageAssetId) removeAsset(pp, s.imageAssetId); delete s.imageAssetId; });
    return json(updated);
  }
  const ref = body.useReference !== false ? p.characters.find((c) => c.refAssetId) : undefined;
  const cost = ref && (body.engine === 'fal' || body.engine === 'replicate') ? 0.04 : info.unitCostUsd ?? 0;
  if (info.tier === 'paid' && !body.confirmCost) return json({ needsConfirmation: true, costUsd: cost, engine: info.name, note: info.costNote }, 402);
  const style = resolveStyle(p.brief.styleId, await listCustomStyles());
  const chars = p.characters.filter((c) => c.description).map((c) => `${c.name}: ${c.description}`).join('; ');
  const prompt = [scene.visual || scene.onScreenText || scene.narration, chars && `Characters (keep consistent): ${chars}`, style.prompt, 'no text, no watermark'].filter(Boolean).join('. ');
  const [w, h] = ASPECT_SIZES[p.brief.aspect]['1080p'];
  const refAsset = ref ? p.assets.find((a) => a.id === ref.refAssetId) : undefined;
  const reference = refAsset ? { data: await fs.promises.readFile(assetPath(id, refAsset.file)), mime: refAsset.mime } : undefined;
  const t = Date.now();
  const r = await generateImage(body.engine, { prompt, negative: style.negative, width: w, height: h, seed: body.seed ?? strHash(scene.id + Date.now()), reference });
  const asset = await addAssetFile(id, r.data, { kind: 'image', mime: r.mime, name: scene.title, source: 'generated', engine: r.model, prompt, costUsd: r.costUsd, ext: r.ext });
  const updated = await updateProject(id, (pp) => {
    const s = pp.scenes.find((x) => x.id === sceneId);
    if (!s) return;
    pp.assets.push(asset);
    if (s.imageAssetId && !pp.timeline.video.some((c) => c.assetId === s.imageAssetId)) removeAsset(pp, s.imageAssetId);
    s.imageAssetId = asset.id;
    pp.generationSeconds += (Date.now() - t) / 1000;
  });
  return json(updated);
});
