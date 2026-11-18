// Small deterministic helpers. Easing functions and the mulberry32 generator are adapted from
// Lemo-Opuscar core/lib.js (MIT, © 2026 Lemomo / LemoLab) — see THIRD_PARTY_NOTICES.md.

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const seg = (t: number, a: number, b: number) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const ss = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const eio = (t: number) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const eo = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const ei = (t: number) => Math.pow(clamp(t), 3);
export const back = (t: number, s = 1.8) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const spring = (t: number, k = 7, z = 0.35) => {
  t = Math.max(0, t);
  return 1 - Math.exp(-z * k * t) * Math.cos(k * Math.sqrt(1 - z * z) * t * 1.6);
};
export const TAU = Math.PI * 2;

export function mulberry(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u); };

export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function uid(prefix = ''): string {
  const a = new Uint8Array(9);
  globalThis.crypto.getRandomValues(a);
  return prefix + Array.from(a, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex: string, a: number) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
export function mix(h1: string, h2: string, t: number) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function luminance(hex: string) { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

export function formatTime(sec: number, withFrames = false, fps = 30) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  const base = `${m}:${String(r).padStart(2, '0')}`;
  return withFrames ? `${base}.${String(Math.floor((s % 1) * fps)).padStart(2, '0')}` : base;
}
export function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
  return `${(n / 1024 ** 3).toFixed(2)} Go`;
}

/** Date + time in the interface language (Belgian French by default). */
export function formatDate(iso: string, lang: 'fr' | 'en' = 'fr') {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-BE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
