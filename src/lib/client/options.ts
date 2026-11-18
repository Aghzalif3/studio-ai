// Option lists shared by the wizard and the project settings.
import type { Aspect, MusicMood, NarrationType, Platform, Quality } from '../types';

type O<T> = { value: T; fr: string; en: string }[];
export const PLATFORMS: O<Platform> = [
  { value: 'tiktok', fr: 'TikTok', en: 'TikTok' }, { value: 'reels', fr: 'Instagram Reels', en: 'Instagram Reels' },
  { value: 'shorts', fr: 'YouTube Shorts', en: 'YouTube Shorts' }, { value: 'youtube', fr: 'YouTube', en: 'YouTube' },
  { value: 'instagram', fr: 'Instagram (fil)', en: 'Instagram (feed)' }, { value: 'facebook', fr: 'Facebook', en: 'Facebook' },
  { value: 'linkedin', fr: 'LinkedIn', en: 'LinkedIn' }, { value: 'ads', fr: 'Publicité (TV / web)', en: 'Ad (TV / web)' },
  { value: 'generic', fr: 'Autre', en: 'Other' },
];
export const ASPECTS: O<Aspect> = [
  { value: '9:16', fr: '9:16 vertical', en: '9:16 vertical' }, { value: '16:9', fr: '16:9 horizontal', en: '16:9 landscape' },
  { value: '1:1', fr: '1:1 carré', en: '1:1 square' }, { value: '4:5', fr: '4:5 portrait', en: '4:5 portrait' },
];
export const LANGUAGES: O<string> = [
  { value: 'fr-FR', fr: 'Français (France)', en: 'French (France)' }, { value: 'fr-BE', fr: 'Français (Belgique)', en: 'French (Belgium)' },
  { value: 'fr-CA', fr: 'Français (Canada)', en: 'French (Canada)' }, { value: 'fr-CH', fr: 'Français (Suisse)', en: 'French (Switzerland)' },
  { value: 'en-US', fr: 'Anglais (États-Unis)', en: 'English (US)' }, { value: 'en-GB', fr: 'Anglais (Royaume-Uni)', en: 'English (UK)' },
  { value: 'es-ES', fr: 'Espagnol (Espagne)', en: 'Spanish (Spain)' }, { value: 'es-MX', fr: 'Espagnol (Mexique)', en: 'Spanish (Mexico)' },
  { value: 'ar-SA', fr: 'Arabe (standard)', en: 'Arabic (standard)' }, { value: 'ar-MA', fr: 'Arabe (Maroc)', en: 'Arabic (Morocco)' },
];
export const NARRATIONS: O<NarrationType> = [
  { value: 'female', fr: 'Voix féminine', en: 'Female voice' }, { value: 'male', fr: 'Voix masculine', en: 'Male voice' },
  { value: 'own', fr: 'Ma propre voix', en: 'My own voice' }, { value: 'none', fr: 'Sans narration', en: 'No narration' },
];
export const MOODS: O<MusicMood> = [
  { value: 'cinematic', fr: 'Cinématique', en: 'Cinematic' }, { value: 'epic', fr: 'Épique', en: 'Epic' },
  { value: 'upbeat', fr: 'Dynamique', en: 'Upbeat' }, { value: 'electronic', fr: 'Électronique', en: 'Electronic' },
  { value: 'corporate', fr: 'Entreprise', en: 'Corporate' }, { value: 'ambient', fr: 'Ambiance', en: 'Ambient' },
  { value: 'lofi', fr: 'Lo-fi', en: 'Lo-fi' }, { value: 'none', fr: 'Sans musique', en: 'No music' },
];
export const QUALITIES: O<Quality> = [
  { value: 'draft', fr: 'Brouillon (rapide)', en: 'Draft (fast)' }, { value: 'standard', fr: 'Standard', en: 'Standard' }, { value: 'high', fr: 'Haute qualité', en: 'High quality' },
];
export function opts<T>(o: O<T>, t: (fr: string, en: string) => string) { return o.map((x) => ({ value: x.value, label: t(x.fr, x.en) })); }
