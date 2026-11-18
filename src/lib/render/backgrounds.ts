// Procedural backgrounds, one per style family. Pure functions of (size, time, seed, palette).
import { mulberry, rgba, mix, TAU, vnoise, clamp } from '../util';
import type { StyleDef } from '../styles/types';
import { canvasFromCache, type Ctx, type RenderEnv } from './env';

export interface BgArgs { g: Ctx; w: number; h: number; t: number; seed: number; style: StyleDef; env: RenderEnv }

const U = (w: number, h: number) => Math.min(w, h) / 1080;

function linear(g: Ctx, w: number, h: number, stops: string[], angle = Math.PI / 2) {
  const cx = w / 2, cy = h / 2, r = Math.hypot(w, h) / 2;
  const gr = g.createLinearGradient(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  stops.forEach((c, i) => gr.addColorStop(i / Math.max(1, stops.length - 1), c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

function radialGlow(g: Ctx, x: number, y: number, r: number, color: string, a: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Cached paper texture (fibres + noise), drawn once per size. */
function paperTexture(env: RenderEnv, w: number, h: number, base: string, ink: string, seed: number) {
  const scale = env.preview ? 0.5 : 1;
  const { c, g, fresh } = canvasFromCache(env, `paper-${base}-${seed}`, w * scale, h * scale);
  if (fresh) {
    const W = c.width, H = c.height, r = mulberry(seed);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      radialGlow(g, r() * W, r() * H, (0.2 + r() * 0.5) * Math.max(W, H), r() > 0.5 ? '#ffffff' : ink, 0.035);
    }
    g.lineWidth = Math.max(0.5, W / 1920);
    const n = Math.round((W * H) / 900);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, l = (2 + r() * 10) * (W / 1920), a = r() * TAU;
      g.strokeStyle = rgba(ink, 0.03 + r() * 0.05);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l, y + Math.sin(a + 0.6) * l, x + Math.cos(a + 0.3) * l * 1.6, y + Math.sin(a) * l * 1.6); g.stroke();
    }
  }
  return c;
}

export function drawBackground(a: BgArgs) {
  const { g, w, h, t, seed, style, env } = a;
  const P = style.palette, u = U(w, h), r = mulberry(seed);
  const e = style.motion.energy;
  switch (style.background) {
    case 'gradient': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 3 + Math.sin(t * 0.2) * 0.2);
      for (let i = 0; i < 3; i++) {
        const x = w * (0.2 + 0.6 * vnoise(seed * 0.01 + i * 7 + t * 0.08 * (0.5 + e)));
        const y = h * (0.2 + 0.6 * vnoise(seed * 0.02 + i * 13 + t * 0.06));
        radialGlow(g, x, y, Math.max(w, h) * 0.45, P.accent[i % 2], 0.12);
      }
      break;
    }
    case 'paper':
    case 'watercolor': {
      g.drawImage(paperTexture(env, w, h, P.bg[0], P.ink, seed % 997) as any, 0, 0, w, h);
      if (style.background === 'watercolor') {
        // Soft washes that bloom in over time
        const rr = mulberry(seed + 5);
        for (let i = 0; i < 5; i++) {
          const x = rr() * w, y = rr() * h * 0.9, R = (0.25 + rr() * 0.35) * Math.max(w, h);
          const grow = clamp(t / 2.5 - i * 0.15);
          radialGlow(g, x, y, R * (0.5 + 0.5 * grow), i % 2 ? P.accent[0] : P.accent[1], 0.08 * grow);
        }
      }
      break;
    }
    case 'whiteboard': {
      linear(g, w, h, [P.bg[0], P.bg[1]], Math.PI / 2);
      radialGlow(g, w * 0.3, h * 0.2, Math.max(w, h) * 0.6, '#ffffff', 0.5);
      g.strokeStyle = rgba(P.ink, 0.04); g.lineWidth = 30 * u;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); }
      break;
    }
    case 'chalkboard': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2.2);
      g.globalAlpha = 0.06; g.fillStyle = '#ffffff';
      for (let i = 0; i < 600; i++) g.fillRect(r() * w, r() * h, (1 + r() * 3) * u, (1 + r() * 3) * u);
      g.globalAlpha = 1;
      for (let i = 0; i < 4; i++) radialGlow(g, r() * w, r() * h, 300 * u, '#ffffff', 0.04);
      break;
    }
    case 'blueprint': {
      linear(g, w, h, [P.bg[0], P.bg[2]], Math.PI / 2);
      const step = 40 * u, off = (t * 6 * u) % step;
      g.lineWidth = Math.max(1, u);
      for (let x = -step + off; x < w; x += step) { g.strokeStyle = rgba(P.ink, Math.round((x - off) / step) % 5 === 0 ? 0.16 : 0.07); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += step) { g.strokeStyle = rgba(P.ink, Math.round(y / step) % 5 === 0 ? 0.16 : 0.07); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      radialGlow(g, w / 2, h / 2, Math.max(w, h) * 0.7, '#ffffff', 0.06);
      break;
    }
    case 'grid-dark':
    case 'hud': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2);
      radialGlow(g, w * 0.5, h * 0.45, Math.max(w, h) * 0.6, P.accent[0], style.background === 'hud' ? 0.16 : 0.1);
      const step = (style.background === 'hud' ? 60 : 80) * u;
      g.lineWidth = Math.max(1, u);
      g.strokeStyle = rgba(P.accent[0], 0.08);
      const oy = (t * 10 * u) % step;
      for (let x = (w / 2) % step; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = oy; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      if (style.background === 'hud') {
        g.strokeStyle = rgba(P.accent[0], 0.25); g.lineWidth = 2 * u;
        const m = 40 * u, L = 60 * u;
        for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
          g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke();
        }
      }
      break;
    }
    case 'halftone': {
      linear(g, w, h, [P.bg[0], P.bg[1]], Math.PI / 2);
      const step = 22 * u;
      g.fillStyle = rgba(P.accent[0], 0.16);
      for (let y = 0; y < h + step; y += step) for (let x = (Math.round(y / step) % 2) * step / 2; x < w + step; x += step) {
        const d = Math.hypot(x - w * 0.75, y - h * 0.3) / Math.max(w, h);
        const rad = step * 0.42 * clamp(1 - d * 1.4 + Math.sin(t * 0.8 + x * 0.002) * 0.05);
        if (rad > 0.6) { g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
      }
      break;
    }
    case 'pixel': {
      const bands = 8;
      for (let i = 0; i < bands; i++) { g.fillStyle = mix(P.bg[0], P.bg[2], i / (bands - 1)); g.fillRect(0, (h * 0.7 * i) / bands, w, h * 0.7 / bands + 1); }
      const px = 12 * u;
      // pixel clouds
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) {
        const cx = ((r() * w + t * 20 * u * (0.5 + r())) % (w + 200 * u)) - 100 * u, cy = r() * h * 0.4;
        for (let k = 0; k < 6; k++) g.fillRect(Math.round((cx + (k % 3) * px * 3) / px) * px, Math.round((cy + Math.floor(k / 3) * px * 2) / px) * px, px * 4, px * 2);
      }
      // ground tiles
      const gy = h * 0.7;
      for (let x = 0; x < w; x += px * 4) for (let y = gy; y < h; y += px * 4) {
        g.fillStyle = (Math.floor(x / (px * 4)) + Math.floor(y / (px * 4))) % 2 ? '#3f8f3a' : '#4fa64a';
        g.fillRect(x, y, px * 4, px * 4);
      }
      g.fillStyle = '#2d6a2a'; g.fillRect(0, gy, w, px);
      break;
    }
    case 'crt': {
      linear(g, w, h, [P.bg[0], P.bg[1]], Math.PI / 2);
      radialGlow(g, w / 2, h / 2, Math.max(w, h) * 0.6, P.accent[0], 0.08);
      g.font = `${20 * u}px "IBM Plex Mono", monospace`; g.fillStyle = rgba(P.accent[0], 0.12);
      const rr = mulberry(seed + Math.floor(t * 8));
      for (let y = 30 * u; y < h; y += 28 * u) {
        let s = ''; for (let i = 0; i < 90; i++) s += '01<>/\\|=+*#'.charAt(Math.floor(rr() * 12));
        g.fillText(s, 20 * u, y);
      }
      break;
    }
    case 'film': {
      linear(g, w, h, [P.bg[2], P.bg[0]], Math.PI / 2);
      radialGlow(g, w / 2, h * 0.45, Math.max(w, h) * 0.55, P.ink, 0.12);
      break;
    }
    case 'sunburst': {
      g.fillStyle = P.bg[0]; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.55, R = Math.hypot(w, h), n = 18, rot = t * 0.05 * (0.5 + e);
      g.fillStyle = rgba(P.bg[2], 0.55);
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * TAU, a1 = a0 + TAU / n / 2;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.closePath(); g.fill();
      }
      radialGlow(g, cx, cy, Math.max(w, h) * 0.5, '#ffffff', 0.25);
      break;
    }
    case 'stars': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2);
      radialGlow(g, w * 0.7, h * 0.3, Math.max(w, h) * 0.5, P.accent[1], 0.1);
      radialGlow(g, w * 0.2, h * 0.8, Math.max(w, h) * 0.45, P.accent[0], 0.08);
      const n = env.preview ? 120 : 260;
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = r() * h, s = (0.6 + r() * 1.8) * u, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 3) + i);
        g.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * tw * r()})`; g.fillRect(x, y, s, s);
      }
      break;
    }
    case 'neon-city': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2);
      radialGlow(g, w * 0.5, h * 0.75, Math.max(w, h) * 0.6, P.accent[0], 0.2);
      // two layers of skyline
      for (let layer = 0; layer < 2; layer++) {
        const rr = mulberry(seed + layer * 31), base = h * (0.62 + layer * 0.12), shift = (t * (6 + layer * 10) * u) % (w * 0.5);
        g.fillStyle = layer ? '#05020b' : mix(P.bg[2], '#000000', 0.4);
        let x = -shift;
        while (x < w + 100 * u) {
          const bw = (40 + rr() * 90) * u, bh = (80 + rr() * 320) * u * (layer ? 0.7 : 1);
          g.fillRect(x, base - bh, bw, h - base + bh);
          if (layer) {
            for (let wy = base - bh + 12 * u; wy < h; wy += 18 * u) for (let wx = x + 8 * u; wx < x + bw - 8 * u; wx += 14 * u) {
              if (rr() > 0.72) { g.fillStyle = rr() > 0.5 ? rgba(P.accent[0], 0.7) : rgba(P.accent[1], 0.7); g.fillRect(wx, wy, 5 * u, 8 * u); g.fillStyle = '#05020b'; }
            }
          }
          x += bw + (4 + rr() * 16) * u;
        }
      }
      // rain
      g.strokeStyle = 'rgba(180,200,255,0.18)'; g.lineWidth = Math.max(1, u);
      const rr = mulberry(seed + 99);
      for (let i = 0; i < (env.preview ? 60 : 140); i++) {
        const x = rr() * w, sp = 900 * u * (0.7 + rr() * 0.6), y = ((rr() * h + t * sp) % (h + 60 * u)) - 30 * u;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4 * u, y + 26 * u); g.stroke();
      }
      break;
    }
    case 'miniature': {
      linear(g, w, h, [P.bg[0], '#e9f5ff'], Math.PI / 2);
      const gy = h * 0.35;
      g.fillStyle = P.bg[2]; g.fillRect(0, gy, w, h - gy);
      // roads
      g.fillStyle = '#5f6b73'; g.fillRect(0, h * 0.62, w, 50 * u); g.fillRect(w * 0.42, gy, 46 * u, h - gy);
      g.fillStyle = '#f1f1f1';
      for (let x = (t * 40 * u) % (60 * u); x < w; x += 60 * u) g.fillRect(x, h * 0.62 + 23 * u, 26 * u, 4 * u);
      // blocks (houses)
      const rr = mulberry(seed + 3);
      for (let i = 0; i < 26; i++) {
        const x = rr() * w, y = gy + 20 * u + rr() * (h - gy - 80 * u);
        if (Math.abs(y - h * 0.64) < 60 * u || Math.abs(x - w * 0.44) < 60 * u) continue;
        const bw = (40 + rr() * 60) * u, bh = (24 + rr() * 50) * u;
        const col = ['#f4f1de', '#e07a5f', '#81b29a', '#f2cc8f', '#3d405b'][Math.floor(rr() * 5)];
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 8 * u, y + 8 * u, bw, bh);
        g.fillStyle = col; g.fillRect(x, y, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, bw, bh * 0.3);
      }
      // moving cars
      for (let i = 0; i < 4; i++) {
        const x = ((i * 0.27 * w + t * (80 + i * 30) * u) % (w + 60 * u)) - 30 * u;
        g.fillStyle = ['#e63946', '#ffb703', '#219ebc', '#ffffff'][i]; g.fillRect(x, h * 0.62 + (i % 2 ? 8 : 30) * u, 34 * u, 14 * u);
      }
      break;
    }
    case 'clay': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2);
      const rr = mulberry(seed + 11);
      for (let i = 0; i < 4; i++) {
        const y = h * (0.62 + i * 0.1), amp = 30 * u, ph = rr() * TAU;
        g.fillStyle = mix(P.bg[2], i % 2 ? P.accent[0] : P.accent[1], 0.25 + i * 0.08);
        g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20 * u) g.lineTo(x, y + Math.sin(x / (220 * u) + ph + Math.floor(t * 12) / 12 * 0.3) * amp);
        g.lineTo(w, h); g.closePath();
        g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = 24 * u; g.shadowOffsetY = -6 * u; g.fill();
        g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
      }
      radialGlow(g, w * 0.3, h * 0.2, Math.max(w, h) * 0.5, '#ffffff', 0.3);
      break;
    }
    case 'papercut': {
      g.fillStyle = P.bg[0]; g.fillRect(0, 0, w, h);
      const layers = 5, rr = mulberry(seed + 21);
      for (let i = 0; i < layers; i++) {
        const k = i / (layers - 1), y = h * (0.35 + k * 0.5), amp = (40 + 30 * rr()) * u, f = 1 / ((180 + rr() * 160) * u);
        const par = Math.sin(t * 0.3) * 20 * u * (k + 0.2), ph = rr() * TAU;
        g.fillStyle = mix(P.bg[1], P.bg[2], k);
        g.beginPath(); g.moveTo(-50 * u, h);
        for (let x = -50 * u; x <= w + 50 * u; x += 14 * u) g.lineTo(x + par, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph) * amp * 0.25);
        g.lineTo(w + 50 * u, h); g.closePath();
        g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 18 * u; g.shadowOffsetY = -4 * u; g.fill();
      }
      g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
      break;
    }
    case 'luxury': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[0]], Math.PI / 2);
      const sx = ((t * 0.12) % 1.6 - 0.3) * w;
      const gr = g.createLinearGradient(sx - w * 0.3, 0, sx + w * 0.3, h);
      gr.addColorStop(0, rgba(P.accent[0], 0)); gr.addColorStop(0.5, rgba(P.accent[0], 0.1)); gr.addColorStop(1, rgba(P.accent[0], 0));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      radialGlow(g, w / 2, h * 0.5, Math.max(w, h) * 0.45, P.accent[1], 0.08);
      g.strokeStyle = rgba(P.accent[0], 0.35); g.lineWidth = 1.5 * u;
      const m = 44 * u; g.strokeRect(m, m, w - 2 * m, h - 2 * m);
      break;
    }
    case 'swiss': {
      g.fillStyle = P.bg[0]; g.fillRect(0, 0, w, h);
      const cols = 12, cw = w / cols;
      g.strokeStyle = rgba(P.ink, 0.06); g.lineWidth = Math.max(1, u);
      for (let i = 1; i < cols; i++) { g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke(); }
      const beat = Math.floor(t * 2 * (0.5 + e));
      const rr = mulberry(seed + beat);
      g.fillStyle = P.accent[0];
      const bx = Math.floor(rr() * 8) * cw, bw = (2 + Math.floor(rr() * 3)) * cw;
      g.fillRect(bx, h * (0.05 + rr() * 0.1), bw, h * 0.08);
      g.fillStyle = P.ink; g.fillRect(Math.floor(rr() * 10) * cw, h * 0.85, cw * 2, h * 0.02);
      break;
    }
    case 'cinematic': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2.4);
      radialGlow(g, w * (0.75 + Math.sin(t * 0.2) * 0.05), h * 0.25, Math.max(w, h) * 0.6, P.accent[0], 0.16);
      radialGlow(g, w * 0.15, h * 0.85, Math.max(w, h) * 0.5, P.accent[1], 0.12);
      break;
    }
    case 'anime-sky': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2);
      radialGlow(g, w * 0.7, h * 0.62, Math.max(w, h) * 0.5, '#fff3c4', 0.45);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(w * 0.7, h * 0.62, 70 * u, 0, TAU); g.fill();
      // horizon
      g.fillStyle = mix(P.bg[0], '#000000', 0.35);
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 30 * u) g.lineTo(x, h * 0.8 + Math.sin(x / (160 * u) + seed) * 18 * u + Math.sin(x / (53 * u)) * 6 * u);
      g.lineTo(w, h); g.closePath(); g.fill();
      break;
    }
    case 'iso': {
      linear(g, w, h, [P.bg[0], P.bg[2]], Math.PI / 2);
      const s = 70 * u; g.strokeStyle = rgba(P.ink, 0.06); g.lineWidth = Math.max(1, u);
      for (let x = -h; x < w + h; x += s) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 1.732, h); g.stroke();
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x - h * 1.732, h); g.stroke();
      }
      radialGlow(g, w / 2, h * 0.4, Math.max(w, h) * 0.5, '#ffffff', 0.4);
      break;
    }
    case 'data': {
      linear(g, w, h, [P.bg[0], P.bg[1]], Math.PI / 2);
      g.strokeStyle = rgba(P.ink, 0.07); g.lineWidth = Math.max(1, u);
      for (let i = 1; i < 6; i++) { const y = (h * i) / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      break;
    }
    case 'contour': {
      linear(g, w, h, [P.bg[0], P.bg[1], P.bg[2]], Math.PI / 2);
      g.lineWidth = Math.max(1, 1.2 * u);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = rgba(P.accent[1], 0.05 + (k % 4 === 0 ? 0.06 : 0));
        g.beginPath();
        for (let x = 0; x <= w; x += 16 * u) {
          const y = h * (k / 13) + Math.sin(x / (300 * u) + k * 0.7 + seed) * 50 * u + Math.sin(x / (97 * u) + k) * 12 * u + Math.sin(t * 0.2 + k) * 6 * u;
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      radialGlow(g, w * 0.5, h * 0.5, Math.max(w, h) * 0.6, P.accent[0], 0.06);
      break;
    }
    case 'glass': {
      g.fillStyle = P.bg[0]; g.fillRect(0, 0, w, h);
      const cx = w / 2 + Math.sin(t * 0.3) * 40 * u, cy = h * 0.42;
      radialGlow(g, cx, cy, Math.max(w, h) * 0.55, P.accent[0], 0.32);
      radialGlow(g, cx + 200 * u, cy + 120 * u, Math.max(w, h) * 0.35, P.accent[1], 0.2);
      // floor reflection
      const gr = g.createLinearGradient(0, h * 0.7, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
      break;
    }
    default: {
      linear(g, w, h, [P.bg[0], P.bg[2]]);
    }
  }
}
