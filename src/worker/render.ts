// Render worker, run as a child process: node --import tsx src/worker/render.ts <job.json>
// Prints one JSON object per line on stdout: {type:'progress'|'done'|'error', ...}.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import type { Project } from '../lib/types';
import type { StyleDef } from '../lib/styles/types';
import { nodeEnv } from '../lib/server/node-render';
import { renderFrame, timelineDuration } from '../lib/render/compose';
import { mixProject } from '../lib/server/mix';
import { FFMPEG, ffmpeg } from '../lib/server/ffmpeg';
import { assetPath } from '../lib/server/paths';

export interface RenderJob {
  renderId: string; project: Project; style: StyleDef; width: number; height: number; fps: number;
  quality: 'draft' | 'standard' | 'high'; out: string; tmpDir: string;
  audio: { voiceGainDb: number; musicGainDb: number; sfxGainDb: number; ducking: boolean; lufs: number };
  range?: [number, number];
}

const emit = (o: object) => process.stdout.write(JSON.stringify(o) + '\n');

async function main() {
  const job: RenderJob = JSON.parse(await fs.promises.readFile(process.argv[2], 'utf8'));
  const { project: p, style, width: W, height: H, fps } = job;
  await fs.promises.mkdir(job.tmpDir, { recursive: true });
  const t0 = Date.now();
  const full = timelineDuration(p);
  const [from, to] = job.range ?? [0, full];
  const duration = Math.max(0.1, to - from);
  const totalFrames = Math.max(1, Math.round(duration * fps));

  // 1. Audio
  emit({ type: 'progress', phase: 'audio', progress: 0.01 });
  const mixFile = path.join(job.tmpDir, 'mix.wav');
  await mixProject(p, { duration: full, ...job.audio, lufs: job.audio.lufs, out: mixFile });

  // 2. Media
  emit({ type: 'progress', phase: 'media', progress: 0.03 });
  const images = new Map<string, Image>();
  const usedIds = new Set<string>();
  for (const c of p.timeline.video) { if (c.assetId) usedIds.add(c.assetId); const s = p.scenes.find((x) => x.id === c.sceneId); if (s?.imageAssetId) usedIds.add(s.imageAssetId); if (s?.videoAssetId) usedIds.add(s.videoAssetId); }
  const videoFrames = new Map<string, { dir: string; count: number; cache: Map<number, Image> }>();
  for (const id of usedIds) {
    const a = p.assets.find((x) => x.id === id);
    if (!a) continue;
    const file = assetPath(p.id, a.file);
    if (!fs.existsSync(file)) continue;
    if (a.kind === 'image') images.set(id, await loadImage(await fs.promises.readFile(file)));
    if (a.kind === 'video') {
      const dir = path.join(job.tmpDir, `v_${id}`);
      await fs.promises.mkdir(dir, { recursive: true });
      const maxSide = Math.max(W, H);
      await ffmpeg(['-i', file, '-vf', `fps=${fps},scale='if(gt(iw,ih),${maxSide},-2)':'if(gt(iw,ih),-2,${maxSide})'`, '-q:v', '3', path.join(dir, '%06d.jpg')]);
      const count = (await fs.promises.readdir(dir)).length;
      videoFrames.set(id, { dir, count, cache: new Map() });
    }
  }
  let logo: Image | null = null;
  if (style.logo?.startsWith('data:')) logo = await loadImage(Buffer.from(style.logo.split(',')[1], 'base64')).catch(() => null);

  const pending = new Map<string, Image>();
  const frameKey = (id: string, time: number) => { const v = videoFrames.get(id)!; return Math.min(v.count, Math.max(1, Math.floor(time * fps) + 1)); };
  const env = nodeEnv((id, time) => {
    if (images.has(id)) return images.get(id)!;
    const v = videoFrames.get(id);
    if (v) return v.cache.get(frameKey(id, time)) ?? null;
    return null;
  }, logo);
  async function preloadVideo(t: number) {
    for (const c of p.timeline.video) {
      if (t < c.start - 1 || t > c.start + c.duration + 1) continue;
      const s = p.scenes.find((x) => x.id === c.sceneId);
      const id = c.assetId ?? s?.videoAssetId;
      if (!id || !videoFrames.has(id)) continue;
      const v = videoFrames.get(id)!;
      const k = frameKey(id, c.srcIn + Math.max(0, t - c.start) * (c.speed || 1));
      if (!v.cache.has(k)) {
        v.cache.set(k, await loadImage(await fs.promises.readFile(path.join(v.dir, String(k).padStart(6, '0') + '.jpg'))));
        if (v.cache.size > 90) v.cache.delete(v.cache.keys().next().value!);
      }
    }
    void pending;
  }

  // 3. Encode
  const crf = job.quality === 'high' ? 17 : job.quality === 'draft' ? 26 : 20;
  const preset = job.quality === 'high' ? 'slow' : job.quality === 'draft' ? 'veryfast' : 'medium';
  const enc = spawn(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-ss', from.toFixed(3), '-t', duration.toFixed(3), '-i', mixFile,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    ...(W * H > 1920 * 1080 ? ['-level', '5.1'] : []),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', job.out,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encErr = '';
  enc.stderr.on('data', (d) => (encErr += d.toString()));
  const encDone = new Promise<void>((res, rej) => enc.on('close', (code) => (code === 0 ? res() : rej(new Error(`Encodage FFmpeg échoué : ${encErr.slice(-500)}`)))));
  enc.stdin.on('error', () => {});

  const canvas = createCanvas(W, H);
  const g = canvas.getContext('2d') as any;
  const input = { project: p, style, w: W, h: H, sceneMap: new Map(p.scenes.map((s) => [s.id, s])) };
  let lastEmit = 0;
  for (let f = 0; f < totalFrames; f++) {
    const t = from + f / fps;
    if (videoFrames.size) await preloadVideo(t);
    renderFrame(env, g, input, t, f);
    const data = canvas.data();
    if (!enc.stdin.write(data)) await new Promise((r) => enc.stdin.once('drain', r));
    const now = Date.now();
    if (now - lastEmit > 400 || f === totalFrames - 1) {
      lastEmit = now;
      const elapsed = (now - t0) / 1000, done = (f + 1) / totalFrames;
      emit({ type: 'progress', phase: 'frames', frame: f + 1, totalFrames, progress: 0.05 + 0.93 * done, fps: (f + 1) / elapsed, etaSec: (elapsed / done) * (1 - done) });
    }
  }
  enc.stdin.end();
  await encDone;
  const size = (await fs.promises.stat(job.out)).size;
  await fs.promises.rm(job.tmpDir, { recursive: true, force: true });
  emit({ type: 'done', sizeBytes: size, durationSec: duration, elapsedSec: (Date.now() - t0) / 1000 });
}

main().catch((e) => { emit({ type: 'error', message: e?.message ?? String(e) }); process.exit(1); });
