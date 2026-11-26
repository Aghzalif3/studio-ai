import { describe, expect, it } from 'vitest';
import { alignScript, detectSpeech, envelope, outDuration, outToSrc, segmentsFromCuts, silenceCuts, srcToOut, wordsToOut } from '../src/lib/montage/analysis';
import { AGENTS, applyAction, groupWords, planActions } from '../src/lib/montage/agents';
import { DEFAULT_SETTINGS, emptyPlan, type SrcWord } from '../src/lib/montage/types';

// Signal test : parole (bruit fort) de 0,5 à 2 s et de 3,5 à 5 s, silence ailleurs. Durée 6 s.
function fakeAudio(sr = 16000) {
  const x = new Float32Array(sr * 6);
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < x.length; i++) {
    const t = i / sr; const on = (t > 0.5 && t < 2) || (t > 3.5 && t < 5);
    x[i] = rnd() * (on ? 0.8 : 0.002);
  }
  return { x, sr };
}

describe('analyse audio', () => {
  it('détecte les plages de parole et coupe les blancs', () => {
    const { x, sr } = fakeAudio();
    const env = envelope(x, sr);
    const sp = detectSpeech(env);
    expect(sp).toHaveLength(2);
    expect(sp[0][0]).toBeCloseTo(0.5, 1); expect(sp[1][1]).toBeCloseTo(5, 1);
    const cuts = silenceCuts(sp, 6);
    expect(cuts.length).toBe(3); // début, milieu, fin
    const segs = segmentsFromCuts(cuts.map(([a, b]) => ({ srcStart: a, srcEnd: b })), 6);
    expect(segs).toHaveLength(2);
    expect(outDuration(segs)).toBeGreaterThan(3); expect(outDuration(segs)).toBeLessThan(3.8);
  });

  it('convertit temps source ↔ temps de sortie', () => {
    const segs = segmentsFromCuts([{ srcStart: 2, srcEnd: 3 }], 6);
    expect(srcToOut(segs, 1)).toBe(1);
    expect(srcToOut(segs, 2.5)).toBeNull();
    expect(srcToOut(segs, 4)).toBeCloseTo(3);
    expect(outToSrc(segs, 3).src).toBeCloseTo(4);
    const w = wordsToOut(segs, [{ text: 'a', start: 0.5, end: 0.8 }, { text: 'coupé', start: 2.2, end: 2.6 }, { text: 'b', start: 4, end: 4.3 }]);
    expect(w.map((x) => x.text)).toEqual(['a', 'b']);
    expect(w[1].start).toBeCloseTo(3);
  });

  it('aligne un texte collé sur la parole', () => {
    const words = alignScript('Bonjour à tous, voici 48 heures de montage', [[0.5, 2], [3.5, 5]]);
    expect(words).toHaveLength(8);
    expect(words[0].start).toBeCloseTo(0.5);
    for (const w of words) expect(w.end).toBeGreaterThanOrEqual(w.start);
    expect(words[words.length - 1].end).toBeLessThanOrEqual(5.001);
  });
});

describe('agents', () => {
  const words: SrcWord[] = 'Euh aujourd’hui je vais te montrer comment j’ai monté cette vidéo en 48 heures. Le résultat est incroyable ! Regarde ici, ensuite on passe aux sous-titres animés et aux bruitages.'
    .split(' ').map((t, i) => ({ text: t, start: 0.5 + i * 0.32, end: 0.5 + i * 0.32 + 0.26 }));

  it('a 16 agents distincts', () => {
    expect(AGENTS).toHaveLength(16);
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(16);
  });

  it('regroupe les mots en sous-titres courts', () => {
    const g = groupWords(words, 3);
    expect(g.every((x) => x.words.length <= 3)).toBe(true);
    expect(g.flatMap((x) => x.words).length).toBe(words.length);
  });

  it('produit un montage complet et déterministe', () => {
    const input = { sourceDuration: 12, words, speech: [[0.5, 10.5]] as [number, number][], silenceCuts: [[0, 0.38]] as [number, number][], settings: DEFAULT_SETTINGS };
    const a1 = planActions(input), a2 = planActions(input);
    expect(a1).toEqual(a2);
    let p = emptyPlan(12);
    for (const a of a1) p = applyAction(p, a);
    expect(p.cuts.some((c) => c.reason === 'hesitation')).toBe(true); // « Euh » retiré
    expect(p.cuts.some((c) => c.reason === 'silence')).toBe(true);
    expect(p.duration).toBeLessThan(12);
    expect(p.captions.length).toBeGreaterThan(5);
    expect(p.captions.flatMap((c) => c.words).some((w) => w.emphasis)).toBe(true);
    expect(p.captions.flatMap((c) => c.words).some((w) => /euh/i.test(w.text))).toBe(false);
    expect(p.motions.some((m) => m.kind === 'counter' && m.text.startsWith('48'))).toBe(true);
    expect(p.motions.some((m) => m.kind === 'arrow')).toBe(true); // « Regarde ici »
    expect(p.sfx.length).toBeGreaterThanOrEqual(p.motions.length);
    // Pas deux motions superposées.
    for (let i = 1; i < p.motions.length; i++) expect(p.motions[i].start).toBeGreaterThanOrEqual(p.motions[i - 1].start + p.motions[i - 1].duration);
    // Tout tient dans la durée du montage.
    for (const m of p.motions) expect(m.start + m.duration).toBeLessThanOrEqual(p.duration + 1e-6);
  });

  it('respecte les réglages (sans bruitages ni zooms)', () => {
    const acts = planActions({ sourceDuration: 12, words, speech: [[0.5, 10.5]], silenceCuts: [], settings: { ...DEFAULT_SETTINGS, sfx: false, zooms: false, cutHesitations: false } });
    expect(acts.some((a) => a.type === 'sfx' || a.type === 'zoom' || a.type === 'cut')).toBe(false);
  });
});
