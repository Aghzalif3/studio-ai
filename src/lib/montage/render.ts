// Dessin d'une image du montage : vidéo recadrée + zooms + étalonnage, motions, sous-titres.
// Fonction pure du temps : la même sert à l'aperçu et à l'export.

import type { CaptionGroup, CaptionLook, Grade, Motion, Plan } from './types';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const eo = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const eio = (t: number) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const back = (t: number, s = 2.2) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };

export const ORANGE = '#ff6b2c';

export interface DrawOpts {
  look: CaptionLook;
  /** Source vidéo à dessiner (élément <video> prêt) et sa taille. */
  video?: { el: CanvasImageSource; w: number; h: number } | null;
  /** Mise en évidence d'un élément sélectionné dans l'éditeur. */
  highlightId?: string | null;
}

export function zoomAt(p: Plan, t: number): { s: number; x: number; y: number } {
  let s = 1, x = p.crop.x, y = p.crop.y;
  for (const z of p.zooms) {
    if (t < z.start || t > z.start + z.duration) continue;
    const k = t - z.start, inT = 0.18, outT = 0.25;
    const e = k < inT ? back(k / inT, 1.4) : k > z.duration - outT ? 1 - eio((k - (z.duration - outT)) / outT) : 1;
    s = 1 + (z.amount - 1) * e; x = z.x; y = z.y;
  }
  return { s, x, y };
}

function drawVideo(ctx: CanvasRenderingContext2D, W: number, H: number, p: Plan, t: number, v: NonNullable<DrawOpts['video']>) {
  const z = zoomAt(p, t);
  const cover = Math.max(W / v.w, H / v.h) * z.s;
  const dw = v.w * cover, dh = v.h * cover;
  // Centre de recadrage, borné pour ne jamais montrer de bord noir.
  const cx = clamp(p.crop.x, 0, 1) * dw, cy = clamp(p.crop.y, 0, 1) * dh;
  const dx = clamp(W / 2 - cx, W - dw, 0), dy = clamp(H / 2 - cy, H - dh, 0);
  ctx.save();
  const f = gradeFilter(p.grade);
  if (f && 'filter' in ctx) ctx.filter = f;
  ctx.drawImage(v.el, dx, dy, dw, dh);
  ctx.restore();
  gradeTint(ctx, W, H, p.grade);
}

function gradeFilter(g: Grade): string {
  switch (g) {
    case 'cine-orange': return 'contrast(1.12) saturate(1.15) brightness(0.97)';
    case 'contraste': return 'contrast(1.25) saturate(1.05)';
    case 'noir-blanc': return 'grayscale(1) contrast(1.2)';
    default: return '';
  }
}

function gradeTint(ctx: CanvasRenderingContext2D, W: number, H: number, g: Grade) {
  ctx.save();
  if (g === 'cine-orange') {
    // Tons chauds sur les hautes lumières, ombres légèrement bleutées.
    ctx.globalCompositeOperation = 'soft-light';
    const gr = ctx.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, 'rgba(255,140,60,0.35)'); gr.addColorStop(1, 'rgba(20,90,140,0.30)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  // Vignettage léger dans tous les cas.
  ctx.globalCompositeOperation = 'source-over';
  const r = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${g === 'naturel' ? 0.18 : 0.38})`);
  ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number | string, size: number, maxW: number) {
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) { size = Math.floor(size * (maxW / w)); ctx.font = `${weight} ${size}px ${family}`; }
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── Motions ────────────────────────────────────────────────────────────────

function drawMotion(ctx: CanvasRenderingContext2D, W: number, H: number, m: Motion, t: number, u: number) {
  const k = (t - m.start) / m.duration; // 0..1
  const outFade = 1 - clamp((k - 0.85) / 0.15);
  ctx.save();
  switch (m.kind) {
    case 'giant': {
      const size = fitFont(ctx, m.text, '"Archivo Black", Impact, sans-serif', 400, H * 0.26, W * 1.6);
      const tw = ctx.measureText(m.text).width;
      const x0 = W + tw / 2, x1 = -tw / 2;
      const p = k < 0.25 ? eo(k / 0.25) * 0.42 : k < 0.75 ? 0.42 + (k - 0.25) * 0.32 : 0.58 + eio((k - 0.75) / 0.25) * 0.42;
      const x = x0 + (x1 - x0) * p, y = H * m.y;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Traînées (flou de mouvement).
      for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.12 * outFade; ctx.fillStyle = m.color; ctx.fillText(m.text, x + i * size * 0.18, y); }
      ctx.globalAlpha = outFade;
      // Relief.
      ctx.fillStyle = '#7a2a08';
      for (let d = Math.round(size * 0.06); d > 0; d -= 2) ctx.fillText(m.text, x + d * 0.5, y + d);
      ctx.fillStyle = m.color; ctx.fillText(m.text, x, y);
      ctx.lineWidth = Math.max(2, size * 0.025); ctx.strokeStyle = '#fff3e8'; ctx.strokeText(m.text, x, y);
      break;
    }
    case 'counter': {
      const target = parseFloat(m.text.replace(',', '.'));
      const n = isFinite(target) ? Math.round(target * eo(k / 0.4)) : NaN;
      const label = isFinite(n) ? m.text.replace(/^[\d.,]+/, String(n)) : m.text;
      const pop = back(k / 0.2);
      const size = fitFont(ctx, label, '"Archivo Black", Impact, sans-serif', 400, u * 0.14, W * 0.8);
      const tw = ctx.measureText(label).width, pad = size * 0.32;
      ctx.translate(W * m.x, H * m.y); ctx.rotate(-0.06); ctx.scale(pop, pop); ctx.globalAlpha = outFade;
      ctx.shadowColor = 'rgba(255,107,44,0.6)'; ctx.shadowBlur = size * 0.5;
      roundRect(ctx, -tw / 2 - pad, -size * 0.7, tw + pad * 2, size * 1.4, size * 0.22); ctx.fillStyle = m.color; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = size * 0.06; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case 'arrow': {
      const sx = W * m.x, sy = H * m.y, tx = W * 0.5 + (m.x < 0.5 ? -W * 0.06 : W * 0.06), ty = H * 0.42;
      const cx = (sx + tx) / 2, cy = Math.min(sy, ty) - H * 0.12;
      const draw = eo(k / 0.35);
      ctx.globalAlpha = outFade; ctx.strokeStyle = m.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = u * 0.016;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = u * 0.02;
      const steps = 40, last = Math.max(1, Math.round(steps * draw));
      const pt = (s: number) => { const q = s / steps; return [(1 - q) * (1 - q) * sx + 2 * (1 - q) * q * cx + q * q * tx, (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * cy + q * q * ty]; };
      ctx.beginPath(); for (let s = 0; s <= last; s++) { const [x, y] = pt(s); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      if (draw > 0.95) {
        const [x1, y1] = pt(steps - 3), [x2, y2] = pt(steps); const a = Math.atan2(y2 - y1, x2 - x1), L = u * 0.05;
        ctx.beginPath(); ctx.moveTo(x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5)); ctx.stroke();
      }
      break;
    }
    case 'brackets': {
      const close = eo(k / 0.3);
      const bw = W * (0.92 - 0.22 * close), bh = H * (0.6 - 0.14 * close), x = W * m.x - bw / 2, y = H * m.y - bh / 2, L = u * 0.07;
      ctx.globalAlpha = outFade * (0.4 + 0.6 * close); ctx.strokeStyle = m.color; ctx.lineWidth = u * 0.008; ctx.lineCap = 'square';
      const corner = (px: number, py: number, dx: number, dy: number) => { ctx.beginPath(); ctx.moveTo(px, py + dy * L); ctx.lineTo(px, py); ctx.lineTo(px + dx * L, py); ctx.stroke(); };
      corner(x, y, 1, 1); corner(x + bw, y, -1, 1); corner(x, y + bh, 1, -1); corner(x + bw, y + bh, -1, -1);
      if (k < 0.12) { ctx.globalAlpha = (1 - k / 0.12) * 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = outFade; ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(x + u * 0.03, y + u * 0.03, u * 0.01, 0, Math.PI * 2); ctx.fill();
      ctx.font = `600 ${Math.round(u * 0.026)}px "IBM Plex Mono", monospace`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
      ctx.fillText('REC', x + u * 0.05, y + u * 0.031);
      break;
    }
    case 'tag': {
      const inK = eo(k / 0.2);
      const size = Math.round(u * 0.05);
      ctx.font = `800 ${size}px Montserrat, sans-serif`;
      const label = m.text.toUpperCase(), tw = ctx.measureText(label).width, pad = size * 0.55;
      const x = W * m.x + (1 - inK) * (m.x < 0.5 ? -W * 0.4 : W * 0.4), y = H * m.y;
      ctx.globalAlpha = outFade; ctx.translate(x, y); ctx.rotate(m.x < 0.5 ? -0.07 : 0.07);
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size * 0.6; ctx.shadowOffsetY = size * 0.15;
      roundRect(ctx, -tw / 2 - pad, -size * 0.85, tw + pad * 2, size * 1.7, size * 0.85);
      const g = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0); g.addColorStop(0, '#7c3aed'); g.addColorStop(1, m.color); ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.lineWidth = size * 0.08; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, size * 0.05);
      break;
    }
  }
  ctx.restore();
}

// ── Sous-titres ────────────────────────────────────────────────────────────

const LOOKS: Record<CaptionLook, { family: string; weight: number; size: number; upper: boolean }> = {
  orange: { family: 'Montserrat, sans-serif', weight: 900, size: 0.085, upper: true },
  jaune: { family: '"Archivo Black", sans-serif', weight: 400, size: 0.07, upper: false },
  neon: { family: 'Montserrat, sans-serif', weight: 800, size: 0.075, upper: true },
  sobre: { family: 'Inter, sans-serif', weight: 700, size: 0.06, upper: false },
};

function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, c: CaptionGroup, t: number, look: CaptionLook, u: number) {
  const L = LOOKS[look];
  const base = Math.round(u * L.size);
  const y = H * (H > W ? 0.7 : 0.8);
  const words = c.words.map((w) => ({ ...w, text: L.upper ? w.text.toUpperCase() : w.text }));
  // Mise en page : une ou deux lignes, le mot fort plus grand.
  const sizeOf = (w: { emphasis: boolean }) => (w.emphasis ? base * 1.35 : base);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const measure = (w: { text: string; emphasis: boolean }) => { ctx.font = `${L.weight} ${sizeOf(w)}px ${L.family}`; return ctx.measureText(w.text).width; };
  const space = base * 0.28, maxW = W * 0.86;
  const lines: { items: typeof words; w: number; h: number }[] = [{ items: [], w: 0, h: 0 }];
  for (const w of words) {
    const mw = measure(w), line = lines[lines.length - 1];
    if (line.items.length && line.w + space + mw > maxW) lines.push({ items: [], w: 0, h: 0 });
    const l = lines[lines.length - 1]; l.w += (l.items.length ? space : 0) + mw; l.h = Math.max(l.h, sizeOf(w)); l.items.push(w);
  }
  let scaleDown = 1; for (const l of lines) if (l.w > maxW) scaleDown = Math.min(scaleDown, maxW / l.w);
  const totalH = lines.reduce((s, l) => s + l.h * 1.08, 0) * scaleDown;
  let cy = y - totalH / 2;
  const enter = back((t - c.start) / 0.16, 1.6);
  for (const l of lines) {
    cy += l.h * 1.08 * scaleDown;
    let x = W / 2 - (l.w * scaleDown) / 2;
    if (look === 'jaune') {
      ctx.save(); const pad = base * 0.22 * scaleDown;
      ctx.translate(W / 2, cy - l.h * 0.35 * scaleDown); ctx.scale(enter, enter); ctx.rotate(-0.015);
      ctx.fillStyle = '#ffd23f'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = base * 0.3;
      roundRect(ctx, -(l.w * scaleDown) / 2 - pad, -l.h * 0.62 * scaleDown, l.w * scaleDown + pad * 2, l.h * 1.08 * scaleDown, base * 0.12); ctx.fill();
      ctx.restore();
    }
    for (const w of l.items) {
      const s = sizeOf(w) * scaleDown; ctx.font = `${L.weight} ${s}px ${L.family}`;
      const ww = ctx.measureText(w.text).width;
      const spoken = t >= w.start - 0.02;
      const pop = spoken ? back((t - w.start) / 0.14, 2) : 0.0;
      const alpha = look === 'jaune' ? 1 : spoken ? 1 : 0.0;
      ctx.save();
      ctx.translate(x + ww / 2, cy); const sc = look === 'jaune' ? enter : Math.max(0.001, 0.6 + 0.4 * pop) * (w.emphasis && spoken ? 1 + 0.06 * Math.sin(Math.min(1, (t - w.start) / 0.3) * Math.PI) : 1);
      ctx.scale(sc, sc); ctx.globalAlpha = alpha; ctx.textAlign = 'center';
      if (look === 'orange') {
        ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#140904'; ctx.strokeText(w.text, 0, 0);
        if (w.emphasis) { ctx.fillStyle = '#7a2a08'; ctx.fillText(w.text, s * 0.03, s * 0.06); }
        ctx.fillStyle = w.emphasis ? ORANGE : '#ffffff'; ctx.fillText(w.text, 0, 0);
      } else if (look === 'jaune') {
        ctx.fillStyle = w.emphasis ? '#c2410c' : '#111'; ctx.fillText(w.text, 0, 0);
      } else if (look === 'neon') {
        ctx.shadowColor = w.emphasis ? '#f0abfc' : '#67e8f9'; ctx.shadowBlur = s * 0.45;
        ctx.fillStyle = w.emphasis ? '#f5d0fe' : '#ecfeff'; ctx.fillText(w.text, 0, 0); ctx.fillText(w.text, 0, 0);
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = s * 0.25; ctx.fillStyle = '#fff'; ctx.fillText(w.text, 0, 0);
        if (w.emphasis) { ctx.shadowBlur = 0; ctx.fillStyle = ORANGE; ctx.fillRect(-ww / 2, s * 0.12, ww * clamp((t - w.start) / 0.25), s * 0.08); }
      }
      ctx.restore();
      x += ww + space * scaleDown;
    }
  }
  ctx.restore();
}

/** Dessine l'image du montage à l'instant t (temps de sortie). */
export function drawMontageFrame(ctx: CanvasRenderingContext2D, W: number, H: number, p: Plan, t: number, o: DrawOpts) {
  const u = Math.min(W, H) * (H > W ? 1 : 0.85) + Math.max(W, H) * 0.12;
  ctx.save();
  ctx.fillStyle = '#0b0b0e'; ctx.fillRect(0, 0, W, H);
  if (o.video) drawVideo(ctx, W, H, p, t, o.video);
  for (const m of p.motions) if (t >= m.start && t <= m.start + m.duration && (m.kind === 'giant' || m.kind === 'brackets')) drawMotion(ctx, W, H, m, t, u);
  const cap = p.captions.find((c) => t >= c.start && t < c.end);
  if (cap) drawCaption(ctx, W, H, cap, t, o.look, u);
  for (const m of p.motions) if (t >= m.start && t <= m.start + m.duration && m.kind !== 'giant' && m.kind !== 'brackets') drawMotion(ctx, W, H, m, t, u);
  ctx.restore();
}

export const OUTPUT_SIZES = {
  '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350],
} as const;
