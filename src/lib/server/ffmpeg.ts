// FFmpeg / FFprobe helpers. Uses the system ffmpeg if FFMPEG_PATH is set, else the bundled ffmpeg-static binary.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
function resolveBin(envName: string, pkg: string, pick: (m: any) => string | null): string {
  if (process.env[envName]) return process.env[envName]!;
  try { const p = pick(req(pkg)); if (p && fs.existsSync(p)) return p; } catch { /* fall through */ }
  return envName === 'FFMPEG_PATH' ? 'ffmpeg' : 'ffprobe';
}
export const FFMPEG = resolveBin('FFMPEG_PATH', 'ffmpeg-static', (m) => (typeof m === 'string' ? m : m?.default ?? null));
export const FFPROBE = resolveBin('FFPROBE_PATH', 'ffprobe-static', (m) => m?.path ?? null);

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

export async function probe(file: string): Promise<{ duration: number; width?: number; height?: number; hasAudio: boolean; hasVideo: boolean }> {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file]);
  const j = JSON.parse(stdout.toString());
  const v = j.streams?.find((s: any) => s.codec_type === 'video');
  return { duration: parseFloat(j.format?.duration ?? '0') || 0, width: v?.width, height: v?.height, hasAudio: !!j.streams?.some((s: any) => s.codec_type === 'audio'), hasVideo: !!v };
}

/** Any audio → mono 48 kHz WAV, silence trimmed at the start and end. */
export async function toWav(input: string, output: string, opts: { trim?: boolean; tempo?: number } = {}) {
  const f: string[] = [];
  if (opts.trim) f.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05', 'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08', 'areverse');
  if (opts.tempo && opts.tempo !== 1) f.push(`atempo=${Math.min(2, Math.max(0.5, opts.tempo))}`);
  await ffmpeg(['-i', input, ...(f.length ? ['-af', f.join(',')] : []), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', output]);
}
