// Script schema, prompt and normalisation shared by every text engine.
import type { Brief, CameraMove, Scene, SceneLayout, SfxType, TransitionType } from '../types';
import { uid } from '../util';

export interface RawScene {
  title?: string; layout?: string; visual?: string; onScreenText?: string; narration?: string; duration?: number;
  camera?: string; transition?: string; music?: string; sfx?: string[]; keywords?: string[];
}
export interface RawScript { title?: string; scenes: RawScene[]; characters?: { name: string; description: string }[] }

const LAYOUTS: SceneLayout[] = ['title', 'statement', 'list', 'stat', 'quote', 'cta', 'image'];
const CAMERAS: CameraMove[] = ['static', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'orbit', 'shake', 'dolly-zoom'];
const TRANSITIONS: TransitionType[] = ['cut', 'fade', 'crossfade', 'slide-left', 'slide-up', 'zoom', 'wipe', 'glitch', 'flash', 'blur'];
const SFX: SfxType[] = ['whoosh', 'impact', 'riser', 'click', 'pop', 'ding', 'swoosh', 'boom', 'shimmer', 'typing'];

export const LANG_NAMES: Record<string, string> = {
  'fr-FR': 'français (France)', 'fr-BE': 'français de Belgique (utilise septante, nonante)', 'fr-CA': 'français (Canada)',
  'fr-CH': 'français (Suisse)', 'en-US': 'English (US)', 'en-GB': 'English (UK)', 'es-ES': 'español (España)',
  'es-MX': 'español (México)', 'ar-SA': 'العربية الفصحى', 'ar-MA': 'العربية (المغرب)',
};

export function sceneCountFor(durationSec: number) {
  return Math.max(3, Math.min(14, Math.round(durationSec / 5.5)));
}

export function buildPrompt(b: Brief, styleName: string): { system: string; user: string } {
  const n = sceneCountFor(b.durationSec);
  const lang = LANG_NAMES[b.language] ?? b.language;
  const system = `You are a senior video director and scriptwriter. You turn a brief into a complete short-video script, scene by scene.
Return ONLY valid JSON, no markdown, matching:
{"title": string, "characters": [{"name": string, "description": string}], "scenes": [{"title": string, "layout": one of ${JSON.stringify(LAYOUTS)}, "visual": string (English image prompt, concrete subject, composition, lighting; no text in image), "onScreenText": string (max 9 words, in the video language), "narration": string (spoken voice-over in the video language, natural, ~2.6 words per second of scene), "duration": number (seconds), "camera": one of ${JSON.stringify(CAMERAS)}, "transition": one of ${JSON.stringify(TRANSITIONS)}, "music": string (music intention), "sfx": array of ${JSON.stringify(SFX)}, "keywords": string[] (1-3 words of onScreenText/narration to highlight)}]}
Rules: first scene is a strong hook in the first 2 seconds; the last scene is a call to action or memorable ending; durations sum to the target; "list" scenes put items separated by \\n in onScreenText; "stat" scenes start onScreenText with the number; never reuse protected characters, brands or logos unless they are the user's own product.`;
  const ad = b.ad && (b.mode === 'ad' || b.ad.product)
    ? `\nADVERTISING MODE. Product/company: ${b.ad.product}. Brand: ${b.ad.brand}. Unique selling point: ${b.ad.usp}. Offer: ${b.ad.offer}. Call to action: ${b.ad.cta}. Structure: hook → problem → product as solution → benefits/proof → offer → call to action.`
    : '';
  const user = `Brief:
- Idea: ${b.idea}
- Subject: ${b.subject || '(from idea)'}
- Target duration: ${b.durationSec} seconds, about ${n} scenes
- Audience: ${b.audience}
- Platform: ${b.platform} (format ${b.aspect})
- Visual style: ${styleName}
- Tone: ${b.tone}
- Video language for onScreenText and narration: ${lang}
- Narration: ${b.narration === 'none' ? 'no voice-over: leave narration short (it becomes subtitles only)' : b.narration + ' voice'}
- Music mood: ${b.musicMood}${ad}`;
  return { system, user };
}

export function extractJson(text: string): RawScript {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Le moteur n’a pas renvoyé de JSON exploitable.');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(obj.scenes) || !obj.scenes.length) throw new Error('Le scénario renvoyé ne contient aucune scène.');
  return obj;
}

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

export function normalizeScenes(raw: RawScript, b: Brief): Scene[] {
  const scenes = raw.scenes.slice(0, 30).map((s, i): Scene => ({
    id: uid('s_'),
    title: String(s.title ?? `Scène ${i + 1}`).slice(0, 80),
    layout: pick(s.layout, LAYOUTS, i === 0 ? 'title' : 'statement'),
    visual: String(s.visual ?? '').slice(0, 800),
    onScreenText: String(s.onScreenText ?? '').slice(0, 220),
    narration: String(s.narration ?? '').slice(0, 1200),
    duration: Math.max(1.5, Math.min(30, Number(s.duration) || b.durationSec / raw.scenes.length)),
    camera: pick(s.camera, CAMERAS, 'push-in'),
    transition: pick(s.transition, TRANSITIONS, 'crossfade'),
    music: String(s.music ?? ''),
    sfx: (Array.isArray(s.sfx) ? s.sfx : []).filter((x): x is SfxType => SFX.includes(x as SfxType)).slice(0, 3),
    keywords: (Array.isArray(s.keywords) ? s.keywords : []).map(String).slice(0, 4),
  }));
  // scale durations to the target length
  const total = scenes.reduce((a, s) => a + s.duration, 0);
  const k = b.durationSec / total;
  scenes.forEach((s) => (s.duration = Math.round(Math.max(1.5, s.duration * k) * 10) / 10));
  return scenes;
}
