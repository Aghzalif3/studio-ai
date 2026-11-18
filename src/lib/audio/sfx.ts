// Procedural sound effects (original synthesis, royalty-free).
import type { SfxType } from '../types';
import { SR, Rng, encodeWav, fm, noise, osc, svfBand, svfHigh, svfLow } from './dsp';

export const SFX_LABELS: Record<SfxType, { fr: string; en: string }> = {
  whoosh: { fr: 'Whoosh', en: 'Whoosh' }, impact: { fr: 'Impact', en: 'Impact' }, riser: { fr: 'Montée', en: 'Riser' },
  click: { fr: 'Clic', en: 'Click' }, pop: { fr: 'Pop', en: 'Pop' }, ding: { fr: 'Ding', en: 'Ding' }, swoosh: { fr: 'Swoosh', en: 'Swoosh' },
  boom: { fr: 'Boom grave', en: 'Sub boom' }, shimmer: { fr: 'Scintillement', en: 'Shimmer' }, typing: { fr: 'Clavier', en: 'Typing' },
};

function norm(x: Float32Array, p = 0.9) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < x.length; i++) x[i] *= p / m; return x; }

export function makeSfx(type: SfxType, seed = 7): Float32Array {
  const rng = new Rng(seed);
  switch (type) {
    case 'whoosh': case 'swoosh': {
      const d = type === 'whoosh' ? 0.7 : 0.4, n = Math.round(d * SR), x = noise(n, rng);
      const y = svfBand(x, (i) => 400 + 3500 * Math.sin((Math.PI * i) / n), 1.4);
      for (let i = 0; i < n; i++) y[i] *= Math.pow(Math.sin((Math.PI * i) / n), 2);
      return norm(y, 0.8);
    }
    case 'impact': {
      const n = Math.round(1.2 * SR), y = new Float32Array(n); let p = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; p += (40 + 80 * Math.exp(-t * 20)) / SR; y[i] = Math.sin(2 * Math.PI * p) * Math.exp(-t * 3.5); }
      const nz = svfLow(noise(n, rng), () => 2500); for (let i = 0; i < n; i++) y[i] += nz[i] * 0.5 * Math.exp(-(i / SR) * 12);
      return norm(y);
    }
    case 'boom': {
      const n = Math.round(2 * SR), y = new Float32Array(n); let p = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; p += (32 + 40 * Math.exp(-t * 6)) / SR; y[i] = Math.tanh(Math.sin(2 * Math.PI * p) * 1.6) * Math.exp(-t * 1.8); }
      return norm(y);
    }
    case 'riser': {
      const d = 2, n = Math.round(d * SR), x = noise(n, rng);
      const y = svfBand(x, (i) => 300 + 6000 * Math.pow(i / n, 2), 3);
      const tone = osc('saw', 1, n); let p = 0; for (let i = 0; i < n; i++) { p += (110 + 660 * Math.pow(i / n, 2)) / SR; tone[i] = (2 * (p % 1) - 1) * 0.15; }
      const t2 = svfLow(tone, () => 3000);
      for (let i = 0; i < n; i++) y[i] = (y[i] + t2[i]) * Math.pow(i / n, 1.6);
      return norm(y, 0.75);
    }
    case 'click': { const n = Math.round(0.05 * SR), y = svfHigh(noise(n, rng), 3000); for (let i = 0; i < n; i++) y[i] *= Math.exp(-i / (SR * 0.004)); return norm(y, 0.7); }
    case 'pop': { const n = Math.round(0.15 * SR), y = new Float32Array(n); let p = 0; for (let i = 0; i < n; i++) { const t = i / SR; p += (300 + 900 * Math.exp(-t * 60)) / SR; y[i] = Math.sin(2 * Math.PI * p) * Math.exp(-t * 30); } return norm(y, 0.8); }
    case 'ding': return norm(fm(1568, 1.5, 2.76, 1.8, 0.6), 0.6);
    case 'shimmer': {
      const n = Math.round(1.8 * SR), y = new Float32Array(n);
      for (let k = 0; k < 14; k++) { const s = fm(1000 + rng.next() * 3000, 1, 3.1, 1, 0.3); const at = Math.round(rng.next() * 0.9 * SR); for (let i = 0; i < s.length && at + i < n; i++) y[at + i] += s[i] * 0.3; }
      return norm(y, 0.5);
    }
    case 'typing': {
      const n = Math.round(1.2 * SR), y = new Float32Array(n);
      for (let k = 0; k < 9; k++) { const at = Math.round((k * 0.12 + rng.next() * 0.04) * SR); const c = svfBand(noise(800, rng), () => 2500 + rng.next() * 1500, 2); for (let i = 0; i < c.length && at + i < n; i++) y[at + i] += c[i] * Math.exp(-i / 120); }
      return norm(y, 0.6);
    }
  }
}

export const sfxWav = (type: SfxType, seed = 7) => encodeWav(makeSfx(type, seed));
