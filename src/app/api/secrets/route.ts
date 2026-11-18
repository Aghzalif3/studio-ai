import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { SECRET_NAMES, secretStatus, setSecret, type SecretName } from '@/lib/server/secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Only reports whether each key is set and its last 4 characters. The value itself is never sent back. */
export const GET = handler(async () => json({ items: secretStatus() }));

const Body = z.object({ name: z.enum(Object.keys(SECRET_NAMES) as [SecretName, ...SecretName[]]), value: z.string().max(500).nullable() });
export const PUT = handler(async (req: Request) => {
  const b = Body.parse(await req.json());
  setSecret(b.name, b.value && b.value.trim() ? b.value : null);
  return json({ items: secretStatus() });
});
