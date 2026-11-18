import { describe, expect, it } from 'vitest';
import { toSrt, toVtt } from '@/lib/subtitles';
import { extractJson, normalizeScenes, sceneCountFor } from '@/lib/engines/script-shared';
import { offlineScript } from '@/lib/engines/offline-writer';
import { buildTimeline, defaultBrief, estimateWordTimings, newProject, rebuildCaptions, syncTimeline } from '@/lib/project';
import { timelineDuration } from '@/lib/render/compose';
import { estimateCost } from '@/lib/engines/catalog';
import { ALL_STYLES, resolveStyle } from '@/lib/styles/registry';
import { buildCustomStyle } from '@/lib/styles/custom';
import { makeSfx } from '@/lib/audio/sfx';
import { generateMusic } from '@/lib/audio/music';
import { SR } from '@/lib/audio/dsp';

const brief = defaultBrief({ idea: 'Expliquer le recyclage du plastique aux enfants', subject: 'Le recyclage', durationSec: 30, language: 'fr-BE' });

describe('script', () => {
  it('offline writer gives a complete storyboard of the requested length', () => {
    const scenes = normalizeScenes(offlineScript(brief, 'Keynote'), brief);
    expect(scenes.length).toBe(sceneCountFor(30));
    const total = scenes.reduce((a, s) => a + s.duration, 0);
    expect(Math.abs(total - 30)).toBeLessThan(1.5);
    for (const s of scenes) { expect(s.onScreenText.length).toBeGreaterThan(0); expect(s.id).toBeTruthy(); }
  });
  it('extracts JSON wrapped in prose or code fences', () => {
    const raw = extractJson('Voici :\n```json\n{"title":"T","scenes":[{"title":"a","narration":"b","onScreenText":"c","visual":"d","duration":5}]}\n```');
    expect(raw.title).toBe('T');
    expect(raw.scenes.length).toBe(1);
  });
});

describe('timeline', () => {
  const p = newProject('test', brief);
  p.scenes = normalizeScenes(offlineScript(brief, 'Keynote'), brief);
  p.timeline = buildTimeline(p);
  it('lays the scenes end to end', () => {
    let t = 0;
    for (const c of p.timeline.video) { expect(c.start).toBeCloseTo(t, 5); t += c.duration; }
    expect(timelineDuration(p)).toBeCloseTo(t, 5);
  });
  it('a scene grows to fit a longer narration', () => {
    const q = structuredClone(p);
    q.scenes[0].voice = { assetId: 'a1', duration: 12, words: [], engine: 'edge', voice: 'x', textHash: 'h' };
    syncTimeline(q);
    expect(q.timeline.video[0].duration).toBeGreaterThanOrEqual(12.4);
    expect(q.timeline.voice[0].assetId).toBe('a1');
  });
  it('captions follow the narration and split by max words', () => {
    const caps = rebuildCaptions(p);
    expect(caps.length).toBeGreaterThan(0);
    for (const c of caps) { expect(c.end).toBeGreaterThan(c.start); expect(c.words.length).toBeLessThanOrEqual(p.captionStyle.maxWords); }
  });
  it('estimates word timings inside the given span', () => {
    const w = estimateWordTimings('un deux trois quatre', 2, 10);
    expect(w[0].start).toBe(10);
    expect(w[w.length - 1].end).toBeLessThanOrEqual(12);
  });
});

describe('subtitles export', () => {
  const caps = [{ id: '1', start: 1.5, end: 3.25, text: 'Bonjour', words: [] }, { id: '2', start: 65, end: 3725.5, text: 'Au revoir', words: [] }];
  it('SRT', () => { expect(toSrt(caps)).toContain('00:00:01,500 --> 00:00:03,250'); expect(toSrt(caps)).toContain('01:02:05,500'); });
  it('VTT', () => { expect(toVtt(caps).startsWith('WEBVTT')).toBe(true); expect(toVtt(caps)).toContain('00:01:05.000'); });
});

describe('costs', () => {
  it('free engines cost nothing, paid ones do', () => {
    expect(estimateCost('procedural', 10)).toBe(0);
    expect(estimateCost('edge', 10)).toBe(0);
    expect(estimateCost('fal', 10)).toBeGreaterThan(0);
    expect(estimateCost('elevenlabs', 1)).toBeGreaterThan(0);
  });
});

describe('styles', () => {
  it('has 110 unique styles and none of the excluded Lemo ones', () => {
    const ids = ALL_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(110);
    expect(ids).not.toContain('living-screencast');
    expect(ids).not.toContain('my-style');
  });
  it('builds a custom style from the form', () => {
    const s = buildCustomStyle({ name: 'Ma marque', baseStyleId: 'dark-keynote', colors: ['#000000', '#ffffff', '#ff0000', '#00ff00'], displayFont: 'Oswald', bodyFont: 'Inter', promptHints: 'pastel', referenceImages: [] }, resolveStyle('dark-keynote'), 'custom-1');
    expect(s.palette.accent[0]).toBe('#ff0000');
    expect(s.fonts.display).toBe('Oswald');
    expect(s.origin).toBe('custom');
    expect(s.prompt).toContain('pastel');
  });
});

describe('audio synthesis', () => {
  it('music has the exact requested length and is not silent', () => {
    const m = generateMusic({ mood: 'upbeat', duration: 4, seed: 3 });
    expect(m.length).toBe(Math.round(4 * SR));
    let peak = 0; for (let i = 0; i < m.length; i++) peak = Math.max(peak, Math.abs(m.L[i]));
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  });
  it('every sound effect renders', () => {
    for (const t of ['whoosh', 'impact', 'riser', 'click', 'pop', 'ding', 'swoosh', 'boom', 'shimmer', 'typing'] as const) expect(makeSfx(t).length).toBeGreaterThan(100);
  });
});
