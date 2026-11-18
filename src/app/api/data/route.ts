import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { wipeAll } from '@/lib/server/store';
import { wipeSecrets } from '@/lib/server/secrets';

export const runtime = 'nodejs';
const Body = z.object({ projects: z.boolean().optional(), renders: z.boolean().optional(), templates: z.boolean().optional(), styles: z.boolean().optional(), secrets: z.boolean().optional(), confirm: z.literal('SUPPRIMER') });

/** Permanent deletion of local data. Requires the literal confirmation word. */
export const DELETE = handler(async (req: Request) => {
  const b = Body.parse(await req.json());
  await wipeAll(b);
  if (b.secrets) wipeSecrets();
  return json({ ok: true });
});
