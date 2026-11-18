import { handler, json } from '@/lib/server/http';
import { listTemplates } from '@/lib/server/store';
import { BUILTIN_TEMPLATES } from '@/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Built-in starting points (brief presets) + templates saved from the user's projects. */
export const GET = handler(async () => json({ builtin: BUILTIN_TEMPLATES, saved: (await listTemplates()).map(({ project, ...t }) => ({ ...t, styleId: project.brief.styleId, aspect: project.brief.aspect, scenes: project.scenes.length, duration: project.brief.durationSec })) }));
