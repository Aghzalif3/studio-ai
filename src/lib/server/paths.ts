import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = path.resolve(process.env.STUDIO_DATA_DIR || path.join(process.cwd(), 'studio-data'));
export const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
export const RENDERS_DIR = path.join(DATA_DIR, 'renders');
export const LIBRARY_DIR = path.join(DATA_DIR, 'library');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');

for (const d of [DATA_DIR, PROJECTS_DIR, RENDERS_DIR, LIBRARY_DIR, TMP_DIR]) fs.mkdirSync(d, { recursive: true });

export const projectDir = (id: string) => {
  if (!/^[a-z0-9_]+$/i.test(id)) throw new Error('Identifiant de projet invalide');
  return path.join(PROJECTS_DIR, id);
};
export const assetPath = (projectId: string, file: string) => {
  if (!/^[\w.-]+$/.test(file)) throw new Error('Nom de fichier invalide');
  return path.join(projectDir(projectId), 'assets', file);
};
