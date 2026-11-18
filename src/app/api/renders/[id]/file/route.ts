import path from 'node:path';
import { handler, json, sendFile } from '@/lib/server/http';
import { listRenders } from '@/lib/server/store';
import { RENDERS_DIR } from '@/lib/server/paths';

export const runtime = 'nodejs';

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const r = (await listRenders()).find((x) => x.id === id);
  if (!r?.file || r.status !== 'done') return json({ error: 'Fichier de rendu introuvable' }, 404);
  const file = path.join(RENDERS_DIR, path.basename(r.file));
  const dl = new URL(req.url).searchParams.has('download');
  return sendFile(req, file, 'video/mp4', dl ? r.file : undefined);
});
