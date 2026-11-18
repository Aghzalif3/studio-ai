import { handler, json } from '@/lib/server/http';
import { getProject } from '@/lib/server/store';
import { toSrt, toVtt } from '@/lib/subtitles';

export const runtime = 'nodejs';
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const p = await getProject((await params).id);
  if (!p) return json({ error: 'Projet introuvable' }, 404);
  const fmt = new URL(req.url).searchParams.get('format') === 'vtt' ? 'vtt' : 'srt';
  const body = fmt === 'vtt' ? toVtt(p.timeline.captions) : toSrt(p.timeline.captions);
  const name = `${p.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.${fmt}`;
  return new Response(body, { headers: { 'content-type': fmt === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
});
