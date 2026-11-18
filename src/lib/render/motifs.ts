// Animated decorative layer per style. Deterministic in (seed, t).
import { mulberry, rgba, TAU, eo, back, clamp, seg, spring } from '../util';
import type { StyleDef } from '../styles/types';
import type { Ctx } from './env';

export function drawMotif(g: Ctx, w: number, h: number, t: number, dur: number, seed: number, style: StyleDef, preview = false) {
  const P = style.palette, u = Math.min(w, h) / 1080, r = mulberry(seed * 7 + 3);
  const e = 0.5 + style.motion.energy;
  const A = P.accent;
  g.save();
  switch (style.motif) {
    case 'shapes': {
      for (let i = 0; i < 7; i++) {
        const delay = i * 0.12, p = back(seg(t, delay, delay + 0.7));
        const x = (i % 2 ? 0.08 + r() * 0.2 : 0.72 + r() * 0.2) * w, y = (0.1 + r() * 0.8) * h;
        const s = (30 + r() * 80) * u * p, rot = t * (r() - 0.5) * e + r() * TAU;
        g.translate(x + Math.sin(t * e + i) * 10 * u, y + Math.cos(t * e * 0.8 + i) * 10 * u); g.rotate(rot);
        g.fillStyle = rgba(A[i % 2], 0.85); g.strokeStyle = P.ink; g.lineWidth = 3 * u;
        const kind = i % 4;
        g.beginPath();
        if (kind === 0) g.arc(0, 0, s / 2, 0, TAU);
        else if (kind === 1) g.rect(-s / 2, -s / 2, s, s);
        else if (kind === 2) { g.moveTo(0, -s / 2); g.lineTo(s / 2, s / 2); g.lineTo(-s / 2, s / 2); g.closePath(); }
        else { for (let k = 0; k < 10; k++) { const rad = k % 2 ? s / 4 : s / 2, a = (k / 10) * TAU; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); }
        g.fill(); if (style.text === 'bold-shadow') g.stroke();
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      break;
    }
    case 'particles': {
      const n = preview ? 40 : 90;
      for (let i = 0; i < n; i++) {
        const x = r() * w, sp = (10 + r() * 30) * u * e, y = ((r() * h - t * sp) % h + h) % h, s = (1 + r() * 3) * u;
        g.fillStyle = rgba(A[i % 2], 0.25 + 0.5 * Math.abs(Math.sin(t * 1.5 + i)));
        g.beginPath(); g.arc(x + Math.sin(t + i) * 8 * u, y, s, 0, TAU); g.fill();
      }
      break;
    }
    case 'bokeh': {
      for (let i = 0; i < 14; i++) {
        const x = (r() * 1.2 - 0.1) * w + Math.sin(t * 0.2 + i) * 30 * u, y = r() * h, R = (30 + r() * 90) * u;
        const gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, rgba(A[i % 2], 0.12)); gr.addColorStop(0.7, rgba(A[i % 2], 0.08)); gr.addColorStop(1, rgba(A[i % 2], 0));
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      }
      break;
    }
    case 'brush': {
      for (let i = 0; i < 5; i++) {
        const p = eo(seg(t, i * 0.25, i * 0.25 + 1.2));
        const y = (0.12 + r() * 0.76) * h, x0 = (r() < 0.5 ? -0.05 : 0.6) * w, len = (0.3 + r() * 0.3) * w * p;
        const width = (14 + r() * 26) * u;
        g.strokeStyle = rgba(A[i % 2], 0.18); g.lineCap = 'round';
        for (let b = 0; b < 4; b++) {
          g.lineWidth = width * (0.4 + b * 0.25);
          g.beginPath(); g.moveTo(x0, y + b * 3 * u);
          g.bezierCurveTo(x0 + len * 0.3, y - 30 * u, x0 + len * 0.6, y + 30 * u, x0 + len, y + b * 2 * u); g.stroke();
        }
      }
      break;
    }
    case 'confetti': {
      for (let i = 0; i < (preview ? 50 : 110); i++) {
        const x = r() * w, fall = (60 + r() * 120) * u * e, y = ((r() * h + t * fall) % (h + 40 * u)) - 20 * u;
        g.translate(x + Math.sin(t * 2 + i) * 20 * u, y); g.rotate(t * (1 + r() * 3) + i);
        g.fillStyle = [A[0], A[1], P.ink, '#ffffff'][i % 4]; g.fillRect(-6 * u, -3 * u, 12 * u, 6 * u);
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      break;
    }
    case 'chart': {
      const n = 8, bw = w * 0.04, base = h * 0.9, x0 = w * 0.62;
      for (let i = 0; i < n; i++) {
        const p = eo(seg(t, 0.2 + i * 0.08, 0.9 + i * 0.08));
        const bh = (0.08 + r() * 0.3) * h * p;
        g.fillStyle = i === n - 2 ? A[0] : rgba(P.ink, 0.18);
        g.fillRect(x0 + i * bw * 1.35, base - bh, bw, bh);
      }
      g.strokeStyle = rgba(A[1], 0.8); g.lineWidth = 3 * u; g.beginPath();
      const pts = 24, prog = eo(seg(t, 0.3, 2));
      for (let i = 0; i <= pts * prog; i++) {
        const x = w * 0.06 + (i / pts) * w * 0.5, y = h * 0.86 - (Math.sin(i * 0.5 + seed) * 0.05 + i / pts * 0.18) * h;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
      break;
    }
    case 'orbits': {
      const cx = w * 0.5, cy = h * 0.5;
      g.lineWidth = 1.5 * u;
      for (let i = 0; i < 4; i++) {
        const R = (180 + i * 110) * u, a = t * 0.3 * e * (i % 2 ? 1 : -1) + i;
        g.strokeStyle = rgba(A[i % 2], 0.18);
        g.beginPath(); g.ellipse(cx, cy, R, R * 0.38, 0.2, 0, TAU); g.stroke();
        const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R * 0.38;
        g.fillStyle = A[i % 2]; g.beginPath(); g.arc(px, py, 5 * u, 0, TAU); g.fill();
      }
      break;
    }
    case 'waves': {
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = rgba(A[k % 2], 0.25); g.lineWidth = (3 - k * 0.6) * u; g.beginPath();
        for (let x = 0; x <= w; x += 10 * u) {
          const y = h * (0.86 + k * 0.035) + Math.sin(x / (120 * u) + t * e * (1 + k * 0.4)) * 14 * u;
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case 'blocks': {
      const s = 46 * u;
      for (let i = 0; i < 6; i++) {
        const p = spring(seg(t, i * 0.12, i * 0.12 + 1.2) * 1.4);
        const x = (i < 3 ? 0.08 + i * 0.06 : 0.78 + (i - 3) * 0.06) * w, y = (0.72 + (i % 2) * 0.08) * h - (1 - clamp(p)) * 200 * u;
        const hgt = s * (1 + (i % 3));
        g.globalAlpha = clamp(p);
        g.fillStyle = A[i % 2]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y - s * 0.58); g.lineTo(x + 2 * s, y); g.lineTo(x + s, y + s * 0.58); g.closePath(); g.fill();
        g.fillStyle = rgba(P.ink, 0.35); g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.58); g.lineTo(x + s, y + s * 0.58 + hgt * 0.4); g.lineTo(x, y + hgt * 0.4); g.closePath(); g.fill();
        g.fillStyle = rgba(P.ink, 0.2); g.beginPath(); g.moveTo(x + 2 * s, y); g.lineTo(x + s, y + s * 0.58); g.lineTo(x + s, y + s * 0.58 + hgt * 0.4); g.lineTo(x + 2 * s, y + hgt * 0.4); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    case 'scan': {
      const y = ((t * 0.35 * e) % 1) * h;
      const gr = g.createLinearGradient(0, y - 80 * u, 0, y);
      gr.addColorStop(0, rgba(A[0], 0)); gr.addColorStop(1, rgba(A[0], 0.22));
      g.fillStyle = gr; g.fillRect(0, y - 80 * u, w, 80 * u);
      g.fillStyle = rgba(A[0], 0.6); g.fillRect(0, y, w, 1.5 * u);
      g.font = `${16 * u}px "IBM Plex Mono", monospace`; g.fillStyle = rgba(A[0], 0.55);
      g.fillText(`REC ● ${t.toFixed(2)}s`, 50 * u, 70 * u);
      g.fillText(`ID ${(seed % 9999).toString().padStart(4, '0')}`, w - 170 * u, 70 * u);
      break;
    }
    case 'sprites': {
      const px = 8 * u, step = Math.floor(t * 6);
      const hero = ['..aaaa..', '.aaaaaa.', '.abbbba.', '.bcbbcb.', '.bbbbbb.', '..dddd..', '.dddddd.', '.d.dd.d.', '..e..e..'];
      const col: Record<string, string> = { a: A[1], b: '#f2c9a0', c: '#222222', d: '#3b5bdb', e: '#5c3c1e' };
      const x0 = ((t * 60 * u) % (w + 100 * u)) - 80 * u, y0 = h * 0.7 - hero.length * px - (step % 2) * px;
      hero.forEach((row, j) => [...row].forEach((ch, i) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(Math.round(x0 + i * px), Math.round(y0 + j * px), px, px); } }));
      // coins
      for (let i = 0; i < 5; i++) {
        const cx = w * (0.15 + i * 0.17), cy = h * 0.5 + Math.sin(t * 3 + i) * 10 * u;
        g.fillStyle = A[0]; g.fillRect(Math.round(cx), Math.round(cy), px * 2, px * 3);
        g.fillStyle = '#fff6b0'; g.fillRect(Math.round(cx), Math.round(cy), px, px);
      }
      break;
    }
    case 'clouds': {
      for (let i = 0; i < 5; i++) {
        const y = (0.1 + r() * 0.35) * h, x = ((r() * w + t * (8 + r() * 14) * u) % (w + 400 * u)) - 200 * u, s = (60 + r() * 60) * u;
        g.fillStyle = 'rgba(255,240,245,0.55)';
        for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + k * s * 0.7, y + (k % 2) * s * 0.15, s, s * 0.45, 0, 0, TAU); g.fill(); }
      }
      break;
    }
    case 'lines': {
      g.lineWidth = 2 * u; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const p = eo(seg(t, i * 0.15, i * 0.15 + 1));
        const y = (0.15 + i * 0.13) * h, x0 = i % 2 ? w * 0.06 : w * 0.7;
        g.strokeStyle = rgba(i % 3 === 0 ? A[0] : P.ink, i % 3 === 0 ? 0.6 : 0.15);
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w * 0.24 * p, y); g.stroke();
        if (p > 0.95) { g.fillStyle = rgba(A[0], 0.8); g.beginPath(); g.arc(x0 + w * 0.24, y, 4 * u, 0, TAU); g.fill(); }
      }
      break;
    }
    case 'rays': {
      const cx = w / 2, cy = h * 0.5;
      g.strokeStyle = rgba(A[0], 0.22); g.lineWidth = 2 * u;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + t * 0.05, R0 = 260 * u, R1 = Math.max(w, h);
        g.beginPath(); g.moveTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); g.lineTo(cx + Math.cos(a) * R1, cy + Math.sin(a) * R1); g.stroke();
      }
      break;
    }
    case 'doodles': {
      g.strokeStyle = rgba(P.ink, 0.65); g.lineWidth = 4 * u; g.lineCap = 'round'; g.lineJoin = 'round';
      // arrow that draws itself
      const p = eo(seg(t, 0.3, 1.3));
      const x0 = w * 0.08, y0 = h * 0.82, x1 = w * 0.26, y1 = h * 0.7;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (x1 - x0) * 0.2, y1 - 40 * u, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p); g.stroke();
      if (p > 0.98) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 22 * u, y1 - 2 * u); g.moveTo(x1, y1); g.lineTo(x1 - 8 * u, y1 + 20 * u); g.stroke(); }
      // circled star
      const q = eo(seg(t, 0.6, 1.6));
      g.strokeStyle = rgba(A[0], 0.85);
      g.beginPath(); g.ellipse(w * 0.86, h * 0.2, 60 * u, 44 * u, -0.2, -Math.PI / 2, -Math.PI / 2 + TAU * q); g.stroke();
      // underline scribble
      g.strokeStyle = rgba(A[1], 0.7);
      const s = eo(seg(t, 0.9, 1.7));
      g.beginPath(); for (let i = 0; i <= 20 * s; i++) { const x = w * 0.7 + i * 10 * u, y = h * 0.88 + Math.sin(i * 1.3) * 6 * u; i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
      break;
    }
    case 'blobs': {
      for (let i = 0; i < 5; i++) {
        const cx = (i % 2 ? 0.1 + r() * 0.15 : 0.75 + r() * 0.17) * w, cy = (0.15 + r() * 0.7) * h, R = (40 + r() * 70) * u;
        const st = style.motion.stepFps ? Math.floor(t * style.motion.stepFps) / style.motion.stepFps : t;
        g.fillStyle = A[i % 2];
        g.shadowColor = 'rgba(0,0,0,0.22)'; g.shadowBlur = 20 * u; g.shadowOffsetY = 10 * u;
        g.beginPath();
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * TAU, rr = R * (1 + 0.12 * Math.sin(a * 3 + st * 1.5 + i) + 0.06 * Math.sin(a * 5 - st + i));
          k === 0 ? g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath(); g.fill();
        g.shadowColor = 'transparent';
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - R * 0.3, cy - R * 0.35, R * 0.28, R * 0.16, -0.5, 0, TAU); g.fill();
      }
      break;
    }
    case 'bars': {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const p = eo(seg(t, i * 0.08, i * 0.08 + 0.6));
        g.fillStyle = i === 2 ? A[0] : rgba(P.ink, 0.9);
        const bh = h * 0.012;
        g.fillRect(w * 0.06, h * (0.08 + i * 0.022), w * (0.1 + (i % 3) * 0.06) * p, bh);
      }
      break;
    }
    default: break;
  }
  g.restore();
  void dur;
}
