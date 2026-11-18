// Node (Skia) rendering environment for exports and server-side previews.
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, GlobalFonts, loadImage, type Image } from '@napi-rs/canvas';
import type { RenderEnv } from '../render/env';

let fontsReady = false;
export const FONT_FILES: Record<string, string> = {
  Inter: 'Inter.ttf', 'Space Grotesk': 'SpaceGrotesk.ttf', 'Playfair Display': 'PlayfairDisplay.ttf', 'Bebas Neue': 'BebasNeue.ttf',
  Caveat: 'Caveat.ttf', 'Press Start 2P': 'PressStart2P.ttf', Montserrat: 'Montserrat.ttf', Oswald: 'Oswald.ttf',
  'Archivo Black': 'ArchivoBlack.ttf', 'IBM Plex Mono': 'IBMPlexMono.ttf', 'DM Serif Display': 'DMSerifDisplay.ttf',
  Fredoka: 'Fredoka.ttf', Cinzel: 'Cinzel.ttf', VT323: 'VT323.ttf', 'Noto Naskh Arabic': 'NotoNaskhArabic.ttf',
};

export function ensureFonts(root = process.cwd()) {
  if (fontsReady) return;
  for (const [family, file] of Object.entries(FONT_FILES)) {
    const p = path.join(root, 'public', 'fonts', file);
    if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family);
  }
  fontsReady = true;
}

export type FrameSource = (assetId: string, time: number) => Image | null;

export function nodeEnv(media: FrameSource, logo?: Image | null): RenderEnv {
  ensureFonts();
  return {
    createCanvas: (w, h) => createCanvas(w, h) as any,
    media: media as any,
    logo: (logo as any) ?? null,
    preview: false,
    cache: new Map(),
  };
}

export async function loadImageFile(p: string) { return loadImage(await fs.promises.readFile(p)); }
export { createCanvas, loadImage };
