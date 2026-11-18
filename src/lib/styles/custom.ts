// Builds a StyleDef from the user's custom style form (shared by the server and the live preview).
import type { CustomStyleInput } from '../types';
import type { StyleDef } from './types';
import { mix } from '../util';

export function buildCustomStyle(input: CustomStyleInput, base: StyleDef, id: string): StyleDef {
  const [bg = base.palette.bg[0], ink = base.palette.ink, a1 = base.palette.accent[0], a2 = base.palette.accent[1]] = input.colors;
  return {
    ...structuredClone(base),
    id,
    name: { fr: input.name, en: input.name },
    category: 'custom',
    description: { fr: `Style personnalisé basé sur « ${base.name.fr} ».`, en: `Custom style based on “${base.name.en}”.` },
    palette: { bg: [bg, mix(bg, a1, 0.18), mix(bg, '#000000', 0.35)], ink, muted: mix(ink, bg, 0.45), accent: [a1, a2] },
    fonts: { display: input.displayFont || base.fonts.display, body: input.bodyFont || base.fonts.body },
    prompt: [base.prompt, input.promptHints].filter(Boolean).join(', '),
    origin: 'custom',
    featured: false,
    logo: input.logoAssetDataUrl || undefined,
    references: input.referenceImages?.slice(0, 4) ?? [],
    lemoSlug: undefined,
  };
}
