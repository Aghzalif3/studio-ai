// On-screen text layouts and typographic treatments.
import { back, clamp, eo, rgba, seg, mix, luminance, mulberry } from '../util';
import type { StyleDef } from '../styles/types';
import type { SceneLayout } from '../types';
import type { Ctx } from './env';

export const fontStack = (family: string) => {
  const fallbacks = family === 'Noto Naskh Arabic' ? 'serif' : `"Noto Naskh Arabic", system-ui, sans-serif`;
  return `"${family}", ${fallbacks}`;
};

export interface Line { words: string[]; width: number }

export function wrap(g: Ctx, text: string, maxW: number): Line[] {
  const out: Line[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur: string[] = [];
    for (const wd of words) {
      const test = [...cur, wd].join(' ');
      if (cur.length && g.measureText(test).width > maxW) { out.push({ words: cur, width: g.measureText(cur.join(' ')).width }); cur = [wd]; }
      else cur.push(wd);
    }
    if (cur.length) out.push({ words: cur, width: g.measureText(cur.join(' ')).width });
  }
  return out;
}

/** Largest font size (px) at which `text` fits in maxW × maxH. */
export function fitText(g: Ctx, text: string, font: (px: number) => string, maxW: number, maxH: number, maxPx: number, minPx: number, lineH = 1.12) {
  // Wide pixel fonts read much larger than their em size.
  if (font(10).includes('Press Start')) { maxPx *= 0.55; minPx *= 0.6; }
  let px = maxPx;
  while (px > minPx) {
    g.font = font(px);
    const lines = wrap(g, text, maxW);
    const tooWide = lines.some((l) => l.width > maxW * 1.02);
    if (!tooWide && lines.length * px * lineH <= maxH) return { px, lines };
    px *= 0.92;
  }
  g.font = font(minPx);
  return { px: minPx, lines: wrap(g, text, maxW) };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}%€$]/gu, '');

export function isKeyword(word: string, keywords: string[]) {
  const n = norm(word); if (!n) return false;
  return keywords.some((k) => { const kn = norm(k); return kn.length > 1 && (n === kn || (kn.length > 4 && n.startsWith(kn))); });
}

interface PaintOpts { color: string; accent: string; dark: string; onImage: boolean; px: number; u: number }

function paintWord(g: Ctx, style: StyleDef, word: string, x: number, y: number, o: PaintOpts, highlighted: boolean) {
  const fill = highlighted ? o.accent : o.color;
  const tt = style.text;
  g.lineJoin = 'round';
  if (o.onImage && tt !== 'outline' && tt !== 'neon') {
    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = o.px * 0.25; g.shadowOffsetY = o.px * 0.04;
  }
  switch (tt) {
    case 'bold-shadow':
      g.fillStyle = o.dark; g.fillText(word, x + o.px * 0.06, y + o.px * 0.07);
      g.fillStyle = fill; g.fillText(word, x, y); break;
    case 'pixel':
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(word, x + o.px * 0.1, y + o.px * 0.1);
      g.fillStyle = fill; g.fillText(word, x, y); break;
    case 'neon':
      g.shadowColor = highlighted ? o.accent : style.palette.accent[1]; g.shadowBlur = o.px * 0.45;
      g.fillStyle = highlighted ? o.accent : '#ffffff'; g.fillText(word, x, y); g.fillText(word, x, y); break;
    case 'outline':
      g.strokeStyle = o.dark; g.lineWidth = o.px * 0.14; g.strokeText(word, x, y);
      g.fillStyle = highlighted ? o.accent : '#ffffff'; g.fillText(word, x, y); break;
    case 'gold': {
      const gr = g.createLinearGradient(0, y - o.px, 0, y + o.px * 0.2);
      gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.5, style.palette.accent[0]); gr.addColorStop(1, '#8a6a1f');
      g.fillStyle = highlighted ? '#ffffff' : gr; g.fillText(word, x, y); break;
    }
    case 'stamp':
      g.fillStyle = fill; g.globalAlpha *= 0.95; g.fillText(word, x, y); break;
    default:
      g.fillStyle = fill; g.fillText(word, x, y);
  }
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
}

export interface SceneTextArgs {
  g: Ctx; w: number; h: number; t: number; dur: number; text: string; layout: SceneLayout; keywords: string[];
  style: StyleDef; onImage: boolean; seed: number;
}

/** Draws the scene's on-screen text with entrance animation. */
export function drawSceneText(a: SceneTextArgs) {
  const { g, w, h, t, dur, layout, keywords, style, onImage, seed } = a;
  let text = (a.text || '').trim();
  if (!text) return;
  const P = style.palette, u = Math.min(w, h) / 1080, portrait = h > w * 1.1;
  const upper = style.text === 'stamp' || style.fonts.display === 'Bebas Neue' || style.fonts.display === 'Oswald' || style.fonts.display === 'Archivo Black';
  const bgLum = luminance(P.bg[1]);
  let color = onImage ? '#ffffff' : P.ink;
  const dark = onImage ? 'rgba(0,0,0,0.75)' : (bgLum > 0.5 ? mix(P.ink, '#000000', 0.3) : '#000000');
  const accent = P.accent[0];
  const out = 1 - eo(seg(t, dur - 0.35, dur));
  const stepped = style.motion.stepFps ? Math.floor(t * style.motion.stepFps) / style.motion.stepFps : t;
  const T = stepped;
  const display = style.fonts.display, body = style.fonts.body;
  const weight = display === 'Inter' || display === 'Montserrat' || display === 'Space Grotesk' || display === 'Fredoka' ? 800 : display === 'Playfair Display' || display === 'Cinzel' ? 700 : 400;
  const fd = (px: number) => `${weight} ${px}px ${fontStack(display)}`;
  const fb = (px: number) => `500 ${px}px ${fontStack(body)}`;
  g.save();
  g.textBaseline = 'alphabetic';
  if (upper && layout !== 'list') text = text.toUpperCase();

  if (onImage && layout !== 'image') {
    const gr = g.createLinearGradient(0, h * 0.35, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.62 * out})`);
    g.fillStyle = gr; g.fillRect(0, h * 0.35, w, h * 0.65);
  }

  const marginX = w * (portrait ? 0.09 : 0.1);
  const boxW = w - marginX * 2;
  const rr = mulberry(seed);

  const drawLines = (lines: Line[], px: number, font: (p: number) => string, x0: number, y0: number, align: 'left' | 'center', delay0: number, stagger: number, lineH = 1.12) => {
    g.font = font(px);
    const space = g.measureText(' ').width;
    let wi = 0;
    lines.forEach((ln, li) => {
      let x = align === 'center' ? x0 + (boxW - ln.width) / 2 : x0;
      const y = y0 + li * px * lineH;
      for (const wd of ln.words) {
        const d = delay0 + wi * stagger;
        const p = clamp((T - d) / 0.45);
        const ap = style.motion.energy > 0.55 ? back(p, 2.2) : eo(p);
        if (p > 0) {
          g.save();
          g.globalAlpha = clamp(p * 2) * out;
          const dy = (1 - ap) * px * 0.5;
          const ww = g.measureText(wd).width;
          if (style.text === 'handwritten' || style.text === 'stamp') {
            g.translate(x + ww / 2, y + dy); g.rotate((rr() - 0.5) * (style.text === 'stamp' ? 0.08 : 0.04)); g.translate(-(x + ww / 2), -(y + dy));
          }
          paintWord(g, style, wd, x, y + dy, { color, accent, dark, onImage, px, u }, isKeyword(wd, keywords));
          g.restore();
          x += ww + space;
        } else x += g.measureText(wd).width + space;
        wi++;
      }
    });
    return wi;
  };

  switch (layout) {
    case 'title': {
      const { px, lines } = fitText(g, text, fd, boxW, h * 0.42, (portrait ? 150 : 170) * u, 34 * u, 1.05);
      const totalH = lines.length * px * 1.05;
      const y0 = h / 2 - totalH / 2 + px * 0.82;
      drawLines(lines, px, fd, marginX, y0, 'center', 0.1, 0.07, 1.05);
      const ul = eo(seg(T, 0.5, 1.1)) * out;
      g.fillStyle = accent; g.globalAlpha = 1;
      const lw = Math.min(boxW * 0.3, 240 * u) * ul;
      g.fillRect(w / 2 - lw / 2, y0 + totalH - px * 0.55, lw, Math.max(4, 8 * u));
      break;
    }
    case 'statement':
    case 'image': {
      const isImg = layout === 'image';
      const maxPx = (isImg ? 64 : portrait ? 100 : 104) * u;
      const { px, lines } = fitText(g, text, fd, boxW, h * (isImg ? 0.22 : 0.5), maxPx, 28 * u, 1.12);
      const totalH = lines.length * px * 1.12;
      const y0 = isImg ? h * (portrait ? 0.66 : 0.7) - totalH + px  /* above the caption zone */ : h / 2 - totalH / 2 + px * 0.85;
      if (isImg) color = '#ffffff';
      drawLines(lines, px, fd, marginX, y0, portrait || isImg ? 'center' : 'left', 0.15, 0.06, 1.12);
      break;
    }
    case 'list': {
      const items = text.split(/\n|•|;|\s-\s/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
      const head = items.length > 1 ? null : items[0];
      const list = head ? [head] : items;
      const px = Math.min((portrait ? 64 : 62) * u, (h * 0.62) / Math.max(1, list.length) / 1.5);
      g.font = fb(px);
      const yStart = h / 2 - (list.length * px * 1.5) / 2 + px;
      list.forEach((it, i) => {
        const d = 0.2 + i * 0.35, p = eo(seg(T, d, d + 0.5));
        if (p <= 0) return;
        const y = yStart + i * px * 1.5;
        g.globalAlpha = p * out;
        g.fillStyle = accent;
        g.beginPath(); g.arc(marginX + px * 0.3 - (1 - p) * 30 * u, y - px * 0.32, px * 0.18, 0, Math.PI * 2); g.fill();
        const lines = wrap(g, upper ? it.toUpperCase() : it, boxW - px * 1.2);
        g.font = `600 ${px}px ${fontStack(body)}`;
        paintWord(g, style, lines.map((l) => l.words.join(' ')).join(' '), marginX + px * 0.9 - (1 - p) * 30 * u, y, { color, accent, dark, onImage, px, u }, isKeyword(it.split(' ')[0], keywords));
      });
      break;
    }
    case 'stat': {
      const m = text.match(/([-+]?\d[\d\s.,]*\s?(%|€|\$|k|M|millions?|milliards?|x)?)/i);
      const num = m ? m[1].trim() : text.split(' ')[0];
      const rest = m ? text.replace(m[1], '').trim() : text.split(' ').slice(1).join(' ');
      // count-up for numbers
      const p = eo(seg(T, 0.1, 1.2));
      const numVal = parseFloat(num.replace(/\s/g, '').replace(',', '.'));
      let shown = num;
      if (!Number.isNaN(numVal) && Math.abs(numVal) < 1e9) {
        const dec = (num.split(/[.,]/)[1] || '').replace(/\D/g, '').length;
        const suffix = num.replace(/^[-+]?[\d\s.,]+/, '');
        shown = (numVal * p).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      }
      const big = fitText(g, num, fd, boxW, h * 0.32, (portrait ? 260 : 280) * u, 60 * u, 1);
      g.font = fd(big.px); g.globalAlpha = out;
      const nw = g.measureText(shown).width;
      paintWord(g, style, shown, w / 2 - nw / 2, h * 0.5, { color: accent, accent, dark, onImage, px: big.px, u }, false);
      if (rest) {
        const small = fitText(g, rest, fb, boxW, h * 0.2, 56 * u, 22 * u, 1.2);
        g.font = fb(small.px);
        small.lines.forEach((ln, i) => {
          const pp = eo(seg(T, 0.6 + i * 0.1, 1.1 + i * 0.1));
          g.globalAlpha = pp * out; g.fillStyle = color;
          if (onImage) { g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12 * u; }
          g.fillText(ln.words.join(' '), w / 2 - ln.width / 2, h * 0.5 + small.px * 1.4 + i * small.px * 1.2 + (1 - pp) * 20 * u);
        });
      }
      break;
    }
    case 'quote': {
      const qf = (px: number) => `italic 600 ${px}px ${fontStack(style.fonts.display === 'Inter' ? 'Playfair Display' : style.fonts.display)}`;
      const { px, lines } = fitText(g, text, qf, boxW * 0.9, h * 0.5, 86 * u, 28 * u, 1.2);
      g.font = `700 ${px * 2.6}px ${fontStack('Playfair Display')}`; g.fillStyle = rgba(accent, 0.8 * out);
      g.fillText('“', marginX, h / 2 - (lines.length * px * 1.2) / 2 + px * 0.6);
      drawLines(lines, px, qf, marginX + boxW * 0.05, h / 2 - (lines.length * px * 1.2) / 2 + px * 1.2, 'left', 0.2, 0.05, 1.2);
      break;
    }
    case 'cta': {
      const { px, lines } = fitText(g, text, fd, boxW * 0.8, h * 0.3, 96 * u, 30 * u, 1.1);
      const totalH = lines.length * px * 1.1;
      const y0 = h * 0.45 - totalH / 2 + px * 0.85;
      drawLines(lines, px, fd, marginX, y0, 'center', 0.1, 0.06, 1.1);
      const bp = back(seg(T, 0.7, 1.2), 2.5) * out;
      if (bp > 0) {
        const pulse = 1 + Math.sin(T * 5) * 0.03;
        const bw = Math.min(boxW * 0.7, 520 * u) * bp * pulse, bh = 96 * u * bp * pulse;
        const bx = w / 2 - bw / 2, by = y0 + totalH + 20 * u;
        g.fillStyle = accent; g.beginPath();
        const rad = bh / 2;
        g.moveTo(bx + rad, by); g.arcTo(bx + bw, by, bx + bw, by + bh, rad); g.arcTo(bx + bw, by + bh, bx, by + bh, rad); g.arcTo(bx, by + bh, bx, by, rad); g.arcTo(bx, by, bx + bw, by, rad); g.closePath(); g.fill();
        g.fillStyle = luminance(accent) > 0.55 ? '#111111' : '#ffffff';
        // Arrow drawn as a path (no dependency on a font glyph).
        const ac = luminance(accent) > 0.55 ? '#111111' : '#ffffff';
        const aw = 44 * u * bp, cx = w / 2 + Math.sin(T * 5) * 4 * u, cy = by + bh / 2;
        g.strokeStyle = ac; g.lineWidth = 7 * u * bp; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(cx - aw / 2, cy); g.lineTo(cx + aw / 2, cy); g.moveTo(cx + aw / 2 - aw * 0.38, cy - aw * 0.38); g.lineTo(cx + aw / 2, cy); g.lineTo(cx + aw / 2 - aw * 0.38, cy + aw * 0.38); g.stroke();
      }
      break;
    }
  }
  g.restore();
}
