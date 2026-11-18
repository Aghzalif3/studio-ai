// Audio mix with FFmpeg: voice (compressed) + music (ducked under the voice) + SFX, then two-pass loudnorm.
// Mixing targets follow the approach documented in Lemo-Opuscar TECHNIQUE.md (voice ≈ 10 dB over music,
// −14 LUFS, true peak ≤ −1 dBTP); the implementation is Studio AI's own.
import path from 'node:path';
import type { AudioClip, Project } from '../types';
import fs from 'node:fs';
import { ffmpeg, run, FFMPEG } from './ffmpeg';
import { resolveAssetFile } from './media';

export interface MixOptions { duration: number; voiceGainDb: number; musicGainDb: number; sfxGainDb: number; ducking: boolean; lufs: number; out: string }

function atempoChain(speed: number) {
  const f: string[] = []; let s = speed;
  while (s > 2) { f.push('atempo=2'); s /= 2; }
  while (s < 0.5) { f.push('atempo=0.5'); s /= 0.5; }
  if (Math.abs(s - 1) > 1e-3) f.push(`atempo=${s.toFixed(4)}`);
  return f;
}

export async function mixProject(p: Project, o: MixOptions) {
  const inputs: string[] = [];
  const chains: string[] = [];
  const buses: Record<'voice' | 'music' | 'sfx', string[]> = { voice: [], music: [], sfx: [] };
  let idx = 0;
  const addClip = async (c: AudioClip, bus: keyof typeof buses, busGain: number) => {
    const file = await resolveAssetFile(p, c.assetId);
    if (!file || c.start >= o.duration || c.duration <= 0) return;
    inputs.push('-i', file);
    const len = Math.min(c.duration, o.duration - c.start);
    const f = [
      `atrim=start=${c.srcIn.toFixed(3)}:duration=${(len * (c.speed || 1)).toFixed(3)}`, 'asetpts=PTS-STARTPTS',
      ...atempoChain(c.speed || 1),
      'aformat=sample_rates=48000:channel_layouts=stereo',
      `volume=${(c.gainDb + busGain).toFixed(2)}dB`,
    ];
    if (c.fadeIn > 0) f.push(`afade=t=in:st=0:d=${c.fadeIn.toFixed(3)}`);
    if (c.fadeOut > 0) f.push(`afade=t=out:st=${Math.max(0, len - c.fadeOut).toFixed(3)}:d=${c.fadeOut.toFixed(3)}`);
    const ms = Math.max(0, Math.round(c.start * 1000));
    f.push(`adelay=${ms}|${ms}`);
    const label = `a${idx}`;
    chains.push(`[${idx}:a]${f.join(',')}[${label}]`);
    buses[bus].push(`[${label}]`);
    idx++;
  };
  for (const c of p.timeline.voice) await addClip(c, 'voice', o.voiceGainDb);
  for (const c of p.timeline.music) await addClip(c, 'music', o.musicGainDb);
  for (const c of p.timeline.sfx) await addClip(c, 'sfx', o.sfxGainDb);

  const D = o.duration.toFixed(3);
  // silent base so the mix always has the exact length
  chains.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${D}[base]`);
  const busOut: string[] = ['[base]'];
  const mixBus = (name: string, list: string[], extra = '') => {
    if (!list.length) return null;
    const out = `[${name}]`;
    chains.push(`${list.join('')}amix=inputs=${list.length}:normalize=0:dropout_transition=0${extra}${out}`);
    return out;
  };
  const voice = mixBus('voicebus', buses.voice, ',acompressor=threshold=-20dB:ratio=3.5:attack=8:release=120:makeup=4dB');
  const music = mixBus('musicbus', buses.music);
  const sfx = mixBus('sfxbus', buses.sfx);
  if (voice && music && o.ducking) {
    chains.push(`${voice}asplit=2[vmain][vkey]`);
    chains.push(`${music}[vkey]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450:makeup=1[ducked]`);
    busOut.push('[vmain]', '[ducked]');
  } else { if (voice) busOut.push(voice); if (music) busOut.push(music); }
  if (sfx) busOut.push(sfx);
  chains.push(`${busOut.join('')}amix=inputs=${busOut.length}:normalize=0:duration=first,atrim=duration=${D}[premaster]`);

  const pre = o.out.replace(/\.wav$/, '.pre.wav');
  await ffmpeg([...inputs, '-filter_complex', chains.join(';'), '-map', '[premaster]', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', pre]);
  // Two-pass loudnorm
  const silent = idx === 0;
  if (silent) { await fs.promises.rename(pre, o.out); return o.out; }
  const r = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', pre, '-af', `loudnorm=I=${o.lufs}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const mm = r.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  const measured = mm ? JSON.parse(mm[0]) : null;
  const ln = measured && Number.isFinite(parseFloat(measured.input_i))
    ? `loudnorm=I=${o.lufs}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
    : `loudnorm=I=${o.lufs}:TP=-1.5:LRA=11`;
  await ffmpeg(['-i', pre, '-af', `${ln},alimiter=limit=0.89:level=false,aresample=48000`, '-ac', '2', '-c:a', 'pcm_s16le', o.out]);
  await fs.promises.rm(pre, { force: true });
  return o.out;
}

export const mixPath = (dir: string, id: string) => path.join(dir, `${id}.mix.wav`);
