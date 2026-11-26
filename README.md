# STUDIO AI

Studio de création vidéo IA **local d’abord** : idée → scénario → storyboard → voix → sous-titres → musique → montage → MP4.
Tout le montage, le storyboard et le rendu fonctionnent **sans abonnement payant**. Les moteurs payants sont optionnels et
leur coût estimé est affiché avant chaque génération.


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

Vérifier ce qui est disponible sur votre Mac : `npm run doctor`.
Version optimisée : `npm run build && npm start` (même adresse).

## Montage auto par 16 agents (nouveau)
Ouvre **http://127.0.0.1:3210/montage** (ou « Montage auto » dans le menu). Dépose une vidéo face caméra :
16 agents la montent en direct sous tes yeux, puis tu modifies ce que tu veux et tu exportes.

| Agent | Ce qu’il fait |
|---|---|
| `coupe-01`, `coupe-02` | Coupent les blancs (détection de parole sur l’audio) et retirent les « euh », « hum », « bah » |
| `rythme-01` | Mesure le débit de parole et adapte la longueur des sous-titres |
| `soustitres-01/02/03` | Découpent les phrases en sous-titres mot par mot et surlignent les mots forts |
| `type-01` | Applique le style de typo (Gros orange, Bloc jaune, Néon, Sobre) |
| `motion-01…04` | Posent lettres géantes, compteurs chiffrés (« 48 HEURES »), flèches, étiquettes et cadres de focus |
| `zoom-01`, `cadrage-01` | Zooms d’impact sur les mots forts, recadrage au format (9:16, 16:9, 1:1, 4:5) |
| `sfx-01`, `sfx-02` | Bruitages synthétisés (whoosh, impact, pop, clic…) calés sur les motions et les mots forts |
| `style-01` | Étalonnage (Ciné orange, Contrasté, Noir et blanc, Naturel) |

- **Transcription** : Whisper (modèle `whisper-base`) tourne **dans le navigateur**, sur ton Mac. Le modèle (~80 Mo)
  est téléchargé une seule fois depuis Hugging Face puis gardé en cache. Sans Internet, colle le texte de la vidéo
  dans *Réglages* : il est aligné automatiquement sur les passages parlés.
- **Timeline multipiste** : V1 images (plans gardés, coupes cliquables et restaurables), V2 motions, T1 mots,
  Z1 zooms, A1 forme d’onde de la voix, A2 bruitages. Glisser pour déplacer, cliquer pour modifier, Cmd+Z pour annuler.
- **Export** : rendu dans le navigateur (MP4 H.264 sur Chrome et Safari, WebM sinon), en 720p ou 1080p, avec
  sous-titres, motions et bruitages incrustés. L’export dure le temps de la vidéo : garde l’onglet visible.
- Le montage en cours est **sauvegardé automatiquement** dans le navigateur (vidéo comprise).
- Les agents sont des programmes spécialisés qui tournent en local : ce ne sont pas des modèles de langage, et
  ils ne voient pas l’image (le recadrage reste centré, réglable à la main).

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

## Ce qui fonctionne (testé)
- Assistant de création (idée, texte, images, pub, TikTok, YouTube, animation) → scénario → storyboard modifiable
  (ajout, suppression, duplication, réordonnancement par glisser-déposer, image régénérée ou importée, voix par scène).
- Validation du storyboard obligatoire avant le rendu final (désactivable par projet).
- Aperçu temps réel dans le navigateur, dessiné par le même moteur que l’export.
- Montage multipiste : vidéo, effets, sous-titres, voix, musique, bruitages ; déplacer, rogner, couper, supprimer,
  volume, vitesse, zoom/recadrage, position, rotation, filtres, caméra, transitions, annuler/rétablir.
- Voix : Edge TTS (FR/BE/CA/CH, EN, ES, AR), voix macOS, eSpeak, ElevenLabs, OpenAI ; votre voix (micro ou fichier).
- Sous-titres synchronisés, animés (7 styles), modifiables, mots-clés surlignés, export SRT/VTT, incrustation.
- Musique originale et bruitages synthétisés, mixage automatique (ducking, normalisation ≈ −14 LUFS).
- Export MP4 H.264 720p / 1080p / 4K, 24/30/60 i/s, barre de progression, temps restant, annulation, historique.
- 110 styles visuels + styles personnalisés (couleurs, polices, logo, références), modèles réutilisables.
- Clés API chiffrées, coût affiché et confirmé avant chaque génération payante.

## Limites connues
- Le « rédacteur hors-ligne » n’est pas une IA : il structure votre idée avec des modèles. Pour un vrai texte rédigé,
  utilisez Ollama (gratuit, local) ou une API.
- L’illustration procédurale dessine des fonds, formes et typographies animées, pas des images réalistes : pour de vraies
  images, utilisez Stable Diffusion local, Pollinations ou une API.
- Sans moteur image → vidéo (payant), les images sont animées par des mouvements de caméra, pas par un mouvement interne.
- Edge TTS est un service non officiel : pour une publicité commerciale, préférez ElevenLabs ou votre propre voix.
- Les moteurs en ligne (Edge, Pollinations, fal, Replicate…) n’ont pu être testés que sur une machine avec Internet.

## Développement
- `npm test` : tests automatiques (Vitest).
- `npm run lint` : vérification TypeScript.
- `npm run render:sample` : rendu d’une vidéo d’exemple en ligne de commande.
