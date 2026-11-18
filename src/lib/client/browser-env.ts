'use client';
// Browser rendering environment for the live preview (same renderer as the export).
import type { ImageLike, RenderEnv } from '../render/env';
import { FONT_FAMILIES } from '../fonts';

let fontsPromise: Promise<void> | null = null;
/** Makes sure every font used by the styles is decoded before drawing (otherwise the canvas silently falls back). */
export function loadFonts() {
  if (typeof document === 'undefined') return Promise.resolve();
  return (fontsPromise ??= Promise.all(FONT_FAMILIES.map((f) => document.fonts.load(`40px "${f}"`).catch(() => null))).then(() => {}));
}

export class MediaCache {
  images = new Map<string, HTMLImageElement>();
  videos = new Map<string, HTMLVideoElement>();
  constructor(public urlFor: (assetId: string) => string) {}
  image(id: string) {
    let im = this.images.get(id);
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = this.urlFor(id); this.images.set(id, im); }
    return im.complete && im.naturalWidth ? im : null;
  }
  video(id: string) {
    let v = this.videos.get(id);
    if (!v) { v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = this.urlFor(id); this.videos.set(id, v); }
    return v;
  }
  dispose() { for (const v of this.videos.values()) { v.pause(); v.removeAttribute('src'); v.load(); } this.videos.clear(); this.images.clear(); }
}

export function browserEnv(opts: { media?: (id: string, t: number) => ImageLike | null; logo?: ImageLike | null; preview?: boolean } = {}): RenderEnv {
  return {
    createCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c as any; },
    media: opts.media ?? (() => null),
    logo: opts.logo ?? null,
    preview: opts.preview ?? true,
    cache: new Map(),
  };
}
