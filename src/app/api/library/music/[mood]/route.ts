import { handler, sendFile } from '@/lib/server/http';
import { libraryMusicPreview } from '@/lib/server/media';

export const runtime = 'nodejs';
export const GET = handler(async (req: Request, { params }: { params: Promise<{ mood: string }> }) => {
  const seed = Math.max(1, Math.min(99, parseInt(new URL(req.url).searchParams.get('seed') || '1') || 1));
  return sendFile(req, await libraryMusicPreview((await params).mood, seed), 'audio/wav');
});
