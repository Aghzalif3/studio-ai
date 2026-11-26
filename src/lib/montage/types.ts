// Montage automatique : types partagés (navigateur, tests).
// Deux horloges : le temps « source » (dans la vidéo importée) et le temps « sortie »
// (après les coupes). Les éléments posés sur la timeline sont en temps de sortie.

import type { SfxType } from '../types';

export interface SrcWord { text: string; start: number; end: number } // temps source

/** Morceau de la vidéo source gardé au montage. */
export interface Segment { id: string; srcStart: number; srcEnd: number; outStart: number }

export interface Cut { id: string; agent: string; srcStart: number; srcEnd: number; reason: 'silence' | 'hesitation' }

export interface OutWord { text: string; start: number; end: number; emphasis: boolean }

export interface CaptionGroup { id: string; agent: string; start: number; end: number; words: OutWord[] }

export type MotionKind = 'giant' | 'counter' | 'arrow' | 'brackets' | 'tag';
export interface Motion {
  id: string;
  agent: string;
  kind: MotionKind;
  start: number;
  duration: number;
  text: string;
  /** Position du centre, 0..1 dans l'image. */
  x: number;
  y: number;
  color: string;
  seed: number;
}

export interface SfxCue { id: string; agent: string; kind: SfxType; at: number; gainDb: number; label: string }

export interface ZoomCue { id: string; agent: string; start: number; duration: number; amount: number; x: number; y: number }

export type CaptionLook = 'orange' | 'jaune' | 'neon' | 'sobre';
export type OutputAspect = '9:16' | '16:9' | '1:1' | '4:5';
export type Grade = 'cine-orange' | 'naturel' | 'contraste' | 'noir-blanc';

export interface MontageSettings {
  aspect: OutputAspect;
  captionLook: CaptionLook;
  cutSilences: boolean;
  cutHesitations: boolean;
  minSilence: number;       // secondes
  motionDensity: number;    // 0..1
  sfx: boolean;
  sfxGainDb: number;
  zooms: boolean;
  grade: Grade;
  wordsPerCaption: number;
}

export const DEFAULT_SETTINGS: MontageSettings = {
  aspect: '9:16',
  captionLook: 'orange',
  cutSilences: true,
  cutHesitations: true,
  minSilence: 0.45,
  motionDensity: 0.6,
  sfx: true,
  sfxGainDb: -10,
  zooms: true,
  grade: 'cine-orange',
  wordsPerCaption: 3,
};

/** Le montage complet : tout ce que la timeline et le rendu affichent. */
export interface Plan {
  sourceDuration: number;
  duration: number;          // durée de sortie
  segments: Segment[];
  cuts: Cut[];
  captions: CaptionGroup[];
  motions: Motion[];
  sfx: SfxCue[];
  zooms: ZoomCue[];
  crop: { x: number; y: number }; // centre de recadrage 0..1 (agent cadrage)
  grade: Grade;
}

export const emptyPlan = (sourceDuration: number): Plan => ({
  sourceDuration,
  duration: sourceDuration,
  segments: sourceDuration > 0 ? [{ id: 'seg_0', srcStart: 0, srcEnd: sourceDuration, outStart: 0 }] : [],
  cuts: [],
  captions: [],
  motions: [],
  sfx: [],
  zooms: [],
  crop: { x: 0.5, y: 0.45 },
  grade: 'naturel',
});

export type TrackId = 'v1' | 'v2' | 't1' | 'z1' | 'a1' | 'a2';

/** Une action d'agent : appliquée une par une pour que le montage se construise en direct. */
export type AgentAction =
  | { agent: string; type: 'cut'; item: Cut; log: string }
  | { agent: string; type: 'caption'; item: CaptionGroup; log: string }
  | { agent: string; type: 'motion'; item: Motion; log: string }
  | { agent: string; type: 'sfx'; item: SfxCue; log: string }
  | { agent: string; type: 'zoom'; item: ZoomCue; log: string }
  | { agent: string; type: 'crop'; item: { x: number; y: number }; log: string }
  | { agent: string; type: 'grade'; item: Grade; log: string }
  | { agent: string; type: 'note'; log: string };
