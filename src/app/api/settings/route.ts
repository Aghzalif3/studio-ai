import { handler, json } from '@/lib/server/http';
import { getSettings, updateSettings } from '@/lib/server/settings';
import { DATA_DIR } from '@/lib/server/paths';
import { dirSize } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => json({ settings: await getSettings(), dataDir: DATA_DIR, dataBytes: await dirSize(DATA_DIR), platform: process.platform }));

export const PUT = handler(async (req: Request) => {
  const patch = await req.json();
  if (!patch || typeof patch !== 'object') return json({ error: 'Corps invalide' }, 400);
  for (const k of ['__proto__', 'constructor', 'prototype']) if (k in patch) return json({ error: 'Corps invalide' }, 400);
  return json({ settings: await updateSettings(patch) });
});
