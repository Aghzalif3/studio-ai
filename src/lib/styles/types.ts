export type Background =
  | 'gradient' | 'paper' | 'whiteboard' | 'chalkboard' | 'blueprint' | 'grid-dark' | 'halftone' | 'pixel'
  | 'crt' | 'film' | 'sunburst' | 'stars' | 'neon-city' | 'miniature' | 'clay' | 'papercut' | 'luxury'
  | 'swiss' | 'cinematic' | 'anime-sky' | 'iso' | 'data' | 'contour' | 'watercolor' | 'glass' | 'hud';

export type Motif =
  | 'none' | 'shapes' | 'particles' | 'bokeh' | 'brush' | 'confetti' | 'chart' | 'orbits' | 'waves'
  | 'blocks' | 'scan' | 'sprites' | 'clouds' | 'lines' | 'rays' | 'doodles' | 'blobs' | 'bars';

export type TextTreatment =
  | 'clean' | 'bold-shadow' | 'handwritten' | 'pixel' | 'neon' | 'serif' | 'stamp' | 'mono' | 'outline' | 'gold';

export interface PostFx {
  grain: number;        // 0..1
  vignette: number;     // 0..1
  scanlines: number;    // 0..1
  chromatic: number;    // 0..1
  tiltShift: number;    // 0..1
  sepia: number;        // 0..1
  flicker: number;      // 0..1
  pixelate: number;     // 0 = off, else block size relative to 1080p
  saturation: number;   // 1 = neutral
  contrast: number;     // 1 = neutral
  bloom: number;        // 0..1
  letterbox: number;    // 0..1 (bars height fraction of 12%)
}

export interface StylePalette { bg: [string, string, string]; ink: string; muted: string; accent: [string, string] }

export interface StyleDef {
  id: string;
  name: { fr: string; en: string };
  category: string;     // category key, see CATEGORIES
  description: { fr: string; en: string };
  uses: string[];
  palette: StylePalette;
  background: Background;
  motif: Motif;
  text: TextTreatment;
  fonts: { display: string; body: string };
  post: PostFx;
  motion: { energy: number; stepFps: number }; // stepFps 0 = smooth; 12 = animate on twos
  prompt: string;       // appended to image prompts (Studio AI's own wording)
  negative?: string;
  origin: 'studio' | 'lemo' | 'custom';
  lemoSlug?: string;
  needsImageGen?: boolean;
  featured?: boolean;
  logo?: string;        // data URL (custom styles)
  references?: string[];
}

export const NO_POST: PostFx = {
  grain: 0, vignette: 0, scanlines: 0, chromatic: 0, tiltShift: 0, sepia: 0, flicker: 0,
  pixelate: 0, saturation: 1, contrast: 1, bloom: 0, letterbox: 0,
};

export const CATEGORIES: { id: string; fr: string; en: string }[] = [
  { id: 'featured', fr: 'Sélection Studio', en: 'Studio picks' },
  { id: 'Edit & Documentary', fr: 'Montage & documentaire', en: 'Edit & Documentary' },
  { id: 'Painting & Illustration', fr: 'Peinture & illustration', en: 'Painting & Illustration' },
  { id: 'Sketch & Board', fr: 'Croquis & tableau', en: 'Sketch & Board' },
  { id: 'Traditional Crafts', fr: 'Arts traditionnels', en: 'Traditional Crafts' },
  { id: 'Print & Printmaking', fr: 'Impression & gravure', en: 'Print & Printmaking' },
  { id: 'Graphic & Type', fr: 'Graphisme & typographie', en: 'Graphic & Type' },
  { id: 'Line Diagrams', fr: 'Schémas au trait', en: 'Line Diagrams' },
  { id: 'Cartoons', fr: 'Dessin animé', en: 'Cartoons' },
  { id: 'Games', fr: 'Jeux vidéo', en: 'Games' },
  { id: 'Film & Tape', fr: 'Pellicule & bande', en: 'Film & Tape' },
  { id: 'Screens & Interfaces', fr: 'Écrans & interfaces', en: 'Screens & Interfaces' },
  { id: 'Light & Lines', fr: 'Lumière & lignes', en: 'Light & Lines' },
  { id: '3D & Miniature', fr: '3D & miniature', en: '3D & Miniature' },
  { id: 'Instruments & Evidence', fr: 'Instruments & preuves', en: 'Instruments & Evidence' },
  { id: 'Data & Maps', fr: 'Données & cartes', en: 'Data & Maps' },
  { id: 'Cinema & Ads', fr: 'Cinéma & publicité', en: 'Cinema & Ads' },
  { id: 'custom', fr: 'Mes styles', en: 'My styles' },
];
