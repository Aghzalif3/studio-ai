import path from 'node:path';
import { DATA_DIR } from './paths';
import { readJson, writeJson, withLock } from './jsonfile';

export interface Settings {
  language: 'fr' | 'en';
  engines: { text: string; image: string; video: string; voice: string };
  textModels: { ollama: string; openaiCompat: { provider: string; baseUrl: string; model: string }; anthropic: string };
  imageModels: { fal: string; replicate: string; stability: string; pollinations: string };
  videoModels: { fal: string; replicate: string };
  localUrls: { ollama: string; sdwebui: string };
  quality: 'draft' | 'standard' | 'high';
  video: { resolution: '720p' | '1080p' | '4k'; fps: number; aspect: '16:9' | '9:16' | '1:1' | '4:5' };
  audio: { voiceGainDb: number; musicGainDb: number; sfxGainDb: number; ducking: boolean; loudnessLufs: number };
  confirmPaid: boolean;
  autosaveMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'fr',
  engines: { text: 'offline', image: 'procedural', video: 'local-motion', voice: 'edge' },
  textModels: { ollama: 'llama3.2', openaiCompat: { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' }, anthropic: 'claude-opus-5-5' },
  imageModels: { fal: 'fal-ai/flux/schnell', replicate: 'black-forest-labs/flux-schnell', stability: 'core', pollinations: 'flux' },
  videoModels: { fal: 'fal-ai/ltx-video/image-to-video', replicate: 'wan-video/wan-2.2-i2v-fast' },
  localUrls: { ollama: process.env.OLLAMA_URL || 'http://127.0.0.1:11434', sdwebui: process.env.SD_WEBUI_URL || 'http://127.0.0.1:7860' },
  quality: 'standard',
  video: { resolution: '1080p', fps: 30, aspect: '16:9' },
  audio: { voiceGainDb: 0, musicGainDb: -16, sfxGainDb: -8, ducking: true, loudnessLufs: -14 },
  confirmPaid: true,
  autosaveMs: 800,
};

const FILE = path.join(DATA_DIR, 'settings.json');

function deepMerge<T>(base: T, over: any): T {
  if (!over || typeof over !== 'object') return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k of Object.keys(over)) {
    out[k] = base && typeof (base as any)[k] === 'object' && !Array.isArray((base as any)[k]) ? deepMerge((base as any)[k], over[k]) : over[k];
  }
  return out;
}

export async function getSettings(): Promise<Settings> {
  return deepMerge(DEFAULT_SETTINGS, await readJson<Partial<Settings>>(FILE, {}));
}
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return withLock('settings', async () => {
    const next = deepMerge(await getSettings(), patch);
    await writeJson(FILE, next);
    return next;
  });
}
