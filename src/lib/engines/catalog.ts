// Engine catalogue shared with the UI: what each engine is, what it costs and what it needs.
// Prices are indicative (checked November 2026) and must be confirmed on the provider's pricing page.

export type EngineKind = 'text' | 'image' | 'video' | 'voice';
export type CostTier = 'free-local' | 'free-online' | 'free-limited' | 'paid';

export interface EngineInfo {
  id: string;
  kind: EngineKind;
  name: string;
  tier: CostTier;
  local: boolean;
  needs?: string;          // secret name
  costNote: { fr: string; en: string };
  unitCostUsd?: number;    // per image / per second of video / per 1000 chars
  unit?: 'image' | 'second' | '1k-chars' | 'script';
  description: { fr: string; en: string };
  setup?: { fr: string; en: string };
  commercialNote?: { fr: string; en: string };
}

export const ENGINES: EngineInfo[] = [
  // ——— Text (script writing)
  { id: 'offline', kind: 'text', name: 'Rédacteur hors-ligne', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit, sans Internet', en: 'Free, offline' },
    description: { fr: 'Construit le scénario par modèles narratifs (accroche, points clés, appel à l’action) à partir de votre idée ou de votre texte. Ce n’est pas une IA : pour un vrai travail d’écriture, utilisez Ollama ou une API.', en: 'Builds the script from narrative templates (hook, key points, call to action) using your idea or text. It is not AI: for real writing use Ollama or an API.' } },
  { id: 'ollama', kind: 'text', name: 'Ollama (local)', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit, tourne sur votre Mac', en: 'Free, runs on your Mac' },
    description: { fr: 'Vrai modèle de langage local (Llama, Mistral, Qwen…).', en: 'Real local language model (Llama, Mistral, Qwen…).' },
    setup: { fr: 'Installer Ollama (ollama.com), puis dans un terminal : ollama pull llama3.2', en: 'Install Ollama (ollama.com), then run: ollama pull llama3.2' } },
  { id: 'pollinations-text', kind: 'text', name: 'Pollinations (texte)', tier: 'free-limited', local: false, needs: 'POLLINATIONS_TOKEN',
    costNote: { fr: 'Gratuit avec limites de débit ; jeton gratuit facultatif', en: 'Free with rate limits; optional free token' },
    description: { fr: 'Service communautaire en ligne, sans compte pour un usage léger. Disponibilité non garantie.', en: 'Community online service, no account for light use. Availability not guaranteed.' } },
  { id: 'openai-compat', kind: 'text', name: 'Groq / OpenRouter / Mistral / OpenAI', tier: 'free-limited', local: false,
    costNote: { fr: 'Groq et OpenRouter (modèles « :free ») ont des offres gratuites limitées ; OpenAI est payant', en: 'Groq and OpenRouter (":free" models) have limited free tiers; OpenAI is paid' },
    unitCostUsd: 0.002, unit: 'script',
    description: { fr: 'Toute API compatible OpenAI. Choisissez le fournisseur dans Paramètres.', en: 'Any OpenAI-compatible API. Pick the provider in Settings.' } },
  { id: 'anthropic', kind: 'text', name: 'Claude (Anthropic)', tier: 'paid', local: false, needs: 'ANTHROPIC_API_KEY',
    costNote: { fr: 'Payant : environ 0,03 à 0,08 $ par scénario avec Claude Opus 5.5 (modèle réglable dans Paramètres)', en: 'Paid: about $0.03–0.08 per script with Claude Opus 5.5 (model configurable in Settings)' }, unitCostUsd: 0.06, unit: 'script',
    description: { fr: 'Écriture de haute qualité, très bon en français.', en: 'High-quality writing, very good in French.' } },

  // ——— Images
  { id: 'procedural', kind: 'image', name: 'Illustration procédurale', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit, instantané', en: 'Free, instant' },
    description: { fr: 'Le moteur de Studio AI dessine chaque scène dans le style choisi (formes, textures, typographie animée). Pas une IA générative.', en: 'Studio AI draws each scene in the chosen style (shapes, textures, animated type). Not generative AI.' } },
  { id: 'pollinations', kind: 'image', name: 'Pollinations (Flux)', tier: 'free-limited', local: false, needs: 'POLLINATIONS_TOKEN',
    costNote: { fr: 'Gratuit avec limites ; vérifier les conditions d’usage commercial', en: 'Free with limits; check commercial-use terms' },
    description: { fr: 'Vraie génération d’images IA en ligne, sans clé pour un usage léger.', en: 'Real online AI image generation, no key for light use.' } },
  { id: 'sdwebui', kind: 'image', name: 'Stable Diffusion local', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit, nécessite un Mac Apple Silicon avec 16 Go conseillés', en: 'Free, Apple Silicon with 16 GB recommended' },
    description: { fr: 'API d’AUTOMATIC1111 / Forge / SD.Next lancé avec --api.', en: 'AUTOMATIC1111 / Forge / SD.Next API started with --api.' },
    setup: { fr: 'Installer Forge ou AUTOMATIC1111, le lancer avec --api, puis vérifier l’adresse dans Paramètres (par défaut http://127.0.0.1:7860).', en: 'Install Forge or AUTOMATIC1111, start it with --api, then check the URL in Settings.' } },
  { id: 'fal', kind: 'image', name: 'fal.ai (Flux)', tier: 'paid', local: false, needs: 'FAL_KEY',
    costNote: { fr: 'Payant : ≈ 0,003 $ par image (Flux schnell), ≈ 0,04 $ avec référence (Kontext)', en: 'Paid: ≈ $0.003 per image (Flux schnell), ≈ $0.04 with reference (Kontext)' }, unitCostUsd: 0.003, unit: 'image',
    description: { fr: 'Rapide et fiable. Supporte une image de référence pour garder un personnage cohérent.', en: 'Fast and reliable. Supports a reference image for character consistency.' } },
  { id: 'replicate', kind: 'image', name: 'Replicate (Flux)', tier: 'paid', local: false, needs: 'REPLICATE_API_TOKEN',
    costNote: { fr: 'Payant : ≈ 0,003 $ par image (Flux schnell)', en: 'Paid: ≈ $0.003 per image (Flux schnell)' }, unitCostUsd: 0.003, unit: 'image',
    description: { fr: 'Accès à des milliers de modèles.', en: 'Access to thousands of models.' } },
  { id: 'stability', kind: 'image', name: 'Stability AI', tier: 'paid', local: false, needs: 'STABILITY_API_KEY',
    costNote: { fr: 'Payant : ≈ 0,03 $ par image (Stable Image Core)', en: 'Paid: ≈ $0.03 per image (Stable Image Core)' }, unitCostUsd: 0.03, unit: 'image',
    description: { fr: 'API officielle de Stability.', en: 'Official Stability API.' } },

  // ——— Video
  { id: 'local-motion', kind: 'video', name: 'Animation locale (caméra 2,5D)', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit', en: 'Free' },
    description: { fr: 'Anime l’image avec des mouvements de caméra (travelling, zoom, panoramique, tremblement) et des transitions. Ne crée pas de nouveau mouvement dans l’image.', en: 'Animates the picture with camera moves and transitions. Does not create new motion inside the picture.' } },
  { id: 'fal-video', kind: 'video', name: 'fal.ai (image → vidéo)', tier: 'paid', local: false, needs: 'FAL_KEY',
    costNote: { fr: 'Payant : de ≈ 0,02 $ (LTX) à ≈ 0,50 $ (Kling) par clip de 5 s selon le modèle', en: 'Paid: from ≈ $0.02 (LTX) to ≈ $0.50 (Kling) per 5 s clip' }, unitCostUsd: 0.04, unit: 'second',
    description: { fr: 'Vraie vidéo générée par IA à partir de l’image de la scène.', en: 'Real AI-generated video from the scene image.' } },
  { id: 'replicate-video', kind: 'video', name: 'Replicate (image → vidéo)', tier: 'paid', local: false, needs: 'REPLICATE_API_TOKEN',
    costNote: { fr: 'Payant : ≈ 0,05 à 0,15 $ par seconde selon le modèle', en: 'Paid: ≈ $0.05–0.15 per second depending on model' }, unitCostUsd: 0.06, unit: 'second',
    description: { fr: 'Wan, Kling, Hailuo… au choix dans Paramètres.', en: 'Wan, Kling, Hailuo… pick in Settings.' } },

  // ——— Voice
  { id: 'edge', kind: 'voice', name: 'Edge TTS (voix neuronales Microsoft)', tier: 'free-online', local: false,
    costNote: { fr: 'Gratuit, nécessite Internet', en: 'Free, needs Internet' },
    description: { fr: 'Excellente qualité, français de France, de Belgique, du Canada et de Suisse, anglais, espagnol, arabe. Minutage des mots inclus.', en: 'Excellent quality, French (FR/BE/CA/CH), English, Spanish, Arabic. Word timings included.' },
    commercialNote: { fr: 'Service non officiel : l’usage commercial des voix n’est pas garanti par Microsoft. Pour une pub commerciale, préférez ElevenLabs ou votre propre voix.', en: 'Unofficial service: commercial use is not guaranteed by Microsoft. For commercial ads prefer ElevenLabs or your own voice.' } },
  { id: 'macos-say', kind: 'voice', name: 'Voix système macOS', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit, hors-ligne (Mac uniquement)', en: 'Free, offline (Mac only)' },
    description: { fr: 'Voix intégrées à macOS (Thomas, Amélie, Audrey…). Ajoutez des voix « améliorées » dans Réglages › Accessibilité › Contenu énoncé.', en: 'Built-in macOS voices. Add enhanced voices in Settings › Accessibility › Spoken Content.' } },
  { id: 'espeak', kind: 'voice', name: 'eSpeak NG', tier: 'free-local', local: true,
    costNote: { fr: 'Gratuit, hors-ligne', en: 'Free, offline' },
    description: { fr: 'Voix de synthèse robotique mais 100 % locale, utile sans Internet.', en: 'Robotic but fully local voice, useful offline.' },
    setup: { fr: 'Sur Mac : brew install espeak-ng', en: 'On Mac: brew install espeak-ng' } },
  { id: 'elevenlabs', kind: 'voice', name: 'ElevenLabs', tier: 'paid', local: false, needs: 'ELEVENLABS_API_KEY',
    costNote: { fr: 'Payant : ≈ 0,18 à 0,30 $ / 1000 caractères selon l’abonnement (offre gratuite : 10 000 caractères/mois, non commerciale)', en: 'Paid: ≈ $0.18–0.30 / 1000 chars (free tier 10k chars/month, non-commercial)' }, unitCostUsd: 0.24, unit: '1k-chars',
    description: { fr: 'Voix très naturelles, clonage de voix, minutage des mots.', en: 'Very natural voices, voice cloning, word timings.' } },
  { id: 'openai-tts', kind: 'voice', name: 'OpenAI TTS', tier: 'paid', local: false, needs: 'OPENAI_API_KEY',
    costNote: { fr: 'Payant : ≈ 0,015 $ / 1000 caractères (gpt-4o-mini-tts)', en: 'Paid: ≈ $0.015 / 1000 chars' }, unitCostUsd: 0.015, unit: '1k-chars',
    description: { fr: 'Voix multilingues expressives.', en: 'Expressive multilingual voices.' } },
];

export const engineById = (id: string) => ENGINES.find((e) => e.id === id);

export function estimateCost(engineId: string, qty: number): number {
  const e = engineById(engineId);
  if (!e || e.tier !== 'paid' && e.id !== 'openai-compat') return 0;
  return (e.unitCostUsd ?? 0) * qty;
}
