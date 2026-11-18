# Analyse de Lemo-Opuscar (LemoLab) et réutilisation légale

Dépôt étudié : https://github.com/lemomo-ai/lemo-opuscar (version 2.0.0, novembre 2026), cloné et lu en entier
(README, LICENSE, REUSE.toml, TECHNIQUE.md, DIRECTOR.md, core/, tools/, plugin/, 101 dossiers `styles/`).

## 1. Ce qu'est réellement Lemo-Opuscar

Ce n'est **pas une application** : c'est une bibliothèque de *skills* pour un agent de code (Claude Code).
L'utilisateur choisit un style, décrit son histoire, et l'agent **écrit à la main le code d'un film** :
une page web `index.html` qui expose `render(t)` (l'image est une fonction pure du temps), rendue image par
image dans Chrome headless, puis montée avec FFmpeg. Il n'y a ni génération vidéo IA, ni banque d'images.
Un film demande 30 à 60 minutes de travail d'agent.

Chaîne technique (TECHNIQUE.md) :

```
timeline (source unique)
  ├─ image : page web render(t) → Chrome headless image par image → video.mp4
  ├─ voix  : TTS par réplique (Kokoro hors-ligne, edge-tts en ligne) → vérification Whisper → minutage des mots
  ├─ musique : partition générée depuis la même timeline (échantillons libres + synthèse)
  ├─ bruitages : foley procédural aux instants des événements
  └─ sous-titres : .srt + sous-titres incrustés
mixage (ducking, compression, équilibre) → mux FFmpeg, loudnorm deux passes à −14 LUFS → film.mp4
```

| Élément | Comment Lemo le fait | Ce que STUDIO AI en retient |
|---|---|---|
| Storyboard | L'agent montre quelques plans clés avant le film si l'utilisateur le demande | Storyboard éditable scène par scène, validation obligatoire avant rendu (option) |
| Styles | 99 styles, 15 catégories, chacun = `STYLE.md` (prompt) + film de démo codé | Moteur de styles paramétrique (palette, matière, typo, mouvement, post-traitement) + suffixe de prompt pour les moteurs d'images |
| Animation image par image | `render(t)` déterministe, graine fixe, pas d'état entre images, rendu parallèle | Même principe : un seul moteur `renderFrame(projet, t)` utilisé pour l'aperçu temps réel (navigateur) et l'export (Node + Skia) |
| Rendu FFmpeg | Captures JPEG pipées dans FFmpeg, segments joints, grain ajouté dans FFmpeg | Images RGBA pipées dans FFmpeg depuis Node (pas de navigateur headless), grain et encodage côté FFmpeg |
| Narration | Kokoro (anglais, local), edge-tts (en ligne), Whisper pour vérifier | Edge TTS (FR-BE, FR-FR, FR-CA, FR-CH, EN, ES, AR), voix système macOS, eSpeak NG (local), Kokoro, ElevenLabs/OpenAI (payants) |
| Mixage | Voix compressée, musique ~10 dB sous la voix, loudnorm −14 LUFS, limiteur | Idem via un graphe de filtres FFmpeg (sidechaincompress, loudnorm deux passes) |
| Musique | Partitions originales jouées avec des banques libres (VSCO2 CE, VCSL…) | Synthétiseur procédural intégré : musiques originales générées, donc sans problème de droits |

## 2. Licences : ce qui est réutilisable

Règles du fichier `LICENSE` / `REUSE.toml` du dépôt :

| Partie du dépôt | Licence | Usage commercial dans STUDIO AI |
|---|---|---|
| Code `core/`, `tools/`, `styleboard/`, `plugin/` scripts, code des démos, données/configuration (`style.json`) | **MIT** | ✅ Oui, avec la mention de copyright |
| Tous les `.md` (STYLE.md, DEMO.md, DIRECTOR.md, TECHNIQUE.md…) et les prompts d'images (`styles/*/demo/prompts/`) | **CC BY-NC 4.0** + permission spéciale limitée à la fabrication de *vos propres films* | ❌ **Non** : les intégrer dans un produit ou service commercial exige une licence commerciale (lemomo.studio@gmail.com) |
| Films de démo, posters, images fixes, sous-titres, images de `docs/` et `styleboard/img/` | **CC BY 4.0** (sauf matériel tiers) | ✅ Oui avec crédit, mais pas utilisé |
| Personnage Clawd et interface Claude (Mascot Screencast, OPUSCAR 98, films de remerciement) | Exclus de toute licence (Anthropic) | ❌ Non |
| Six pistes de narration (Edge TTS / Doubao TTS) | Exclues | ❌ Non |
| Polices `core/fonts/` (OFL), modèles Poly Haven (CC0), banques de sons | Licences propres | Non utilisés (STUDIO AI embarque ses propres polices OFL) |

## 3. Décisions prises pour STUDIO AI

1. **Aucun texte CC BY-NC n'est copié.** Les descriptions de styles, prompts et règles de direction de STUDIO AI
   sont rédigés de zéro. Les idées techniques (rendu déterministe en fonction du temps, loudnorm −14 LUFS,
   voix ~10 dB au-dessus de la musique, sous-titres incrustés) ne sont pas protégeables et sont réimplémentées.
2. **Métadonnées des styles (MIT)** : les noms, catégories et usages des 99 styles proviennent des `style.json`
   (MIT). Ils sont repris dans `src/lib/styles/lemo-catalog.ts` avec la mention de copyright MIT
   (voir `THIRD_PARTY_NOTICES.md`). Chaque style est rendu par le moteur paramétrique de STUDIO AI ;
   ce n'est **pas** une reproduction des films de démo Lemo.
3. **Aucune image, aucun film, aucune voix de Lemo n'est redistribué.** Les aperçus de la galerie sont rendus
   en direct par le moteur de STUDIO AI.
4. **Code MIT réutilisé par adaptation** : le principe de `core/render/video.mjs` (rendu image par image pipé
   dans FFmpeg), de `mux.sh` (loudnorm deux passes, limiteur) et les fonctions d'easing de `core/lib.js`
   ont été réécrits en TypeScript. Crédit dans `THIRD_PARTY_NOTICES.md`.
5. **Pas de Clawd, pas d'interface Claude**, pas de personnage protégé (le style « 3D façon Pixar » est un
   rendu 3D stylisé générique).

## 4. Limites de Lemo-Opuscar que STUDIO AI corrige

- Lemo demande un agent IA et 30–60 min par film : STUDIO AI est une application autonome, l'idée devient un
  storyboard en quelques secondes et le rendu se fait sans agent.
- Lemo n'a pas d'éditeur : STUDIO AI ajoute une timeline multipiste et la modification après génération.
- Lemo ne génère pas d'images IA (sauf 3 styles via Codex) : STUDIO AI branche des moteurs interchangeables
  (procédural local, Pollinations gratuit, Stable Diffusion local, fal.ai, Replicate, Stability AI).
