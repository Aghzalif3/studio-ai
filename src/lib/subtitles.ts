import type { Caption } from './types';

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');
export function stamp(t: number, sep: ',' | '.') {
  const ms = Math.round(Math.max(0, t) * 1000);
  return `${pad(ms / 3600000)}:${pad((ms / 60000) % 60)}:${pad((ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}
export function toSrt(c: Caption[]) {
  return c.map((x, i) => `${i + 1}\n${stamp(x.start, ',')} --> ${stamp(x.end, ',')}\n${x.text}\n`).join('\n');
}
export function toVtt(c: Caption[]) {
  return 'WEBVTT\n\n' + c.map((x, i) => `${i + 1}\n${stamp(x.start, '.')} --> ${stamp(x.end, '.')}\n${x.text}\n`).join('\n');
}
