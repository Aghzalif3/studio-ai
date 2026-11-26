// Les 16 agents de montage. Chacun est un petit programme spécialisé (pas un modèle de langage) :
// il lit l'analyse de la vidéo (parole, mots, volume) et propose des actions que le studio
// applique une à une sur la timeline, pour que l'on voie le montage se construire en direct.

import type { SfxType } from '../types';
import { normalizeCuts, outDuration, segmentsFromCuts, srcToOut, wordsToOut } from './analysis';
import type { AgentAction, CaptionGroup, Cut, MontageSettings, Motion, MotionKind, OutWord, Plan, SfxCue, SrcWord, ZoomCue } from './types';

export interface AgentDef { id: string; name: string; role: string; color: string; track: 'v1' | 'v2' | 't1' | 'z1' | 'a2' | 'all' }

export const AGENTS: AgentDef[] = [
  { id: 'coupe-01', name: 'Coupe', role: 'Coupe les blancs', color: '#ff6b2c', track: 'v1' },
  { id: 'coupe-02', name: 'Coupe', role: 'Retire les « euh »', color: '#ff9147', track: 'v1' },
  { id: 'rythme-01', name: 'Rythme', role: 'Mesure le débit', color: '#f5c542', track: 'all' },
  { id: 'soustitres-01', name: 'Sous-titres', role: 'Découpe les phrases', color: '#ffd23f', track: 't1' },
  { id: 'soustitres-02', name: 'Sous-titres', role: 'Surligne les mots forts', color: '#ffb020', track: 't1' },
  { id: 'soustitres-03', name: 'Sous-titres', role: 'Découpe les phrases', color: '#e8e05a', track: 't1' },
  { id: 'type-01', name: 'Typo', role: 'Choisit la typographie', color: '#a3e635', track: 't1' },
  { id: 'motion-01', name: 'Motion', role: 'Lettres géantes', color: '#c084fc', track: 'v2' },
  { id: 'motion-02', name: 'Motion', role: 'Compteurs chiffrés', color: '#a78bfa', track: 'v2' },
  { id: 'motion-03', name: 'Motion', role: 'Flèches et étiquettes', color: '#e879f9', track: 'v2' },
  { id: 'motion-04', name: 'Motion', role: 'Cadres de focus', color: '#f472b6', track: 'v2' },
  { id: 'zoom-01', name: 'Zoom', role: 'Zooms d’impact', color: '#38bdf8', track: 'z1' },
  { id: 'cadrage-01', name: 'Cadrage', role: 'Recadre au format', color: '#22d3ee', track: 'v1' },
  { id: 'sfx-01', name: 'Bruitage', role: 'Sons des motions', color: '#3b82f6', track: 'a2' },
  { id: 'sfx-02', name: 'Bruitage', role: 'Ponctuation sonore', color: '#60a5fa', track: 'a2' },
  { id: 'style-01', name: 'Étalonnage', role: 'Couleur et contraste', color: '#fb7185', track: 'v1' },
];
export const agentById = (id: string) => AGENTS.find((a) => a.id === id);

const STOP = new Set(('le la les l un une des de du d et ou à a au aux en dans sur sous par pour avec sans ce cet cette ces se sa son ses mon ma mes ton ta tes notre nos votre vos leur leurs je j tu il elle on nous vous ils elles me m te t lui y ne n pas plus que qu qui quoi est es suis sont été être ai as avons avez ont avait fait faire c s ça ca très bien tout tous toute toutes alors donc mais car si comme quand aussi même encore déjà just the a an of to in on at for and or but is are was were be been it this that these those i you he she we they my your our their me him her them so very can will do does did have has had not no yes').split(' '));
const HESITATION = /^(euh+|heu+|hum+|hmm+|mmh+|bah|ben|um+|uh+|erm+|eh)$/i;
const DEICTIC = /^(regarde[sz]?|ici|voilà|voila|ça|ca|celui-ci|celle-ci|look|here|this|là)$/i;
const NUMBER_WORDS: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000, million: 1e6, millions: 1e6, milliard: 1e9, two: 2, three: 3, five: 5, ten: 10, hundred: 100, thousand: 1000 };

export const clean = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%€$]+$/gu, '');
const isNumber = (w: string) => /\d/.test(w) || clean(w) in NUMBER_WORDS;

/** Score d'importance d'un mot : chiffres, mots longs, noms propres, fin de phrase. */
export function wordScore(w: string, i: number, all: { text: string }[]): number {
  const c = clean(w); if (!c || STOP.has(c) || HESITATION.test(c)) return 0;
  let s = Math.min(c.length, 10) / 10;
  if (isNumber(w)) s += 1.2;
  if (/^\p{Lu}/u.test(w) && i > 0 && !/[.!?]$/.test(all[i - 1]?.text ?? '')) s += 0.5;
  if (/[!?]$/.test(w)) s += 0.4;
  if (c.length >= 7) s += 0.25;
  return s;
}

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Regroupe les mots en sous-titres courts (coupure sur ponctuation, pause ou nombre max). */
export function groupWords(words: { text: string; start: number; end: number }[], maxWords: number): { start: number; end: number; words: { text: string; start: number; end: number }[] }[] {
  const groups: { start: number; end: number; words: { text: string; start: number; end: number }[] }[] = [];
  let cur: { text: string; start: number; end: number }[] = [];
  const flush = () => { if (cur.length) groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur }); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i], prev = cur[cur.length - 1];
    if (prev && (w.start - prev.end > 0.35 || cur.length >= maxWords)) flush();
    cur.push(w);
    if (/[.!?,;:]$/.test(w.text)) flush();
  }
  flush();
  // Chaque sous-titre reste affiché jusqu'au suivant (au plus 0,6 s de plus).
  for (let i = 0; i < groups.length; i++) {
    const next = groups[i + 1];
    groups[i].end = Math.max(groups[i].end, Math.min(next ? next.start : groups[i].end + 0.6, groups[i].end + 0.6));
  }
  return groups;
}

export interface PlanInput { sourceDuration: number; words: SrcWord[]; speech: [number, number][]; silenceCuts: [number, number][]; settings: MontageSettings; seed?: number }

/** Calcule toutes les actions des 16 agents, dans l'ordre où elles seront posées. */
export function planActions(input: PlanInput): AgentAction[] {
  const { settings: st, sourceDuration: D } = input;
  const R = rng(input.seed ?? 42);
  const acts: AgentAction[] = [];
  let n = 0; const id = (p: string) => `${p}_${++n}`;
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  // ── Coupes ────────────────────────────────────────────────────────────────
  const cuts: Cut[] = [];
  if (st.cutSilences) {
    for (const [a, b] of input.silenceCuts) {
      const c: Cut = { id: id('cut'), agent: 'coupe-01', srcStart: a, srcEnd: b, reason: 'silence' };
      cuts.push(c); acts.push({ agent: 'coupe-01', type: 'cut', item: c, log: `coupe ${(b - a).toFixed(1)} s de blanc à ${fmt(a)}` });
    }
  }
  if (st.cutHesitations) {
    for (const w of input.words) if (HESITATION.test(clean(w.text))) {
      const c: Cut = { id: id('cut'), agent: 'coupe-02', srcStart: Math.max(0, w.start - 0.04), srcEnd: Math.min(D, w.end + 0.06), reason: 'hesitation' };
      cuts.push(c); acts.push({ agent: 'coupe-02', type: 'cut', item: c, log: `retire « ${w.text} » à ${fmt(w.start)}` });
    }
  }
  const segs = segmentsFromCuts(cuts, D);
  const dur = outDuration(segs);
  const removed = D - dur;
  if (removed > 0.05) acts.push({ agent: 'coupe-01', type: 'note', log: `montage resserré : ${D.toFixed(1)} s → ${dur.toFixed(1)} s` });

  // ── Cadrage, étalonnage, rythme ──────────────────────────────────────────
  acts.push({ agent: 'cadrage-01', type: 'crop', item: { x: 0.5, y: 0.42 }, log: `recadre en ${st.aspect}, sujet au centre` });
  acts.push({ agent: 'style-01', type: 'grade', item: st.grade, log: `étalonnage « ${GRADE_LABEL[st.grade]} »` });
  const outW = wordsToOut(segs, input.words.filter((w) => !HESITATION.test(clean(w.text))));
  const speechOut = outW.length ? outW[outW.length - 1].end - outW[0].start : 0;
  const wpm = speechOut > 1 ? (outW.length / speechOut) * 60 : 0;
  let maxWords = st.wordsPerCaption;
  if (wpm > 185) maxWords = Math.max(1, maxWords - 1);
  acts.push({ agent: 'rythme-01', type: 'note', log: wpm ? `débit ${Math.round(wpm)} mots/min → ${maxWords} mot${maxWords > 1 ? 's' : ''} par sous-titre` : input.speech.length ? 'pas de texte : sous-titres et motions de mots désactivés' : 'pas de parole détectée' });
  acts.push({ agent: 'type-01', type: 'note', log: `typo « ${LOOK_LABEL[st.captionLook]} »` });

  // ── Sous-titres ──────────────────────────────────────────────────────────
  const scores = outW.map((w, i) => wordScore(w.text, i, outW));
  const groups = groupWords(outW.map((w, i) => ({ ...w, i } as any)), maxWords);
  const captions: CaptionGroup[] = [];
  groups.forEach((g, gi) => {
    const words: OutWord[] = g.words.map((w) => ({ text: w.text, start: w.start, end: w.end, emphasis: false }));
    const cap: CaptionGroup = { id: id('cap'), agent: gi % 2 ? 'soustitres-03' : 'soustitres-01', start: g.start, end: g.end, words };
    captions.push(cap);
    acts.push({ agent: cap.agent, type: 'caption', item: structuredClone(cap), log: `pose « ${g.words.map((w) => w.text).join(' ')} »` });
  });
  // Mot fort : le meilleur score de chaque sous-titre s'il dépasse le seuil.
  let wi = 0;
  for (const cap of captions) {
    let best = -1, bestS = 0.75;
    cap.words.forEach((w, k) => { const s = scores[wi + k] ?? 0; if (s > bestS) { bestS = s; best = k; } });
    wi += cap.words.length;
    if (best >= 0) {
      cap.words[best].emphasis = true;
      acts.push({ agent: 'soustitres-02', type: 'caption', item: structuredClone(cap), log: `surligne « ${clean(cap.words[best].text)} »` });
    }
  }

  // ── Motions ──────────────────────────────────────────────────────────────
  const motions: Motion[] = [];
  const busy = (s: number, d: number) => motions.some((m) => s < m.start + m.duration + 0.4 && s + d + 0.4 > m.start);
  const density = Math.max(0.05, st.motionDensity);
  const pushMotion = (agent: string, kind: MotionKind, start: number, duration: number, text: string, x: number, y: number, color: string, log: string) => {
    if (start < 0 || start + 0.8 > dur || busy(start, duration)) return null;
    const m: Motion = { id: id('mo'), agent, kind, start, duration: Math.min(duration, dur - start), text, x, y, color, seed: Math.floor(R() * 1e6) };
    motions.push(m); acts.push({ agent, type: 'motion', item: m, log }); return m;
  };
  const emph = captions.flatMap((c) => c.words.filter((w) => w.emphasis).map((w) => ({ w, cap: c })));

  // Compteurs : chaque nombre (+ le mot qui suit).
  outW.forEach((w, i) => {
    if (!isNumber(w.text)) return;
    const next = outW[i + 1] && !STOP.has(clean(outW[i + 1].text)) ? ' ' + clean(outW[i + 1].text) : '';
    const label = (clean(w.text) + next).toUpperCase();
    pushMotion('motion-02', 'counter', Math.max(0, w.start - 0.1), 1.6, label, 0.5, 0.3, '#ff6b2c', `pose un compteur « ${label.toLowerCase()} »`);
  });
  // Cadre de focus sur l'accroche (début) puis toutes les ~14 s / densité.
  if (outW.length) pushMotion('motion-04', 'brackets', Math.max(0, outW[0].start), 1.4, 'focus', 0.5, 0.45, '#ffffff', 'cadre l’accroche');
  // Flèches sur les mots qui montrent, étiquettes sur les autres mots forts.
  let lastArrow = -99, side = 0;
  for (const w of outW) {
    if (!DEICTIC.test(clean(w.text)) || w.start - lastArrow < 5 / density) continue;
    const x = side++ % 2 ? 0.74 : 0.26;
    if (pushMotion('motion-03', 'arrow', w.start, 1.3, '', x, 0.55, '#ffd23f', `pose une flèche sur « ${clean(w.text)} »`)) lastArrow = w.start;
  }
  // Lettres géantes : mots forts espacés.
  let lastGiant = -99;
  const giantGap = 7 / density;
  for (const { w } of [...emph].sort((a, b) => a.w.start - b.w.start)) {
    if (w.start - lastGiant < giantGap || isNumber(w.text)) continue;
    if (pushMotion('motion-01', 'giant', Math.max(0, w.start - 0.15), 1.5, clean(w.text).toUpperCase(), 0.5, 0.36, '#ff6b2c', `pose « Lettres géantes traversées » sur « ${clean(w.text)} »`)) lastGiant = w.start;
  }
  let lastTag = -99;
  for (const { w } of emph) {
    if (w.start - lastTag < 9 / density) continue;
    const x = side++ % 2 ? 0.7 : 0.3;
    if (pushMotion('motion-03', 'tag', w.start, 1.5, clean(w.text), x, 0.22, '#c084fc', `pose une étiquette « ${clean(w.text)} »`)) lastTag = w.start;
  }
  for (let t = 14 / density; t < dur - 2; t += 14 / density) {
    const cap = captions.find((c) => c.start >= t);
    if (cap) pushMotion('motion-04', 'brackets', cap.start, 1.2, 'focus', 0.5, 0.45, '#ffffff', `cadre la relance à ${fmt(cap.start)}`);
  }
  motions.sort((a, b) => a.start - b.start);

  // ── Zooms ────────────────────────────────────────────────────────────────
  if (st.zooms) {
    let last = -99, k = 0;
    for (const { w, cap } of emph) {
      if (w.start - last < 3.5 || motions.some((m) => m.kind === 'giant' && Math.abs(m.start - w.start) < 0.8)) continue;
      const z: ZoomCue = { id: id('zm'), agent: 'zoom-01', start: Math.max(0, w.start - 0.05), duration: Math.max(0.6, Math.min(2.2, cap.end - w.start + 0.2)), amount: k++ % 2 ? 1.14 : 1.22, x: 0.5, y: 0.42 };
      acts.push({ agent: 'zoom-01', type: 'zoom', item: z, log: `zoom ×${z.amount.toFixed(2)} sur « ${clean(w.text)} »` }); last = w.start;
    }
  }

  // ── Bruitages ────────────────────────────────────────────────────────────
  if (st.sfx) {
    const motionSfx: Record<MotionKind, [SfxType, string]> = { giant: ['whoosh', 'whoosh'], counter: ['impact', 'impact'], arrow: ['swoosh', 'swoosh'], tag: ['pop', 'pop'], brackets: ['click', 'clic'] };
    for (const m of motions) {
      const [kind, label] = motionSfx[m.kind];
      const at = m.kind === 'giant' ? Math.max(0, m.start - 0.12) : m.start;
      const c: SfxCue = { id: id('fx'), agent: 'sfx-01', kind, at, gainDb: st.sfxGainDb + (kind === 'click' ? -4 : 0), label };
      acts.push({ agent: 'sfx-01', type: 'sfx', item: c, log: `bruitage ${label} sur « ${m.text || m.kind} »` });
    }
    let i = 0;
    for (const { w } of emph) {
      if (motions.some((m) => Math.abs(m.start - w.start) < 0.9)) continue;
      if (i++ % 3) continue;
      const c: SfxCue = { id: id('fx'), agent: 'sfx-02', kind: 'pop', at: w.start, gainDb: st.sfxGainDb - 6, label: 'pop' };
      acts.push({ agent: 'sfx-02', type: 'sfx', item: c, log: `pop sur « ${clean(w.text)} »` });
    }
    if (dur > 3) {
      const c: SfxCue = { id: id('fx'), agent: 'sfx-02', kind: 'shimmer', at: Math.max(0, dur - 1.4), gainDb: st.sfxGainDb - 4, label: 'fin' };
      acts.push({ agent: 'sfx-02', type: 'sfx', item: c, log: 'scintillement de fin' });
    }
  }
  return acts;
}

export const GRADE_LABEL = { 'cine-orange': 'Ciné orange', naturel: 'Naturel', contraste: 'Contrasté', 'noir-blanc': 'Noir et blanc' } as const;
export const LOOK_LABEL = { orange: 'Gros orange', jaune: 'Bloc jaune', neon: 'Néon', sobre: 'Sobre blanc' } as const;

/** Applique une action au plan (immuable). */
export function applyAction(p: Plan, a: AgentAction): Plan {
  switch (a.type) {
    case 'cut': {
      const cuts = [...p.cuts, a.item];
      const segments = segmentsFromCuts(cuts, p.sourceDuration);
      return { ...p, cuts, segments, duration: outDuration(segments) };
    }
    case 'caption': {
      const i = p.captions.findIndex((c) => c.id === a.item.id);
      const captions = i >= 0 ? p.captions.map((c, k) => (k === i ? a.item : c)) : [...p.captions, a.item].sort((x, y) => x.start - y.start);
      return { ...p, captions };
    }
    case 'motion': return { ...p, motions: [...p.motions, a.item].sort((x, y) => x.start - y.start) };
    case 'sfx': return { ...p, sfx: [...p.sfx, a.item].sort((x, y) => x.at - y.at) };
    case 'zoom': return { ...p, zooms: [...p.zooms, a.item].sort((x, y) => x.start - y.start) };
    case 'crop': return { ...p, crop: a.item };
    case 'grade': return { ...p, grade: a.item };
    default: return p;
  }
}

/** Instant (temps sortie) à montrer dans l'aperçu pendant qu'un agent travaille. */
export function actionTime(p: Plan, a: AgentAction): number | null {
  switch (a.type) {
    case 'cut': return srcToOut(p.segments, Math.max(0, a.item.srcStart - 0.05));
    case 'caption': return a.item.start + 0.15;
    case 'motion': return a.item.start + Math.min(0.6, a.item.duration / 2);
    case 'sfx': return a.item.at;
    case 'zoom': return a.item.start + 0.3;
    default: return null;
  }
}

export { normalizeCuts };
