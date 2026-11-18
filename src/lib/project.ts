// Project factory, storyboard → timeline builder and caption builder (pure, shared client/server).
import { ALL_STYLES } from './styles/registry';
import type {
  AudioClip, Brief, Caption, CaptionStyle, Project, Scene, SfxType, Timeline, VideoClip, WordTiming,
} from './types';

export const SFX_DURATION: Record<SfxType, number> = {
  whoosh: 0.7, swoosh: 0.4, impact: 1.2, boom: 2, riser: 2, click: 0.05, pop: 0.15, ding: 1.5, shimmer: 1.8, typing: 1.2,
};
/** Library sounds are referenced as `lib:sfx:<type>` and generated on demand by the server. */
export const sfxAssetId = (t: SfxType) => `lib:sfx:${t}`;
import { uid } from './util';

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  enabled: true, preset: 'karaoke', font: 'Montserrat', size: 0.045, color: '#ffffff', highlightColor: '#a78bfa',
  strokeColor: '#000000', strokeWidth: 5, background: 'rgba(0,0,0,0.55)', position: 'bottom', uppercase: false,
  maxWords: 5, highlightKeywords: true,
};

export function platformDefaults(platform: Brief['platform']): Pick<Brief, 'aspect'> & { captions: Partial<CaptionStyle> } {
  switch (platform) {
    case 'tiktok': case 'reels': case 'shorts':
      return { aspect: '9:16', captions: { preset: 'pop', uppercase: true, size: 0.042, position: 'center', maxWords: 3 } };
    case 'instagram': return { aspect: '1:1', captions: { preset: 'karaoke', maxWords: 4 } };
    case 'facebook': return { aspect: '4:5', captions: { preset: 'boxed', maxWords: 5 } };
    default: return { aspect: '16:9', captions: { preset: 'karaoke', maxWords: 7, size: 0.05 } };
  }
}

export function defaultBrief(partial: Partial<Brief> = {}): Brief {
  return {
    mode: 'video', idea: '', subject: '', durationSec: 30, audience: 'Grand public', platform: 'youtube',
    styleId: 'dark-keynote', aspect: '16:9', language: 'fr-FR', narration: 'female', musicMood: 'cinematic',
    quality: 'standard', tone: 'Inspirant', validateStoryboard: true, ...partial,
  };
}

export function emptyTimeline(fps = 30): Timeline {
  return { fps, video: [], effects: [], voice: [], music: [], sfx: [], captions: [], edited: false };
}

export function newProject(name: string, brief: Brief): Project {
  const now = new Date().toISOString();
  const plat = platformDefaults(brief.platform);
  return {
    id: uid('p_'), name: name || 'Projet sans titre', createdAt: now, updatedAt: now, brief,
    scenes: [], characters: [], timeline: emptyTimeline(30),
    captionStyle: { ...DEFAULT_CAPTION_STYLE, ...plat.captions },
    voiceSettings: { engine: 'edge', voice: defaultVoiceFor(brief.language, brief.narration), rate: 0, pitch: 0 },
    musicSettings: { mood: brief.musicMood, gainDb: -16, ducking: true, seed: Math.floor(Math.random() * 1e6) },
    assets: [], storyboardValidated: false, generationSeconds: 0,
  };
}

export function defaultVoiceFor(lang: string, narration: Brief['narration']) {
  const male = narration === 'male';
  const map: Record<string, [string, string]> = {
    'fr-FR': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
    'fr-BE': ['fr-BE-CharlineNeural', 'fr-BE-GerardNeural'],
    'fr-CA': ['fr-CA-SylvieNeural', 'fr-CA-AntoineNeural'],
    'fr-CH': ['fr-CH-ArianeNeural', 'fr-CH-FabriceNeural'],
    'en-US': ['en-US-AriaNeural', 'en-US-GuyNeural'],
    'en-GB': ['en-GB-SoniaNeural', 'en-GB-RyanNeural'],
    'es-ES': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
    'es-MX': ['es-MX-DaliaNeural', 'es-MX-JorgeNeural'],
    'ar-SA': ['ar-SA-ZariyahNeural', 'ar-SA-HamedNeural'],
    'ar-MA': ['ar-MA-MounaNeural', 'ar-MA-JamalNeural'],
  };
  const pair = map[lang] ?? map['fr-FR'];
  return male ? pair[1] : pair[0];
}

/** Split narration into caption cues using word timings (or estimated timings). */
export function buildCaptions(scenes: Scene[], starts: Map<string, number>, maxWords: number): Caption[] {
  const out: Caption[] = [];
  for (const s of scenes) {
    const base = starts.get(s.id) ?? 0;
    const words: WordTiming[] = s.voice?.words?.length && s.voice.textHash === textHash(s.narration)
      ? s.voice.words : estimateWordTimings(s.narration, Math.max(0.5, (s.voice?.duration ?? s.duration) - 0.2), 0.1);
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).map((w) => ({ ...w, start: w.start + base, end: w.end + base }));
      if (!chunk.length) continue;
      const nextStart = words[i + maxWords] ? words[i + maxWords].start + base : chunk[chunk.length - 1].end + 0.25;
      out.push({ id: uid('c_'), start: chunk[0].start, end: Math.min(nextStart, base + s.duration), text: chunk.map((w) => w.text).join(' '), words: chunk });
    }
  }
  return out;
}

export function estimateWordTimings(text: string, dur: number, offset = 0): WordTiming[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const weights = words.map((w) => 1 + w.replace(/[^\p{L}\p{N}]/gu, '').length + (/[.,;:!?]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = offset;
  return words.map((w, i) => { const d = (weights[i] / total) * dur; const r = { text: w, start: t, end: t + d * 0.92 }; t += d; return r; });
}

export function textHash(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return String(h >>> 0);
}

/** Rebuilds the timeline from the storyboard. Music & manual SFX/effects are kept. */
export function buildTimeline(p: Project, keepAudio = true): Timeline {
  const fps = p.timeline?.fps ?? 30;
  const video: VideoClip[] = [];
  const voice: AudioClip[] = [];
  const sfx: AudioClip[] = [];
  const starts = new Map<string, number>();
  let t = 0;
  p.scenes.forEach((s, i) => {
    const dur = Math.max(1, s.voice ? Math.max(s.duration, s.voice.duration + 0.4) : s.duration);
    starts.set(s.id, t);
    video.push({
      id: uid('v_'), sceneId: s.id, start: t, duration: dur, srcIn: 0, speed: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0,
      filter: 'none', transition: { type: i === 0 ? 'cut' : s.transition, duration: s.transition === 'cut' ? 0 : 0.6 },
    });
    s.sfx.forEach((fx, k) => {
      const d = SFX_DURATION[fx] ?? 1;
      const at = fx === 'riser' ? Math.max(0, t - d + 0.1) : Math.max(0, t - (fx === 'whoosh' || fx === 'swoosh' ? 0.25 : 0) + k * 0.05);
      sfx.push({ id: uid('x_'), assetId: sfxAssetId(fx), label: fx, start: at, duration: d, srcIn: 0, gainDb: -6, speed: 1, fadeIn: 0, fadeOut: 0.05, sceneId: s.id });
    });
    if (s.voice && p.brief.narration !== 'none') {
      voice.push({ id: uid('a_'), assetId: s.voice.assetId, label: `Voix ${i + 1}`, start: t + 0.15, duration: s.voice.duration, srcIn: 0, gainDb: 0, speed: 1, fadeIn: 0, fadeOut: 0.05, sceneId: s.id });
    }
    t += dur;
  });
  const old = p.timeline ?? emptyTimeline(fps);
  const total = t;
  const music = keepAudio ? old.music.map((m) => ({ ...m, duration: Math.min(m.duration, total), start: 0 })) : [];
  const keepSfx = old.sfx.filter((s) => !s.sceneId && s.start < total);
  return {
    fps, video, voice, music, sfx: [...keepSfx, ...sfx], effects: old.effects.filter((e) => e.start < total),
    captions: buildCaptions(p.scenes, new Map([...starts].map(([k, v]) => [k, v + 0.15])), p.captionStyle.maxWords),
    edited: false,
  };
}

export function rebuildCaptions(p: Project): Caption[] {
  const starts = new Map<string, number>();
  for (const c of [...p.timeline.video].sort((a, b) => a.start - b.start)) if (c.sceneId && !starts.has(c.sceneId)) starts.set(c.sceneId, c.start + 0.15);
  const scenes = p.scenes.filter((s) => starts.has(s.id));
  return buildCaptions(scenes, starts, p.captionStyle.maxWords);
}

export function knownStyleIds() { return new Set(ALL_STYLES.map((s) => s.id)); }

/** Keeps the timeline in sync with the storyboard. Hand-edited timelines only get their voice clips refreshed. */
export function syncTimeline(p: Project) {
  if (!p.timeline.edited) { p.timeline = buildTimeline(p); return; }
  for (const s of p.scenes) {
    const clip = p.timeline.video.find((c) => c.sceneId === s.id);
    if (!clip) continue;
    const vc = p.timeline.voice.find((v) => v.sceneId === s.id);
    if (s.voice) {
      if (vc) { vc.assetId = s.voice.assetId; vc.duration = s.voice.duration; }
      else p.timeline.voice.push({ id: uid('a_'), assetId: s.voice.assetId, label: s.title, start: clip.start + 0.15, duration: s.voice.duration, srcIn: 0, gainDb: 0, speed: 1, fadeIn: 0, fadeOut: 0.05, sceneId: s.id });
    }
  }
  p.timeline.captions = rebuildCaptions(p);
}

