// Built-in starting points. They pre-fill the creation wizard; the script is then written by the chosen engine.
import type { Brief } from './types';

export interface BuiltinTemplate { id: string; name: { fr: string; en: string }; description: { fr: string; en: string }; brief: Partial<Brief> }

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: 'tiktok-ad', name: { fr: 'Pub TikTok (15 s)', en: 'TikTok Ad (15 s)' },
    description: { fr: 'Accroche en 2 secondes, bénéfice, preuve, appel à l’action. Vertical, sous-titres percutants.', en: '2-second hook, benefit, proof, CTA. Vertical, punchy captions.' },
    brief: { mode: 'ad', platform: 'tiktok', aspect: '9:16', durationSec: 15, styleId: 'futuristic-ui', musicMood: 'electronic', tone: 'Énergique', audience: '18–34 ans' } },
  { id: 'reels-ad', name: { fr: 'Pub Instagram Reels (30 s)', en: 'Instagram Reels Ad (30 s)' },
    description: { fr: 'Format vertical premium pour Reels : problème, solution, démonstration, offre.', en: 'Premium vertical Reels: problem, solution, demo, offer.' },
    brief: { mode: 'ad', platform: 'reels', aspect: '9:16', durationSec: 30, styleId: 'luxury-ad', musicMood: 'upbeat', tone: 'Premium' } },
  { id: 'shorts-explainer', name: { fr: 'YouTube Shorts explicatif', en: 'YouTube Shorts explainer' },
    description: { fr: 'Une idée expliquée en 45 secondes, avec chiffres animés.', en: 'One idea explained in 45 seconds, with animated figures.' },
    brief: { mode: 'tiktok', platform: 'shorts', aspect: '9:16', durationSec: 45, styleId: 'dataviz', musicMood: 'lofi', tone: 'Pédagogique' } },
  { id: 'classic-ad', name: { fr: 'Spot publicitaire classique (30 s)', en: 'Classic commercial (30 s)' },
    description: { fr: 'Spot horizontal cinématographique, voix off grave, signature de marque.', en: 'Cinematic horizontal spot, deep voice-over, brand sign-off.' },
    brief: { mode: 'ad', platform: 'ads', aspect: '16:9', durationSec: 30, styleId: 'cinematic-realism', musicMood: 'cinematic', narration: 'male', tone: 'Inspirant' } },
  { id: 'youtube-intro', name: { fr: 'Vidéo YouTube (90 s)', en: 'YouTube video (90 s)' },
    description: { fr: 'Présentation structurée en chapitres pour YouTube.', en: 'Structured chapter-based YouTube video.' },
    brief: { mode: 'youtube', platform: 'youtube', aspect: '16:9', durationSec: 90, styleId: 'documentary', musicMood: 'ambient', tone: 'Informatif' } },
  { id: 'whiteboard-lesson', name: { fr: 'Cours au tableau blanc', en: 'Whiteboard lesson' },
    description: { fr: 'Explication dessinée, idéale pour l’école ou la formation.', en: 'Drawn explanation, ideal for school or training.' },
    brief: { mode: 'text', platform: 'youtube', aspect: '16:9', durationSec: 60, styleId: 'whiteboard', musicMood: 'lofi', tone: 'Pédagogique', audience: 'Étudiants' } },
  { id: 'animated-story', name: { fr: 'Histoire animée', en: 'Animated story' },
    description: { fr: 'Petite histoire en 3 actes dans un style dessin animé.', en: 'Short three-act story in a cartoon style.' },
    brief: { mode: 'animation', platform: 'youtube', aspect: '16:9', durationSec: 60, styleId: 'midcentury-toon', musicMood: 'upbeat', tone: 'Ludique' } },
  { id: 'linkedin-pitch', name: { fr: 'Pitch LinkedIn (carré)', en: 'LinkedIn pitch (square)' },
    description: { fr: 'Présentation d’entreprise ou de projet en format carré.', en: 'Company or project pitch in square format.' },
    brief: { mode: 'video', platform: 'linkedin', aspect: '1:1', durationSec: 45, styleId: 'swiss-motion', musicMood: 'corporate', tone: 'Professionnel' } },
];
