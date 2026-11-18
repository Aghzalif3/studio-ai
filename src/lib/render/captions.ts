// Burned-in animated subtitles.
import { back, clamp, eo, rgba } from '../util';
import type { Caption, CaptionStyle } from '../types';
import type { Ctx } from './env';
import { fontStack, isKeyword } from './text';

export function activeCaption(captions: Caption[], t: number) {
  return captions.find((c) => t >= c.start && t < c.end) ?? null;
}

export function drawCaption(g: Ctx, w: number, h: number, t: number, captions: Caption[], cs: CaptionStyle, keywords: string[]) {
  if (!cs.enabled) return;
  const cap = activeCaption(captions, t);
  if (!cap) return;
  const u = Math.min(w, h) / 1080;
  const px = Math.max(14, h * cs.size);
  g.save();
  g.font = `800 ${px}px ${fontStack(cs.font)}`;
  g.textBaseline = 'alphabetic';
  const words = cap.words.length ? cap.words : [{ text: cap.text, start: cap.start, end: cap.end }];
  const texts = words.map((wd) => (cs.uppercase ? wd.text.toUpperCase() : wd.text));
  const space = g.measureText(' ').width;
  const maxW = w * 0.86;
  // wrap into lines
  const lines: { idx: number[]; width: number }[] = [];
  let cur: number[] = [], cw = 0;
  texts.forEach((tx, i) => {
    const ww = g.measureText(tx).width;
    if (cur.length && cw + space + ww > maxW) { lines.push({ idx: cur, width: cw }); cur = [i]; cw = ww; }
    else { cw += (cur.length ? space : 0) + ww; cur.push(i); }
  });
  if (cur.length) lines.push({ idx: cur, width: cw });
  const lh = px * 1.22, total = lines.length * lh;
  const baseY = cs.position === 'top' ? h * 0.14 : cs.position === 'center' ? h * 0.5 - total / 2 : h * 0.86 - total;
  const age = t - cap.start, left = cap.end - t;
  const inP = clamp(age / 0.18), outP = clamp(left / 0.12);
  let globalA = 1, scale = 1;
  if (cs.preset === 'fade' || cs.preset === 'minimal') globalA = Math.min(inP, outP);
  if (cs.preset === 'pop') scale = 0.8 + 0.2 * back(inP, 3);
  if (cs.preset === 'bounce') scale = 1 + 0.08 * Math.sin(clamp(age / 0.3) * Math.PI);

  if (cs.background && cs.preset === 'boxed') {
    const bw = Math.max(...lines.map((l) => l.width)) + px * 0.9;
    g.fillStyle = cs.background; g.globalAlpha = 0.85 * globalA;
    const bx = w / 2 - bw / 2, by = baseY - px * 0.25, bh = total + px * 0.3, rad = px * 0.3;
    g.beginPath(); g.moveTo(bx + rad, by); g.arcTo(bx + bw, by, bx + bw, by + bh, rad); g.arcTo(bx + bw, by + bh, bx, by + bh, rad); g.arcTo(bx, by + bh, bx, by, rad); g.arcTo(bx, by, bx + bw, by, rad); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }

  g.translate(w / 2, baseY + total / 2); g.scale(scale, scale); g.translate(-w / 2, -(baseY + total / 2));
  lines.forEach((ln, li) => {
    let x = w / 2 - ln.width / 2;
    const y = baseY + li * lh + px * 0.95;
    for (const i of ln.idx) {
      const wd = words[i], tx = texts[i], ww = g.measureText(tx).width;
      const spoken = t >= wd.start, current = t >= wd.start && t < wd.end;
      let a = globalA, color = cs.color, dy = 0;
      if (cs.preset === 'karaoke') color = spoken ? cs.highlightColor : cs.color;
      if (cs.preset === 'typewriter') a = spoken ? globalA : 0;
      if (cs.preset === 'pop' || cs.preset === 'bounce') { if (current) { color = cs.highlightColor; dy = -px * 0.08; } }
      if (cs.highlightKeywords && isKeyword(wd.text, keywords)) color = cs.highlightColor;
      if (a > 0) {
        g.globalAlpha = a;
        if (cs.strokeWidth > 0) { g.lineJoin = 'round'; g.strokeStyle = cs.strokeColor; g.lineWidth = cs.strokeWidth * u * 2; g.strokeText(tx, x, y + dy); }
        else { g.shadowColor = rgba('#000000', 0.6); g.shadowBlur = px * 0.25; }
        if (cs.preset === 'karaoke' && current) {
          const p = eo(clamp((t - wd.start) / Math.max(0.05, wd.end - wd.start)));
          g.fillStyle = cs.color; g.fillText(tx, x, y + dy);
          g.save(); g.beginPath(); g.rect(x, y - px, ww * p, px * 1.4); g.clip(); g.fillStyle = cs.highlightColor; g.fillText(tx, x, y + dy); g.restore();
        } else { g.fillStyle = color; g.fillText(tx, x, y + dy); }
        g.shadowColor = 'transparent'; g.shadowBlur = 0;
      }
      x += ww + space;
    }
  });
  g.restore();
}
