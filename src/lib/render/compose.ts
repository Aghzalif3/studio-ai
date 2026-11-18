// The frame compositor: one deterministic function of (project, t) used by the live preview and by the export.
import { clamp, eio, eo, mulberry, ss, strHash } from '../util';
import type { StyleDef } from '../styles/types';
import type { CameraMove, EffectClip, Project, Scene, VideoClip } from '../types';
import { drawBackground } from './backgrounds';
import { drawMotif } from './motifs';
import { drawSceneText } from './text';
import { drawCaption } from './captions';
import { applyPost, blurred, letterbox } from './post';
import { canvasFromCache, supportsFilter, type AnyCanvas, type Ctx, type RenderEnv } from './env';

export function timelineDuration(p: Pick<Project, 'timeline'>) {
  const tl = p.timeline;
  let d = 0;
  for (const c of tl.video) d = Math.max(d, c.start + c.duration);
  if (!tl.video.length) for (const c of tl.voice) d = Math.max(d, c.start + c.duration);
  return Math.max(0.5, d);
}

interface Cam { s: number; x: number; y: number; r: number }
export function cameraAt(move: CameraMove | undefined, p: number, energy: number, seed: number, t: number): Cam {
  const k = 0.6 + energy * 0.8, q = eio(p);
  switch (move) {
    case 'push-in': return { s: 1 + 0.12 * k * q, x: 0, y: 0, r: 0 };
    case 'pull-out': return { s: 1 + 0.12 * k * (1 - q), x: 0, y: 0, r: 0 };
    case 'pan-left': return { s: 1.12, x: 0.045 * k * (1 - 2 * q), y: 0, r: 0 };
    case 'pan-right': return { s: 1.12, x: -0.045 * k * (1 - 2 * q), y: 0, r: 0 };
    case 'tilt-up': return { s: 1.12, x: 0, y: -0.04 * k * (1 - 2 * q), r: 0 };
    case 'tilt-down': return { s: 1.12, x: 0, y: 0.04 * k * (1 - 2 * q), r: 0 };
    case 'orbit': return { s: 1.1 + 0.04 * q, x: Math.sin(q * Math.PI) * 0.03, y: 0, r: (q - 0.5) * 0.03 * k };
    case 'dolly-zoom': return { s: 1 + 0.2 * k * ss(p), x: 0, y: 0, r: 0 };
    case 'shake': {
      const r = mulberry(seed + Math.floor(t * 24));
      return { s: 1.06, x: (r() - 0.5) * 0.012 * k, y: (r() - 0.5) * 0.012 * k, r: (r() - 0.5) * 0.004 };
    }
    default: return { s: 1, x: 0, y: 0, r: 0 };
  }
}

function drawCover(g: Ctx, img: any, w: number, h: number, cam: Cam, clip: VideoClip) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s0 = Math.max(w / iw, h / ih) * cam.s * (clip.zoom || 1);
  g.save();
  g.translate(w / 2 + (cam.x + clip.offsetX * 0.5) * w, h / 2 + (cam.y + clip.offsetY * 0.5) * h);
  g.rotate(cam.r + (clip.rotation * Math.PI) / 180);
  g.drawImage(img, -iw * s0 / 2, -ih * s0 / 2, iw * s0, ih * s0);
  g.restore();
}

const CLIP_FILTERS: Record<VideoClip['filter'], string> = {
  none: '', bw: 'grayscale(1) contrast(1.1)', warm: 'sepia(0.3) saturate(1.2)', cool: 'hue-rotate(-12deg) saturate(1.05) brightness(1.02)',
  vivid: 'saturate(1.45) contrast(1.08)', fade: 'contrast(0.85) brightness(1.08) saturate(0.8)',
};

export interface FrameInput {
  project: Project;
  style: StyleDef;
  w: number;
  h: number;
  sceneMap?: Map<string, Scene>;
}

function renderClip(env: RenderEnv, target: Ctx, input: FrameInput, clip: VideoClip, lt: number) {
  const { w, h, style } = input;
  const scene = clip.sceneId ? (input.sceneMap?.get(clip.sceneId) ?? input.project.scenes.find((s) => s.id === clip.sceneId)) : undefined;
  const seed = strHash(clip.sceneId || clip.id);
  const dur = clip.duration;
  const ltClamped = clamp(lt, 0, dur + 1);
  const st = style.motion.stepFps ? Math.floor(ltClamped * style.motion.stepFps) / style.motion.stepFps : ltClamped;
  const p = clamp(ltClamped / Math.max(0.01, dur));
  const cam = cameraAt(clip.camera ?? scene?.camera, p, style.motion.energy, seed, ltClamped);
  const assetId = clip.assetId ?? scene?.videoAssetId ?? scene?.imageAssetId;
  const isVideo = !!assetId && input.project.assets.find((a) => a.id === assetId)?.kind === 'video';
  const media = assetId ? env.media(assetId, isVideo ? clip.srcIn + ltClamped * (clip.speed || 1) : 0) : null;
  target.save();
  if (media) {
    target.fillStyle = '#000'; target.fillRect(0, 0, w, h);
    const f = CLIP_FILTERS[clip.filter ?? 'none'];
    if (f && supportsFilter(target)) target.filter = f;
    drawCover(target, media, w, h, cam, clip);
    target.filter = 'none';
  } else {
    // Procedural illustration: camera moves the whole drawn world.
    target.save();
    target.translate(w / 2 + cam.x * w + clip.offsetX * 0.5 * w, h / 2 + cam.y * h + clip.offsetY * 0.5 * h);
    target.rotate(cam.r + (clip.rotation * Math.PI) / 180);
    const z = cam.s * (clip.zoom || 1);
    target.scale(z, z);
    target.translate(-w / 2, -h / 2);
    drawBackground({ g: target, w, h, t: ltClamped, seed, style, env });
    drawMotif(target, w, h, st, dur, seed, style, env.preview);
    target.restore();
    const f = CLIP_FILTERS[clip.filter ?? 'none'];
    if (f && supportsFilter(target)) {
      const tmp = canvasFromCache(env, 'clipf', w, h);
      tmp.g.clearRect(0, 0, w, h); tmp.g.drawImage(target.canvas as any, 0, 0);
      target.filter = f; target.drawImage(tmp.c as any, 0, 0); target.filter = 'none';
    }
  }
  const text = clip.text ?? scene?.onScreenText ?? '';
  if (text) {
    drawSceneText({
      g: target, w, h, t: ltClamped, dur, text, layout: scene?.layout ?? 'statement', keywords: scene?.keywords ?? [],
      style, onImage: !!media, seed,
    });
  }
  if (env.logo) {
    const lw = Math.min(w, h) * 0.12, ih = (env.logo as any).height || 1, iw = (env.logo as any).width || 1;
    target.globalAlpha = 0.9;
    target.drawImage(env.logo as any, w - lw - Math.min(w, h) * 0.04, Math.min(w, h) * 0.04, lw, (lw * ih) / iw);
    target.globalAlpha = 1;
  }
  target.restore();
}

function composite(env: RenderEnv, g: Ctx, A: AnyCanvas, B: AnyCanvas, type: string, p: number, w: number, h: number, frame: number, accent: string) {
  const e = eio(p);
  g.save();
  switch (type) {
    case 'fade':
      if (p < 0.5) { g.drawImage(A as any, 0, 0); g.fillStyle = `rgba(0,0,0,${p * 2})`; g.fillRect(0, 0, w, h); }
      else { g.drawImage(B as any, 0, 0); g.fillStyle = `rgba(0,0,0,${(1 - p) * 2})`; g.fillRect(0, 0, w, h); }
      break;
    case 'slide-left': g.drawImage(A as any, -e * w, 0); g.drawImage(B as any, (1 - e) * w, 0); break;
    case 'slide-up': g.drawImage(A as any, 0, -e * h); g.drawImage(B as any, 0, (1 - e) * h); break;
    case 'zoom': {
      g.save(); g.globalAlpha = 1 - e; g.translate(w / 2, h / 2); g.scale(1 + e * 0.5, 1 + e * 0.5); g.drawImage(A as any, -w / 2, -h / 2); g.restore();
      g.save(); g.globalAlpha = e; g.translate(w / 2, h / 2); g.scale(0.8 + e * 0.2, 0.8 + e * 0.2); g.drawImage(B as any, -w / 2, -h / 2); g.restore();
      break;
    }
    case 'wipe': {
      g.drawImage(A as any, 0, 0);
      g.save(); g.beginPath(); g.rect(0, 0, e * w, h); g.clip(); g.drawImage(B as any, 0, 0); g.restore();
      g.fillStyle = accent; g.fillRect(e * w - Math.max(3, w * 0.004), 0, Math.max(6, w * 0.008), h);
      break;
    }
    case 'glitch': {
      const src = p < 0.5 ? A : B, r = mulberry(frame * 97 + 1);
      g.drawImage(src as any, 0, 0);
      const amt = Math.sin(p * Math.PI);
      for (let i = 0; i < 12; i++) {
        const y = r() * h, sh = (0.01 + r() * 0.06) * h, dx = (r() - 0.5) * w * 0.12 * amt;
        g.drawImage((r() > 0.5 ? A : B) as any, 0, y, w, sh, dx, y, w, sh);
      }
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.25 * amt; g.drawImage(src as any, 8 * amt, 0); g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'flash': {
      g.drawImage((p < 0.5 ? A : B) as any, 0, 0);
      g.fillStyle = `rgba(255,255,255,${Math.sin(p * Math.PI) ** 2})`; g.fillRect(0, 0, w, h);
      break;
    }
    case 'blur': {
      const amt = Math.sin(p * Math.PI);
      const src = p < 0.5 ? A : B;
      if (amt > 0.05) { const b = blurred(env, src, w, h, 2 + amt * 14, 'tr'); g.drawImage(b as any, 0, 0); }
      else g.drawImage(src as any, 0, 0);
      break;
    }
    case 'cut': g.drawImage((p < 0.5 ? A : B) as any, 0, 0); break;
    default: // crossfade
      g.drawImage(A as any, 0, 0); g.globalAlpha = e; g.drawImage(B as any, 0, 0);
  }
  g.restore();
}

function applyEffects(env: RenderEnv, g: Ctx, frameCanvas: AnyCanvas, effects: EffectClip[], t: number, w: number, h: number, frame: number) {
  for (const fx of effects) {
    if (t < fx.start || t >= fx.start + fx.duration) continue;
    const lt = t - fx.start, p = clamp(lt / fx.duration), k = clamp(fx.intensity);
    const env1 = Math.min(1, lt / 0.2, (fx.duration - lt) / 0.2);
    switch (fx.type) {
      case 'vignette': {
        const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.85 * k * env1})`);
        g.fillStyle = gr; g.fillRect(0, 0, w, h); break;
      }
      case 'flash': g.fillStyle = `rgba(255,255,255,${k * (1 - eo(p))})`; g.fillRect(0, 0, w, h); break;
      case 'letterbox': letterbox(g, w, h, k * env1); break;
      case 'glow': { const b = blurred(env, frameCanvas, w, h, 12, 'fxglow'); g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.6 * k * env1; g.drawImage(b as any, 0, 0); g.restore(); break; }
      case 'blur': { const b = blurred(env, frameCanvas, w, h, 2 + 14 * k, 'fxblur'); g.save(); g.globalAlpha = env1; g.drawImage(b as any, 0, 0); g.restore(); break; }
      case 'bw': { g.save(); g.globalCompositeOperation = 'saturation'; g.globalAlpha = k * env1; g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); g.restore(); break; }
      case 'chromatic': { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.3 * k * env1; g.drawImage(frameCanvas as any, 10 * k, 0); g.drawImage(frameCanvas as any, -10 * k, 0); g.restore(); break; }
      case 'grain': { const r = mulberry(frame); g.save(); g.globalAlpha = 0.12 * k * env1; for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? '#fff' : '#000'; g.fillRect(r() * w, r() * h, 2, 2); } g.restore(); break; }
      default: break; // shake & zoom-punch are applied as transforms in renderFrame
    }
  }
}

export interface FrameStats { scene?: Scene; clip?: VideoClip }

export function renderFrame(env: RenderEnv, g: Ctx, input: FrameInput, t: number, frame = Math.round(t * 30)): FrameStats {
  const { project, style, w, h } = input;
  const tl = project.timeline;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const clips = [...tl.video].sort((a, b) => a.start - b.start);
  if (!clips.length) { g.restore(); return {}; }

  // Which clip, and is a transition running?
  let idx = clips.findIndex((c) => t >= c.start && t < c.start + c.duration);
  if (idx < 0) idx = t >= clips[clips.length - 1].start ? clips.length - 1 : 0;
  const cur = clips[idx];
  let A: VideoClip | null = null, B: VideoClip = cur, p = 1;
  const half = (c: VideoClip) => (c.transition?.type && c.transition.type !== 'cut' ? Math.min(c.transition.duration, c.duration * 0.8) / 2 : 0);
  const next = clips[idx + 1];
  if (next && half(next) > 0 && t >= next.start - half(next)) { A = cur; B = next; p = (t - (next.start - half(next))) / (2 * half(next)); }
  else if (idx > 0 && half(cur) > 0 && t < cur.start + half(cur)) { A = clips[idx - 1]; B = cur; p = (t - (cur.start - half(cur))) / (2 * half(cur)); }

  const frameC = canvasFromCache(env, 'frame', w, h);
  frameC.g.setTransform(1, 0, 0, 1, 0, 0); frameC.g.globalAlpha = 1; frameC.g.globalCompositeOperation = 'source-over';
  if (A) {
    const la = canvasFromCache(env, 'layerA', w, h), lb = canvasFromCache(env, 'layerB', w, h);
    la.g.clearRect(0, 0, w, h); lb.g.clearRect(0, 0, w, h);
    renderClip(env, la.g, input, A, t - A.start);
    renderClip(env, lb.g, input, B, Math.max(0, t - B.start));
    frameC.g.clearRect(0, 0, w, h);
    composite(env, frameC.g, la.c, lb.c, B.transition.type, clamp(p), w, h, frame, style.palette.accent[0]);
  } else {
    frameC.g.clearRect(0, 0, w, h);
    renderClip(env, frameC.g, input, B, t - B.start);
  }

  // Shake / zoom punch effects transform the whole picture.
  let sx = 0, sy = 0, sc = 1;
  for (const fx of tl.effects) {
    if (t < fx.start || t >= fx.start + fx.duration) continue;
    const lt = t - fx.start;
    if (fx.type === 'shake') { const r = mulberry(frame * 13 + 5); sx += (r() - 0.5) * 0.03 * w * fx.intensity; sy += (r() - 0.5) * 0.03 * h * fx.intensity; }
    if (fx.type === 'zoom-punch') sc *= 1 + 0.15 * fx.intensity * Math.exp(-lt * 6);
  }
  if (sx || sy || sc !== 1) {
    g.translate(w / 2 + sx, h / 2 + sy); g.scale(sc, sc); g.translate(-w / 2, -h / 2);
  }
  applyPost(env, g, frameC.c, w, h, style.post, t, frame);
  g.setTransform(1, 0, 0, 1, 0, 0);
  applyEffects(env, g, frameC.c, tl.effects, t, w, h, frame);
  const sceneB = B.sceneId ? project.scenes.find((s) => s.id === B.sceneId) : undefined;
  drawCaption(g, w, h, t, tl.captions, project.captionStyle, sceneB?.keywords ?? []);
  letterbox(g, w, h, style.post.letterbox);
  g.restore();
  return { scene: sceneB, clip: B };
}
