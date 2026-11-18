import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { EngineError } from '../engines/text';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function fail(e: unknown) {
  if (e instanceof EngineError) return json({ error: e.message, hint: e.hint }, e.status >= 400 && e.status < 600 ? e.status : 400);
  const msg = e instanceof Error ? e.message : String(e);
  console.error('[studio-ai]', msg);
  return json({ error: msg }, /introuvable/i.test(msg) ? 404 : 500);
}

export function handler<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => { try { return await fn(...a); } catch (e) { return fail(e); } };
}

/** Streams a file with HTTP Range support (needed for seeking in <video>/<audio>). */
export async function sendFile(req: Request, file: string, mime: string, downloadName?: string) {
  const stat = await fs.promises.stat(file).catch(() => null);
  if (!stat) return json({ error: 'Fichier introuvable' }, 404);
  const headers: Record<string, string> = { 'content-type': mime, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' };
  if (downloadName) headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  const range = req.headers.get('range');
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    let start = m?.[1] ? parseInt(m[1]) : 0, end = m?.[2] ? parseInt(m[2]) : stat.size - 1;
    if (!m?.[1] && m?.[2]) { start = stat.size - parseInt(m[2]); end = stat.size - 1; }
    end = Math.min(end, stat.size - 1);
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': String(end - start + 1) } });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, 'content-length': String(stat.size) } });
}

export const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac', aiff: 'audio/aiff',
};
