// FFmpeg / FFprobe helpers. Uses the system ffmpeg if FFMPEG_PATH is set, else the bundled ffmpeg-static binary.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const req = createRequire(import.meta.url);
const exe = (p: string | null | undefined): p is string => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };

/**
 * Finds a working binary. Order: environment variable, the npm package (ffmpeg-static / ffprobe-static) resolved
 * normally, the same package looked up from the project folder (the Next.js dev server can break the normal
 * resolution), then Homebrew / system locations, then the PATH.
 */
function resolveBin(envName: 'FFMPEG_PATH' | 'FFPROBE_PATH'): string {
  const fromEnv = process.env[envName];
  if (exe(fromEnv)) return fromEnv;
  const name = envName === 'FFMPEG_PATH' ? 'ffmpeg' : 'ffprobe';
  const winExt = process.platform === 'win32' ? '.exe' : '';
  const nm = path.join(process.cwd(), 'node_modules');
  const candidates: (string | null)[] = [];
  try {
    const m = req(name === 'ffmpeg' ? 'ffmpeg-static' : 'ffprobe-static');
    candidates.push(name === 'ffmpeg' ? (typeof m === 'string' ? m : m?.default ?? null) : m?.path ?? null);
  } catch { /* not resolvable here */ }
  if (name === 'ffmpeg') candidates.push(path.join(nm, 'ffmpeg-static', `ffmpeg${winExt}`));
  else for (const arch of [process.arch, 'x64']) candidates.push(path.join(nm, 'ffprobe-static', 'bin', process.platform, arch, `ffprobe${winExt}`));
  candidates.push(`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`);
  return candidates.find(exe) ?? name;
}
export const FFMPEG = resolveBin('FFMPEG_PATH');
export const FFPROBE = resolveBin('FFPROBE_PATH');

export function run(bin: string, args: string[], opts: { input?: Buffer; onStderr?: (s: string) => void; signal?: AbortSignal } = {}): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], signal: opts.signal });
    const out: Buffer[] = []; let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => { const s = d.toString(); err += s; if (err.length > 200_000) err = err.slice(-100_000); opts.onStderr?.(s); });
    p.on('error', (e: any) => reject(e?.code === 'ENOENT' ? new Error(`${bin} introuvable. Lancez « npm install » ou installez FFmpeg.`) : e));
    p.on('close', (code) => (code === 0 ? resolve({ stdout: Buffer.concat(out), stderr: err }) : reject(new Error(`${bin.split('/').pop()} a échoué (code ${code}) : ${err.split('\n').filter(Boolean).slice(-4).join(' | ')}`))));
    if (opts.input) p.stdin.end(opts.input); else p.stdin.end();
  });
}

export const ffmpeg = (args: string[], opts?: Parameters<typeof run>[2]) => run(FFMPEG, ['-hide_banner', '-y', '-loglevel', 'error', ...args], opts);

export interface ProbeInfo { duration: number; width?: number; height?: number; hasAudio: boolean; hasVideo: boolean }

export async function probe(file: string): Promise<ProbeInfo> {
  try {
    const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file]);
    const j = JSON.parse(stdout.toString());
    const v = j.streams?.find((s: any) => s.codec_type === 'video');
    return { duration: parseFloat(j.format?.duration ?? '0') || 0, width: v?.width, height: v?.height, hasAudio: !!j.streams?.some((s: any) => s.codec_type === 'audio'), hasVideo: !!v };
  } catch (e) {
    // No usable ffprobe (e.g. Apple Silicon without Rosetta): read the same information from ffmpeg's banner.
    const info = await probeWithFfmpeg(file).catch(() => null);
    if (info) return info;
    throw e;
  }
}

async function probeWithFfmpeg(file: string): Promise<ProbeInfo> {
  const err = await new Promise<string>((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let s = ''; p.stderr.on('data', (d) => (s += d.toString()));
    p.on('error', reject); p.on('close', () => resolve(s));
  });
  const d = err.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!d) throw new Error('Fichier média illisible');
  const vid = err.match(/Stream #.*Video:.*?(\d{2,5})x(\d{2,5})/);
  return { duration: +d[1] * 3600 + +d[2] * 60 + +d[3], width: vid ? +vid[1] : undefined, height: vid ? +vid[2] : undefined, hasAudio: /Stream #.*Audio:/.test(err), hasVideo: !!vid && !/Video: (png|mjpeg).*attached pic/.test(err) };
}

/** Any audio → mono 48 kHz WAV, silence trimmed at the start and end. */
export async function toWav(input: string, output: string, opts: { trim?: boolean; tempo?: number } = {}) {
  const f: string[] = [];
  if (opts.trim) f.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05', 'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08', 'areverse');
  if (opts.tempo && opts.tempo !== 1) f.push(`atempo=${Math.min(2, Math.max(0.5, opts.tempo))}`);
  await ffmpeg(['-i', input, ...(f.length ? ['-af', f.join(',')] : []), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', output]);
}
