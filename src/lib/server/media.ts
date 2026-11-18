// Resolves asset ids to files, and builds library sounds on demand.
import fs from 'node:fs';
import path from 'node:path';
import type { Project, SfxType } from '../types';
import { LIBRARY_DIR, assetPath } from './paths';
import { sfxWav } from '../audio/sfx';
import { musicWav, MOODS } from '../audio/music';

const SFX_TYPES: SfxType[] = ['whoosh', 'impact', 'riser', 'click', 'pop', 'ding', 'swoosh', 'boom', 'shimmer', 'typing'];

export async function librarySfxPath(type: string) {
  if (!SFX_TYPES.includes(type as SfxType)) throw new Error('Effet sonore inconnu');
  const p = path.join(LIBRARY_DIR, `sfx-${type}.wav`);
  if (!fs.existsSync(p)) await fs.promises.writeFile(p, sfxWav(type as SfxType));
  return p;
}

/** 30-second previews of each mood for the audio library (cached). */
export async function libraryMusicPreview(mood: string, seed = 1) {
  if (!(mood in MOODS)) throw new Error('Ambiance inconnue');
  const p = path.join(LIBRARY_DIR, `music-${mood}-${seed}.wav`);
  if (!fs.existsSync(p)) await fs.promises.writeFile(p, musicWav({ mood: mood as any, duration: 30, seed }));
  return p;
}

export async function resolveAssetFile(project: Project, assetId: string): Promise<string | null> {
  if (assetId.startsWith('lib:sfx:')) return librarySfxPath(assetId.slice(8));
  const a = project.assets.find((x) => x.id === assetId);
  if (!a) return null;
  const p = assetPath(project.id, a.file);
  return fs.existsSync(p) ? p : null;
}
