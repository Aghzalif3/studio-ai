// Production helpers: voices, music, images for a project (server-side, mutates and saves the project).
import { engineById, estimateCost } from '../engines/catalog';
import fs from 'node:fs';
import type { Asset, Project, Scene } from '../types';
import { buildTimeline, rebuildCaptions, textHash } from '../project';
import { timelineDuration } from '../render/compose';
import { synthesize } from '../engines/voice';
import { musicWav } from '../audio/music';
import { addAssetFile, updateProject } from './store';
import { uid } from '../util';

export function voiceIsStale(p: Project, s: Scene) {
  if (!s.narration.trim() || p.brief.narration === 'none') return false;
  if (!s.voice) return true;
  if (s.voice.engine === 'upload' || s.voice.engine === 'recording') return false;
  return s.voice.textHash !== textHash(s.narration) || s.voice.engine !== p.voiceSettings.engine || s.voice.voice !== p.voiceSettings.voice;
}

export { syncTimeline } from '../project';
import { syncTimeline } from '../project';

export async function generateSceneVoice(projectId: string, sceneId: string): Promise<Project> {
  const { getProject } = await import('./store');
  const p0 = await getProject(projectId);
  if (!p0) throw new Error('Projet introuvable');
  const s0 = p0.scenes.find((s) => s.id === sceneId);
  if (!s0) throw new Error('Scène introuvable');
  const t = Date.now();
  const r = await synthesize({ engine: p0.voiceSettings.engine, voice: p0.voiceSettings.voice, text: s0.narration, rate: p0.voiceSettings.rate, pitch: p0.voiceSettings.pitch, lang: p0.brief.language });
  const asset = await addAssetFile(projectId, await fs.promises.readFile(r.wavPath), { kind: 'audio', mime: 'audio/wav', name: `Voix — ${s0.title}`, source: 'tts', engine: p0.voiceSettings.engine, duration: r.duration, costUsd: r.costUsd, ext: 'wav' });
  await fs.promises.rm(r.wavPath, { force: true });
  return updateProject(projectId, (p) => {
    const s = p.scenes.find((x) => x.id === sceneId);
    if (!s) return;
    const old = s.voice?.assetId;
    p.assets.push(asset);
    s.voice = { assetId: asset.id, duration: r.duration, words: r.words, engine: p.voiceSettings.engine, voice: p.voiceSettings.voice, textHash: textHash(s.narration) };
    if (old && !p.timeline.voice.some((v) => v.assetId === old && v.sceneId !== sceneId)) removeAsset(p, old);
    p.generationSeconds += (Date.now() - t) / 1000;
    syncTimeline(p);
  });
}

export function removeAsset(p: Project, assetId: string) {
  const a = p.assets.find((x) => x.id === assetId);
  if (!a) return;
  p.assets = p.assets.filter((x) => x.id !== assetId);
  import('./paths').then(({ assetPath }) => fs.promises.rm(assetPath(p.id, a.file), { force: true })).catch(() => {});
}

export async function ensureMusic(projectId: string, force = false): Promise<Project> {
  const { getProject } = await import('./store');
  const p0 = await getProject(projectId);
  if (!p0) throw new Error('Projet introuvable');
  const mood = p0.musicSettings.mood;
  const total = timelineDuration(p0);
  const cur = p0.timeline.music[0];
  const curAsset = cur ? p0.assets.find((a) => a.id === cur.assetId) : undefined;
  if (mood === 'none') return updateProject(projectId, (p) => { p.timeline.music = p.timeline.music.filter((m) => p.assets.find((a) => a.id === m.assetId)?.source !== 'synth'); });
  if (!force && cur && (curAsset?.source !== 'synth' || (Math.abs((curAsset.duration ?? 0) - total) < 0.5 && curAsset.prompt === mood))) return p0;
  const t = Date.now();
  const wav = musicWav({ mood, duration: total, seed: p0.musicSettings.seed });
  const asset: Asset = await addAssetFile(projectId, wav, { kind: 'audio', mime: 'audio/wav', name: `Musique — ${mood}`, source: 'synth', engine: 'studio-synth', prompt: mood, duration: total, ext: 'wav' });
  return updateProject(projectId, (p) => {
    p.assets.push(asset);
    const old = p.timeline.music.filter((m) => p.assets.find((a) => a.id === m.assetId)?.source === 'synth');
    p.timeline.music = p.timeline.music.filter((m) => !old.includes(m));
    old.forEach((m) => removeAsset(p, m.assetId));
    p.timeline.music.unshift({ id: uid('m_'), assetId: asset.id, label: `Musique ${mood}`, start: 0, duration: total, srcIn: 0, gainDb: 0, speed: 1, fadeIn: 0.3, fadeOut: 1.5 });
    p.generationSeconds += (Date.now() - t) / 1000;
  });
}

/** Everything a render needs: voices for every scene with narration, then music sized to the final length. */
export async function prepareForRender(projectId: string, onStep?: (msg: string) => void) {
  const { getProject } = await import('./store');
  let p = (await getProject(projectId))!;
  for (const s of p.scenes) {
    if (voiceIsStale(p, s)) { onStep?.(`Voix : ${s.title}`); p = await generateSceneVoice(projectId, s.id); }
  }
  p = await updateProject(projectId, (pp) => syncTimeline(pp));
  onStep?.('Musique');
  return ensureMusic(projectId);
}

/** Estimated cost of the narrations that still need to be synthesised (0 for free engines). */
export function pendingVoiceCost(p: Project, opts: { force?: boolean; sceneId?: string } = {}) {
  const info = engineById(p.voiceSettings.engine);
  if (!info || info.tier !== 'paid' || p.brief.narration === 'none') return 0;
  const chars = p.scenes
    .filter((s) => (opts.sceneId ? s.id === opts.sceneId : true) && s.narration.trim() && (opts.force || opts.sceneId || voiceIsStale(p, s)))
    .reduce((a, s) => a + s.narration.length, 0);
  return estimateCost(info.id, chars / 1000);
}
