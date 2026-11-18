import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { listCustomStyles, saveCustomStyles } from '@/lib/server/store';
import { ALL_STYLES, getBuiltinStyle } from '@/lib/styles/registry';
import { buildCustomStyle } from '@/lib/styles/custom';
import { uid } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => json({ builtin: ALL_STYLES, custom: await listCustomStyles() }));

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const dataUrl = z.string().regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/).max(1_500_000);
const Body = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(60), baseStyleId: z.string(), colors: z.array(hex).min(2).max(4),
  displayFont: z.string().max(60), bodyFont: z.string().max(60), logoAssetDataUrl: dataUrl.optional(),
  promptHints: z.string().max(400).default(''), referenceImages: z.array(dataUrl).max(4).default([]),
});

/** Creates or updates a custom style. */
export const POST = handler(async (req: Request) => {
  const b = Body.parse(await req.json());
  const base = getBuiltinStyle(b.baseStyleId);
  if (!base) return json({ error: 'Style de base inconnu' }, 400);
  const all = await listCustomStyles();
  const id = b.id && all.some((s) => s.id === b.id) ? b.id : uid('custom-');
  const style = buildCustomStyle(b, base, id);
  (style as any).input = b; // keep the form values for later editing
  await saveCustomStyles([style, ...all.filter((s) => s.id !== id)]);
  return json(style, 201);
});
