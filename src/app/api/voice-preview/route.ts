import fs from 'node:fs';
import { z } from 'zod';
import { handler, json } from '@/lib/server/http';
import { synthesize } from '@/lib/engines/voice';
import { estimateCost } from '@/lib/engines/catalog';

export const runtime = 'nodejs';
const Body = z.object({
  engine: z.string(), voice: z.string(), text: z.string().min(1).max(600), lang: z.string().default('fr-FR'),
  rate: z.number().min(-50).max(100).default(0), pitch: z.number().min(-50).max(50).default(0), confirmCost: z.boolean().optional(),
});

/** Synthesises a short sample and returns the WAV directly (nothing is stored). */
export const POST = handler(async (req: Request) => {
  const b = Body.parse(await req.json());
  const cost = estimateCost(b.engine, b.text.length / 1000);
  if (cost > 0 && !b.confirmCost) return json({ needsConfirmation: true, costUsd: cost }, 402);
  const r = await synthesize(b);
  const buf = await fs.promises.readFile(r.wavPath);
  await fs.promises.rm(r.wavPath, { force: true });
  return new Response(new Uint8Array(buf), { headers: { 'content-type': 'audio/wav', 'x-duration': String(r.duration), 'x-words': encodeURIComponent(JSON.stringify(r.words)) } });
});
