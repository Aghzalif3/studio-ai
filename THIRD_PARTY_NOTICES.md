# Mentions tierces / Third-party notices

## Lemo-Opuscar (licence MIT pour le code et les fichiers `style.json`)
Studio AI reprend, sous licence MIT, les **noms, catégories et usages** des styles décrits dans les fichiers `style.json`
du dépôt Lemo-Opuscar, ainsi que de petites fonctions utilitaires (courbes d’accélération, générateur pseudo-aléatoire
« mulberry ») adaptées de `core/lib.js`.

> Copyright (c) les auteurs de Lemo-Opuscar.
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice
> and this permission notice shall be included in all copies or substantial portions of the Software.
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

**Non repris :** les fichiers `.md` (STYLE.md, guides) et les prompts de Lemo-Opuscar sont sous **CC BY-NC 4.0**
(usage non commercial) : aucun de leurs textes n’est inclus dans Studio AI. Les médias de démonstration (CC BY 4.0) et le
personnage Clawd / l’interface Claude ne sont pas utilisés. Les descriptions et prompts des styles de Studio AI sont
rédigés pour ce projet.

## Polices (SIL Open Font License 1.1)
Inter, Space Grotesk, Playfair Display, Bebas Neue, Caveat, Press Start 2P, Montserrat, Oswald, Archivo Black,
IBM Plex Mono, DM Serif Display, Fredoka, Cinzel, VT323, Noto Naskh Arabic — fichiers dans `public/fonts`, licence dans
`public/fonts/OFL.txt` (source : github.com/google/fonts).

## FFmpeg
Les paquets `ffmpeg-static` et `ffprobe-static` téléchargent des binaires FFmpeg compilés sous licence **GPL**
(avec libx264). Ils ne sont pas redistribués dans ce dépôt ; ils sont installés par `npm install`.
Si vous distribuez Studio AI avec ces binaires, respectez la GPL (source de FFmpeg disponible sur ffmpeg.org).

## Services en ligne
Edge TTS (`msedge-tts`) utilise un service non officiel de Microsoft : l’usage commercial des voix n’est pas garanti.
Chaque moteur payant (fal.ai, Replicate, Stability AI, OpenAI, Anthropic, ElevenLabs…) est soumis à ses propres conditions.

## Musique et bruitages
Toute la musique et tous les bruitages sont synthétisés par le code de Studio AI : aucune œuvre tierce n’est incluse.
