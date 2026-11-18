// Core domain types shared by the browser and the server.

export type Aspect = '9:16' | '16:9' | '1:1' | '4:5';
export type Platform = 'tiktok' | 'reels' | 'shorts' | 'youtube' | 'instagram' | 'facebook' | 'linkedin' | 'ads' | 'generic';
export type CreationMode = 'video' | 'text' | 'image' | 'ad' | 'tiktok' | 'youtube' | 'animation' | 'blank';
export type Quality = 'draft' | 'standard' | 'high';
export type NarrationType = 'female' | 'male' | 'none' | 'own';
export type MusicMood = 'cinematic' | 'ambient' | 'upbeat' | 'electronic' | 'corporate' | 'lofi' | 'epic' | 'none';
export type SceneLayout = 'title' | 'statement' | 'list' | 'stat' | 'quote' | 'cta' | 'image';

export type CameraMove =
  | 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right'
  | 'tilt-up' | 'tilt-down' | 'orbit' | 'shake' | 'dolly-zoom';

export type TransitionType =
  | 'cut' | 'fade' | 'crossfade' | 'slide-left' | 'slide-up' | 'zoom' | 'wipe' | 'glitch' | 'flash' | 'blur';

export type SfxType = 'whoosh' | 'impact' | 'riser' | 'click' | 'pop' | 'ding' | 'swoosh' | 'boom' | 'shimmer' | 'typing';

export interface Brief {
  mode: CreationMode;
  idea: string;
  subject: string;
  durationSec: number;
  audience: string;
  platform: Platform;
  styleId: string;
  aspect: Aspect;
  language: string; // BCP-47, e.g. fr-BE
  narration: NarrationType;
  musicMood: MusicMood;
  quality: Quality;
  tone: string;
  validateStoryboard: boolean;
  ad?: { product: string; brand: string; offer: string; cta: string; usp: string };
}

export interface WordTiming { text: string; start: number; end: number }

export interface SceneVoice {
  assetId: string;
  duration: number;
  words: WordTiming[];
  engine: string;
  voice: string;
  textHash: string; // narration text the audio was made from
}

export interface Scene {
  id: string;
  title: string;
  layout: SceneLayout;
  visual: string;          // visual description / image prompt
  onScreenText: string;
  narration: string;
  duration: number;        // seconds
  camera: CameraMove;
  transition: TransitionType;
  music: string;           // music cue / intention
  sfx: SfxType[];
  keywords: string[];      // highlighted words
  imageAssetId?: string;
  videoAssetId?: string;
  voice?: SceneVoice;
}

export interface Character { id: string; name: string; description: string; refAssetId?: string }

export interface VideoClip {
  id: string;
  sceneId?: string;        // procedural / storyboard scene
  assetId?: string;        // image or video asset override
  start: number;
  duration: number;
  srcIn: number;           // offset inside a video asset
  speed: number;
  zoom: number;            // 1 = fit
  offsetX: number;         // -1..1 of frame
  offsetY: number;
  rotation: number;        // degrees
  camera?: CameraMove;
  filter: 'none' | 'bw' | 'warm' | 'cool' | 'vivid' | 'fade';
  transition: { type: TransitionType; duration: number };
  text?: string;           // overrides on-screen text
}

export interface AudioClip {
  id: string;
  assetId: string;
  label: string;
  start: number;
  duration: number;
  srcIn: number;
  gainDb: number;
  speed: number;
  fadeIn: number;
  fadeOut: number;
  sceneId?: string;
}

export type EffectType = 'vignette' | 'grain' | 'flash' | 'letterbox' | 'glow' | 'shake' | 'blur' | 'bw' | 'chromatic' | 'zoom-punch';
export interface EffectClip { id: string; type: EffectType; start: number; duration: number; intensity: number }

export interface Caption { id: string; start: number; end: number; text: string; words: WordTiming[] }

export type CaptionPreset = 'karaoke' | 'pop' | 'fade' | 'typewriter' | 'boxed' | 'minimal' | 'bounce';
export interface CaptionStyle {
  enabled: boolean;
  preset: CaptionPreset;
  font: string;
  size: number;            // relative to frame height (0.04 = 4%)
  color: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  background: string;      // '' = none
  position: 'bottom' | 'center' | 'top';
  uppercase: boolean;
  maxWords: number;        // words per caption
  highlightKeywords: boolean;
}

export interface Timeline {
  fps: number;
  video: VideoClip[];
  effects: EffectClip[];
  voice: AudioClip[];
  music: AudioClip[];
  sfx: AudioClip[];
  captions: Caption[];
  edited: boolean;         // true once the user changed the timeline by hand
}

export type AssetKind = 'image' | 'video' | 'audio';
export interface Asset {
  id: string;
  kind: AssetKind;
  file: string;            // file name inside the project's assets folder
  mime: string;
  name: string;
  source: 'upload' | 'generated' | 'synth' | 'tts' | 'recording';
  engine?: string;
  prompt?: string;
  width?: number;
  height?: number;
  duration?: number;
  costUsd?: number;
  createdAt: string;
}

export interface RenderRecord {
  id: string;
  projectId: string;
  projectName: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  resolution: '720p' | '1080p' | '4k';
  fps: number;
  aspect: Aspect;
  width: number;
  height: number;
  file?: string;           // file name in studio-data/renders
  sizeBytes?: number;
  durationSec?: number;
  elapsedSec?: number;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface VoiceSettings { engine: string; voice: string; rate: number; pitch: number }
export interface MusicSettings { mood: MusicMood; gainDb: number; ducking: boolean; seed: number; assetId?: string }

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  brief: Brief;
  scenes: Scene[];
  characters: Character[];
  timeline: Timeline;
  captionStyle: CaptionStyle;
  voiceSettings: VoiceSettings;
  musicSettings: MusicSettings;
  assets: Asset[];
  storyboardValidated: boolean;
  scriptEngine?: string;
  generationSeconds: number; // total time spent generating (stats)
  thumbnailAssetId?: string;
}

export interface CustomStyleInput {
  name: string;
  baseStyleId: string;
  colors: string[];        // [bg, ink, accent, accent2]
  displayFont: string;
  bodyFont: string;
  logoAssetDataUrl?: string;
  promptHints: string;
  referenceImages: string[]; // data URLs (small)
}

export const ASPECT_SIZES: Record<Aspect, Record<'720p' | '1080p' | '4k', [number, number]>> = {
  '16:9': { '720p': [1280, 720], '1080p': [1920, 1080], '4k': [3840, 2160] },
  '9:16': { '720p': [720, 1280], '1080p': [1080, 1920], '4k': [2160, 3840] },
  '1:1': { '720p': [720, 720], '1080p': [1080, 1080], '4k': [2160, 2160] },
  '4:5': { '720p': [720, 900], '1080p': [1080, 1350], '4k': [2160, 2700] },
};

export const PREVIEW_SIZES: Record<Aspect, [number, number]> = {
  '16:9': [960, 540], '9:16': [540, 960], '1:1': [720, 720], '4:5': [640, 800],
};
