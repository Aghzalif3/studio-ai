import { handler, sendFile } from '@/lib/server/http';
import { librarySfxPath } from '@/lib/server/media';

export const runtime = 'nodejs';
export const GET = handler(async (req: Request, { params }: { params: Promise<{ type: string }> }) =>
  sendFile(req, await librarySfxPath((await params).type), 'audio/wav'));
