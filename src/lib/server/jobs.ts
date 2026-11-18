// Render job queue: one render at a time in a child process, progress kept in memory, history in renders.json.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { RenderRecord } from '../types';
import { ASPECT_SIZES } from '../types';
import { RENDERS_DIR, TMP_DIR } from './paths';
import { getProject, listCustomStyles, upsertRender } from './store';
import { getSettings } from './settings';
import { prepareForRender } from './production';
import { resolveStyle } from '../styles/registry';
import { uid } from '../util';

export interface JobState extends RenderRecord { progress: number; phase: string; etaSec?: number; fpsRender?: number; frame?: number; totalFrames?: number }

const G = globalThis as unknown as { __studioJobs?: { jobs: Map<string, JobState>; procs: Map<string, ChildProcess>; queue: string[]; running: boolean } };
const S = (G.__studioJobs ??= { jobs: new Map(), procs: new Map(), queue: [] as string[], running: false });

export function getJob(id: string) { return S.jobs.get(id) ?? null; }
export function activeJobs() { return [...S.jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running'); }

export async function enqueueRender(projectId: string, opts: { resolution: '720p' | '1080p' | '4k'; fps: number; quality?: 'draft' | 'standard' | 'high' }) {
  const p = await getProject(projectId);
  if (!p) throw new Error('Projet introuvable');
  if (!p.scenes.length && !p.timeline.video.length) throw new Error('Le projet ne contient aucune scène.');
  if (p.brief.validateStoryboard && !p.storyboardValidated) throw new Error('Validez d’abord le storyboard (mode validation activé).');
  const [width, height] = ASPECT_SIZES[p.brief.aspect][opts.resolution];
  const id = uid('r_');
  const job: JobState = {
    id, projectId, projectName: p.name, status: 'queued', resolution: opts.resolution, fps: opts.fps, aspect: p.brief.aspect,
    width, height, createdAt: new Date().toISOString(), progress: 0, phase: 'queued',
  };
  S.jobs.set(id, job);
  await upsertRender(strip(job));
  S.queue.push(id);
  void pump(opts.quality ?? p.brief.quality);
  return job;
}

function strip(j: JobState): RenderRecord {
  const { progress: _p, phase: _ph, etaSec: _e, fpsRender: _f, frame: _fr, totalFrames: _t, ...rec } = j;
  return rec;
}

async function pump(quality: 'draft' | 'standard' | 'high') {
  if (S.running) return;
  const id = S.queue.shift();
  if (!id) return;
  const job = S.jobs.get(id)!;
  if (job.status === 'cancelled') return pump(quality);
  S.running = true;
  job.status = 'running';
  try {
    job.phase = 'prepare';
    const p = await prepareForRender(job.projectId, (msg) => { job.phase = `prepare:${msg}`; });
    if (job.status !== 'running') throw new Error('Annulé');
    const settings = await getSettings();
    const style = resolveStyle(p.brief.styleId, await listCustomStyles());
    const file = `${p.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'video'}-${job.resolution}-${id}.mp4`.replace(/^-/, '');
    const tmpDir = path.join(TMP_DIR, id);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const jobFile = path.join(tmpDir, 'job.json');
    await fs.promises.writeFile(jobFile, JSON.stringify({
      renderId: id, project: p, style, width: job.width, height: job.height, fps: job.fps, quality, out: path.join(RENDERS_DIR, file), tmpDir: path.join(tmpDir, 'work'),
      audio: { voiceGainDb: settings.audio.voiceGainDb, musicGainDb: settings.audio.musicGainDb + p.musicSettings.gainDb + 16, sfxGainDb: settings.audio.sfxGainDb, ducking: p.musicSettings.ducking && settings.audio.ducking, lufs: settings.audio.loudnessLufs },
    }));
    job.file = file;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), 'src', 'worker', 'render.ts'), jobFile], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_OPTIONS: '' } });
      S.procs.set(id, child);
      let err = '';
      child.stderr.on('data', (d) => (err += d.toString()).slice(-4000));
      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        try {
          const m = JSON.parse(line);
          if (m.type === 'progress') Object.assign(job, { progress: m.progress, phase: m.phase, etaSec: m.etaSec, fpsRender: m.fps, frame: m.frame, totalFrames: m.totalFrames });
          if (m.type === 'done') Object.assign(job, { sizeBytes: m.sizeBytes, durationSec: m.durationSec, elapsedSec: m.elapsedSec });
          if (m.type === 'error') err = m.message;
        } catch { /* not JSON */ }
      });
      child.on('close', (code) => { S.procs.delete(id); code === 0 ? resolve() : reject(new Error(job.status === 'cancelled' ? 'Annulé' : err.trim() || `Le rendu s’est arrêté (code ${code}).`)); });
    });
    job.status = 'done'; job.progress = 1; job.phase = 'done'; job.finishedAt = new Date().toISOString();
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  } catch (e: any) {
    if (job.status !== 'cancelled') { job.status = 'error'; job.error = e?.message ?? String(e); }
    job.finishedAt = new Date().toISOString();
    await fs.promises.rm(path.join(TMP_DIR, id), { recursive: true, force: true }).catch(() => {});
    if (job.file && job.status !== 'done') await fs.promises.rm(path.join(RENDERS_DIR, job.file), { force: true }).catch(() => {});
  } finally {
    await upsertRender(strip(job));
    S.running = false;
    void pump(quality);
  }
}

export async function cancelRender(id: string) {
  const job = S.jobs.get(id);
  if (!job) return false;
  job.status = 'cancelled';
  S.queue = S.queue.filter((x) => x !== id);
  S.procs.get(id)?.kill('SIGTERM');
  await upsertRender(strip(job));
  return true;
}
