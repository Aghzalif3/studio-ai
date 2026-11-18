// Style post-processing (grain, vignette, CRT, tilt-shift, bloom, colour) and timeline effect clips.
import { mulberry, rgba, clamp } from '../util';
import type { PostFx } from '../styles/types';
import { canvasFromCache, supportsFilter, type AnyCanvas, type Ctx, type RenderEnv } from './env';

function grainTile(env: RenderEnv) {
  const S = 256;
  const { c, g, fresh } = canvasFromCache(env, 'grain', S, S);
  if (fresh) {
    const img = g.createImageData(S, S), r = mulberry(1234);
    for (let i = 0; i < S * S; i++) { const v = Math.floor(r() * 255); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
  return c;
}

/** Cheap blur by down/up-sampling (works in every canvas implementation). */
export function blurred(env: RenderEnv, src: AnyCanvas, w: number, h: number, factor: number, key: string) {
  const sw = Math.max(2, Math.round(w / factor)), sh = Math.max(2, Math.round(h / factor));
  const small = canvasFromCache(env, `blur-s-${key}`, sw, sh);
  small.g.imageSmoothingEnabled = true; (small.g as any).imageSmoothingQuality = 'high';
  small.g.clearRect(0, 0, sw, sh); small.g.drawImage(src as any, 0, 0, sw, sh);
  const big = canvasFromCache(env, `blur-b-${key}`, w, h);
  big.g.imageSmoothingEnabled = true; (big.g as any).imageSmoothingQuality = 'high';
  big.g.clearRect(0, 0, w, h); big.g.drawImage(small.c as any, 0, 0, w, h);
  return big.c;
}

export function applyColor(g: Ctx, src: AnyCanvas, w: number, h: number, fx: { saturation: number; contrast: number; sepia: number }, extra = '') {
  const parts: string[] = [];
  if (fx.saturation !== 1) parts.push(`saturate(${fx.saturation})`);
  if (fx.contrast !== 1) parts.push(`contrast(${fx.contrast})`);
  if (fx.sepia > 0) parts.push(`sepia(${fx.sepia})`);
  if (extra) parts.push(extra);
  if (!parts.length) { g.drawImage(src as any, 0, 0, w, h); return; }
  if (supportsFilter(g)) {
    g.filter = parts.join(' '); g.drawImage(src as any, 0, 0, w, h); g.filter = 'none';
  } else {
    g.drawImage(src as any, 0, 0, w, h);
    if (fx.saturation < 1) { g.save(); g.globalCompositeOperation = 'saturation'; g.globalAlpha = 1 - fx.saturation; g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); g.restore(); }
  }
}

/** Applies the style's post effects in place on (g, layer). `layer` holds the frame; result drawn into g. */
export function applyPost(env: RenderEnv, g: Ctx, layer: AnyCanvas, w: number, h: number, fx: PostFx, t: number, frame: number) {
  const u = Math.min(w, h) / 1080;
  let src = layer;
  // pixelate first (affects everything)
  if (fx.pixelate > 0) {
    const block = Math.max(2, fx.pixelate * u * 1.6);
    const sw = Math.max(2, Math.round(w / block)), sh = Math.max(2, Math.round(h / block));
    const small = canvasFromCache(env, 'pix-s', sw, sh);
    small.g.imageSmoothingEnabled = false; small.g.clearRect(0, 0, sw, sh); small.g.drawImage(src as any, 0, 0, sw, sh);
    const big = canvasFromCache(env, 'pix-b', w, h);
    big.g.imageSmoothingEnabled = false; big.g.clearRect(0, 0, w, h); big.g.drawImage(small.c as any, 0, 0, w, h);
    src = big.c;
  }
  applyColor(g, src, w, h, fx);

  if (fx.tiltShift > 0) {
    const b = blurred(env, src, w, h, env.preview ? 10 : 7, 'tilt');
    const m = canvasFromCache(env, 'tilt-m', w, h);
    m.g.clearRect(0, 0, w, h); m.g.globalCompositeOperation = 'source-over'; m.g.drawImage(b as any, 0, 0);
    m.g.globalCompositeOperation = 'destination-in';
    const gr = m.g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgba(0,0,0,${fx.tiltShift})`); gr.addColorStop(0.32, 'rgba(0,0,0,0)'); gr.addColorStop(0.68, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${fx.tiltShift})`);
    m.g.fillStyle = gr; m.g.fillRect(0, 0, w, h); m.g.globalCompositeOperation = 'source-over';
    g.drawImage(m.c as any, 0, 0);
  }
  if (fx.bloom > 0) {
    const b = blurred(env, src, w, h, env.preview ? 16 : 12, 'bloom');
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = fx.bloom * 0.45; g.drawImage(b as any, 0, 0); g.restore();
  }
  if (fx.chromatic > 0) {
    const off = fx.chromatic * 6 * u;
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.18 * fx.chromatic;
    g.drawImage(src as any, off, 0, w, h); g.drawImage(src as any, -off, 0, w, h); g.restore();
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba('#ff00ff', 0.03 * fx.chromatic); g.fillRect(0, 0, w, h); g.restore();
  }
  if (fx.scanlines > 0) {
    g.save(); g.fillStyle = `rgba(0,0,0,${0.35 * fx.scanlines})`;
    const step = Math.max(2, 3 * u);
    for (let y = 0; y < h; y += step * 2) g.fillRect(0, y, w, step);
    g.restore();
  }
  if (fx.flicker > 0) {
    const r = mulberry(frame * 7919 + 13);
    g.save(); g.fillStyle = `rgba(0,0,0,${r() * 0.12 * fx.flicker})`; g.fillRect(0, 0, w, h); g.restore();
    // scratches & dust
    g.save(); g.strokeStyle = `rgba(255,255,255,${0.25 * fx.flicker})`; g.lineWidth = Math.max(1, u);
    for (let i = 0; i < 2; i++) if (r() > 0.6) { const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10 * u, h); g.stroke(); }
    g.fillStyle = `rgba(20,15,10,${0.5 * fx.flicker})`;
    for (let i = 0; i < 6; i++) if (r() > 0.5) { g.beginPath(); g.arc(r() * w, r() * h, (1 + r() * 3) * u, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  if (fx.grain > 0) {
    const tile = grainTile(env), r = mulberry(frame * 31 + 7);
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.22 * fx.grain;
    const pat = g.createPattern(tile as any, 'repeat');
    if (pat) {
      g.translate(-r() * 256, -r() * 256); g.fillStyle = pat;
      const s = Math.max(1, u * 1.2); g.scale(s, s); g.fillRect(0, 0, (w + 512) / s, (h + 512) / s);
    }
    g.restore();
  }
  if (fx.vignette > 0) {
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${clamp(0.75 * fx.vignette)})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  void t;
}

export function letterbox(g: Ctx, w: number, h: number, amount: number) {
  if (amount <= 0 || h > w) return;
  const bh = h * 0.12 * amount;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, bh); g.fillRect(0, h - bh, w, bh);
}
