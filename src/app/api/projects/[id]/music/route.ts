import { handler, json } from '@/lib/server/http';
import { ensureMusic } from '@/lib/server/production';

export const runtime = 'nodejs';
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const body = await req.json().catch(() => ({}));
  return json(await ensureMusic((await params).id, !!body.force));
});
