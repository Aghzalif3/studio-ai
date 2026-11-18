# Architecture technique de STUDIO AI

## Vue d'ensemble

Application **locale d'abord** : un seul serveur Next.js tourne sur l'ordinateur de l'utilisateur
(`http://localhost:3210`). Le navigateur n'a jamais accès aux clés API : toute requête vers un fournisseur
passe par les routes `/api/*` côté serveur.

```
Navigateur (React 19, Tailwind 4)                 Serveur Node (Next.js 15, routes /api)
┌───────────────────────────────┐                ┌──────────────────────────────────────────┐
│ Accueil · Assistant · Story-  │  fetch JSON    │ Projets (store JSON atomique)             │
│ board · Éditeur timeline ·    │ ─────────────► │ Moteurs IA (registre de fournisseurs)     │
│ Styles · Voix · Exports ·     │                │   texte · image · vidéo · voix            │
│ Paramètres                    │ ◄───────────── │ Coffre de clés (chiffré AES-256-GCM)      │
│                               │  progression   │ File de rendus (jobs, progression, ETA)   │
│ Moteur de rendu (canvas 2D)   │                │ Moteur de rendu (Skia via @napi-rs/canvas)│
│ = même code que l'export      │                │   → images RGBA → FFmpeg → MP4            │
└───────────────────────────────┘                │ Audio : synthé musique, bruitages, mixage │
                                                 │   FFmpeg (ducking, loudnorm −14 LUFS)     │
                                                 └──────────────────────────────────────────┘
                                                   Dossier de données : ./studio-data/
```

## Modules (`src/lib`)

| Module | Rôle | Remplaçable |
|---|---|---|
| `engines/text` | Idée → scénario JSON (scènes, narration, textes, caméra…) | Ollama (local), Pollinations (gratuit), API compatibles OpenAI (Groq, OpenRouter, Mistral, OpenAI), Anthropic, rédacteur hors-ligne par modèles (sans IA, présenté comme tel) |
| `engines/image` | Texte → image, image de référence | Procédural (local), Pollinations, Stable Diffusion local (API AUTOMATIC1111/Forge), fal.ai, Replicate, Stability AI |
| `engines/video` | Image → vidéo, texte → vidéo | fal.ai, Replicate (payants) ; animation locale « Ken Burns + parallaxe » par le moteur de rendu |
| `engines/voice` | Texte → voix + minutage des mots | Edge TTS (gratuit en ligne), voix macOS `say`, eSpeak NG, Kokoro (local), ElevenLabs, OpenAI TTS |
| `styles` | Catalogue de styles : recette paramétrique + suffixe de prompt | Fichiers de données ; styles personnels stockés dans le projet |
| `render` | `renderFrame(ctx, timeline, t)` déterministe, transitions, caméra, sous-titres, effets | Même code navigateur / Node |
| `audio` | Synthèse musicale procédurale, bruitages procéduraux, mixage FFmpeg | |
| `subtitles` | Découpage en sous-titres, export SRT/VTT, styles d'animation | |
| `export` | File de jobs, rendu parallèle par segments, progression, historique | |
| `store` | Projets, modèles, historique : fichiers JSON écrits de façon atomique | Interface prête pour SQLite/Postgres |
| `secrets` | Clés API chiffrées dans `studio-data/secrets.enc.json` (clé maître locale) ou variables d'environnement | |

Chaque fournisseur implémente une interface commune (`TextEngine`, `ImageEngine`, `VideoEngine`,
`VoiceEngine`) et déclare son **coût** (`free`, `free-limited`, `paid` + estimation), son statut
(`local` / `en ligne`) et la clé dont il a besoin. L'interface affiche ce coût avant chaque génération payante
et demande une confirmation.

## Modèle de données

```
Project
 ├─ brief       idée, sujet, durée, public, réseau, style, format, langue, narration, musique, qualité
 ├─ scenes[]    storyboard : description visuelle, texte affiché, narration, durée, caméra, transition,
 │              ambiance sonore, image (asset), voix (asset + minutage des mots)
 ├─ timeline    pistes : video · overlay/effets · voix · musique · bruitages · sous-titres
 │              (clips avec début, durée, vitesse, volume, zoom, recadrage, transition)
 ├─ assets[]    images, vidéos, sons importés ou générés (fichiers dans studio-data/projects/<id>/)
 └─ renders[]   historique des exports (paramètres, durée, taille, fichier)
```

Le storyboard génère la timeline ; une fois la timeline modifiée à la main, elle reste la source de vérité
(l'utilisateur peut la reconstruire depuis le storyboard s'il le veut).

## Rendu

1. Pré-calcul : voix de chaque scène, musique synthétisée, bruitages placés aux transitions.
2. Image : `renderFrame` dessine chaque image (style, image IA ou procédurale, mouvement de caméra, transition,
   effets, sous-titres) sur un canvas Skia ; les pixels bruts sont envoyés à FFmpeg (`rawvideo` → H.264).
3. Audio : FFmpeg mixe voix (compressée), musique (ducking sous la voix), bruitages, puis `loudnorm` à
   −14 LUFS, true peak −1 dB.
4. Mux final MP4 (H.264 + AAC, `faststart`), 720p / 1080p / 4K, 24 / 30 / 60 i/s.

## Sécurité

- Clés API uniquement côté serveur ; le navigateur ne reçoit que « configurée : oui / ••••1234 ».
- Serveur lié à `127.0.0.1` par défaut.
- Validation de toutes les entrées avec `zod`, noms de fichiers générés par le serveur (pas de chemin fourni par
  le client).
