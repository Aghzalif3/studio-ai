// Rendering environment abstraction: the same renderer runs in the browser (HTMLCanvas) and in Node (Skia).

export type Ctx = CanvasRenderingContext2D;
export type AnyCanvas = { width: number; height: number; getContext(type: '2d'): any };
export type ImageLike = CanvasImageSource & { width?: number; height?: number };

export interface RenderEnv {
  createCanvas(w: number, h: number): AnyCanvas;
  /** Image (or current video frame) for an asset. `time` is the position inside a video asset. */
  media(assetId: string, time: number): ImageLike | null;
  /** Logo of a custom style, already decoded. */
  logo?: ImageLike | null;
  /** Lower quality for real-time preview (fewer particles, cheaper blur). */
  preview?: boolean;
  /** Font family names that are available. */
  fonts?: Set<string>;
  cache: Map<string, any>;
}

export function canvasFromCache(env: RenderEnv, key: string, w: number, h: number): { c: AnyCanvas; g: Ctx; fresh: boolean } {
  const k = `${key}:${w}x${h}`;
  let hit = env.cache.get(k);
  if (hit) return { ...hit, fresh: false };
  const c = env.createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  hit = { c, g: c.getContext('2d') as Ctx };
  env.cache.set(k, hit);
  return { ...hit, fresh: true };
}

export function supportsFilter(g: Ctx) { return typeof (g as any).filter === 'string'; }
