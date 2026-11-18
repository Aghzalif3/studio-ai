import fs from 'node:fs';
import path from 'node:path';
import { handler, json } from '@/lib/server/http';
import { addAssetFile, getProject, updateProject } from '@/lib/server/store';
import { assetPath, TMP_DIR } from '@/lib/server/paths';
import { probe } from '@/lib/server/ffmpeg';
import { importVoice } from '@/lib/engines/voice';
import { removeAsset, syncTimeline } from '@/lib/server/production';
import { textHash } from '@/lib/project';
import { uid } from '@/lib/util';
import type { Asset } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const KIND = (mime: string): Asset['kind'] | null => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : null);

/** Upload: form fields file, role (image | video | voice | music | sfx | reference | media), sceneId?, characterId? */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  const form = await req.formData();
  const file = form.get('file');
  const role = String(form.get('role') ?? 'media');
  const sceneId = form.get('sceneId') ? String(form.get('sceneId')) : undefined;
  if (!(file instanceof File)) return json({ error: 'Aucun fichier reçu' }, 400);
  if (file.size > 1024 * 1024 * 1024) return json({ error: 'Fichier trop volumineux (1 Go max).' }, 413);
  let mime = file.type || 'application/octet-stream';
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  if (mime === 'application/octet-stream' && ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) mime = `audio/${ext}`;
  const kind = KIND(mime);
  if (!kind) return json({ error: `Type de fichier non pris en charge : ${mime}` }, 415);
  const buf = Buffer.from(await file.arrayBuffer());

  if (role === 'voice') {
    if (!sceneId) return json({ error: 'Scène manquante' }, 400);
    const scene = p.scenes.find((s) => s.id === sceneId);
    if (!scene) return json({ error: 'Scène introuvable' }, 404);
    const tmp = path.join(TMP_DIR, `${uid('up_')}.${ext}`);
    await fs.promises.writeFile(tmp, buf);
    const r = await importVoice(tmp, scene.narration).finally(() => fs.promises.rm(tmp, { force: true }));
    const asset = await addAssetFile(id, await fs.promises.readFile(r.wavPath), { kind: 'audio', mime: 'audio/wav', name: `Ma voix — ${scene.title}`, source: form.get('recorded') ? 'recording' : 'upload', duration: r.duration, ext: 'wav' });
    await fs.promises.rm(r.wavPath, { force: true });
    return json(await updateProject(id, (pp) => {
      const s = pp.scenes.find((x) => x.id === sceneId)!;
      pp.assets.push(asset);
      if (s.voice) removeAsset(pp, s.voice.assetId);
      s.voice = { assetId: asset.id, duration: r.duration, words: r.words, engine: form.get('recorded') ? 'recording' : 'upload', voice: 'own', textHash: textHash(s.narration) };
      syncTimeline(pp);
    }));
  }

  const asset = await addAssetFile(id, buf, { kind, mime, name: file.name.slice(0, 120), source: 'upload', ext });
  if (kind !== 'image') {
    const meta = await probe(assetPath(id, asset.file)).catch(() => null);
    asset.duration = meta?.duration; asset.width = meta?.width; asset.height = meta?.height;
    if (kind === 'video' && meta && !meta.hasVideo) return json({ error: 'Vidéo illisible' }, 400);
  }
  return json(await updateProject(id, (pp) => {
    pp.assets.push(asset);
    const s = sceneId ? pp.scenes.find((x) => x.id === sceneId) : undefined;
    if (role === 'image' && s) { if (s.imageAssetId) removeAsset(pp, s.imageAssetId); s.imageAssetId = asset.id; }
    if (role === 'video' && s) { if (s.videoAssetId) removeAsset(pp, s.videoAssetId); s.videoAssetId = asset.id; }
    if (role === 'reference') { const c = pp.characters.find((x) => x.id === form.get('characterId')); if (c) c.refAssetId = asset.id; }
    if (role === 'music') {
      const total = pp.timeline.video.reduce((a, c) => Math.max(a, c.start + c.duration), 0);
      pp.timeline.music = [{ id: uid('m_'), assetId: asset.id, label: file.name, start: 0, duration: Math.min(asset.duration ?? total, total || asset.duration || 30), srcIn: 0, gainDb: 0, speed: 1, fadeIn: 0.3, fadeOut: 1.5 }];
      pp.timeline.edited = true;
    }
  }));
});
