# STUDIO AI

Studio de création vidéo IA **local d’abord** : idée → scénario → storyboard → voix → sous-titres → musique → montage → MP4.
Tout le montage, le storyboard et le rendu fonctionnent **sans abonnement payant**. Les moteurs payants sont optionnels et
leur coût estimé est affiché avant chaque génération.

> État : en développement actif. Voir la section « Ce qui fonctionne » plus bas.

## Lancer sur Mac (Apple Silicon)
1. Installer Node.js 20 ou plus récent : https://nodejs.org (ou `brew install node`).
2. Dans un terminal :
   ```bash
   git clone https://github.com/Aghzalif3/studio-ai.git
   cd studio-ai
   npm install
   npm run dev
   ```
3. Ouvrir http://127.0.0.1:3210

FFmpeg est fourni automatiquement par `npm install` (paquet `ffmpeg-static`).

## Où mettre les clés API
Dans l’application : **Paramètres › Clés API**. Les clés sont chiffrées (AES-256-GCM) dans `studio-data/secrets.enc.json`,
ne quittent jamais le serveur local et ne sont jamais renvoyées au navigateur (seuls les 4 derniers caractères s’affichent).
Vous pouvez aussi les mettre dans un fichier `.env.local` (voir `.env.example`).

| Clé | Service | Sert à |
|---|---|---|
| `FAL_KEY` | fal.ai | images Flux, image → vidéo |
| `REPLICATE_API_TOKEN` | Replicate | images Flux, image → vidéo |
| `STABILITY_API_KEY` | Stability AI | images |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | scénarios |
| `OPENAI_API_KEY` | OpenAI | scénarios, voix |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `MISTRAL_API_KEY` | offres gratuites limitées | scénarios |
| `ELEVENLABS_API_KEY` | ElevenLabs | voix |

## Moteurs gratuits
- **Texte** : rédacteur hors-ligne (modèles narratifs, pas une IA), **Ollama** (gratuit, local : `ollama pull llama3.2`).
- **Images** : illustration procédurale (instantanée), Stable Diffusion local (Forge/AUTOMATIC1111 avec `--api`), Pollinations.
- **Voix** : Edge TTS (excellente qualité, voix belges Charline et Gérard), voix macOS, eSpeak NG, votre propre voix.
- **Musique et bruitages** : synthétisés par Studio AI, libres de droits.

## Données
Tout est stocké dans `studio-data/` (projets, médias, rendus, clés chiffrées). Ce dossier n’est jamais envoyé sur GitHub.

## Licences
Code de Studio AI. Voir `THIRD_PARTY_NOTICES.md` pour Lemo-Opuscar (MIT), les polices (OFL) et FFmpeg (GPL).
