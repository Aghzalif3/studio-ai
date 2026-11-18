import { handler, json } from '@/lib/server/http';
import { listCustomStyles, saveCustomStyles } from '@/lib/server/store';

export const runtime = 'nodejs';
export const DELETE = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await saveCustomStyles((await listCustomStyles()).filter((s) => s.id !== id));
  return json({ deleted: true });
});
