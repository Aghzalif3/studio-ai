// Project store: one folder per project (project.json + assets/), renders history in renders.json.
import fs from 'node:fs';
import path from 'node:path';
import type { Asset, Project, RenderRecord } from '../types';
import type { StyleDef } from '../styles/types';
import { DATA_DIR, PROJECTS_DIR, RENDERS_DIR, assetPath, projectDir } from './paths';
import { readJson, withLock, writeJson } from './jsonfile';
import { uid } from '../util';

const RENDERS_FILE = path.join(DATA_DIR, 'renders.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const STYLES_FILE = path.join(DATA_DIR, 'custom-styles.json');

export async function listProjects(): Promise<Project[]> {
  const ids = await fs.promises.readdir(PROJECTS_DIR).catch(() => []);
  const out: Project[] = [];
  for (const id of ids) {
    const p = await readJson<Project | null>(path.join(PROJECTS_DIR, id, 'project.json'), null).catch(() => null);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  return readJson<Project | null>(path.join(projectDir(id), 'project.json'), null);
}

export async function saveProject(p: Project, touch = true): Promise<Project> {
  return withLock(`p:${p.id}`, async () => {
    if (touch) p.updatedAt = new Date().toISOString();
    await writeJson(path.join(projectDir(p.id), 'project.json'), p);
    return p;
  });
}

/** Read-modify-write with a lock, so background jobs and autosave don't overwrite each other. */
export async function updateProject(id: string, fn: (p: Project) => void | Promise<void>): Promise<Project> {
  return withLock(`p:${id}`, async () => {
    const p = await getProject(id);
    if (!p) throw new Error('Projet introuvable');
    await fn(p);
    p.updatedAt = new Date().toISOString();
    await writeJson(path.join(projectDir(id), 'project.json'), p);
    return p;
  });
}

export async function deleteProject(id: string) {
  await fs.promises.rm(projectDir(id), { recursive: true, force: true });
}

export async function addAssetFile(projectId: string, data: Buffer, meta: Omit<Asset, 'id' | 'file' | 'createdAt'> & { ext: string }): Promise<Asset> {
  const id = uid('as_');
  const file = `${id}.${meta.ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'}`;
  await fs.promises.mkdir(path.dirname(assetPath(projectId, file)), { recursive: true });
  await fs.promises.writeFile(assetPath(projectId, file), data);
  const { ext: _ext, ...rest } = meta;
  return { ...rest, id, file, createdAt: new Date().toISOString() };
}

export async function listRenders(): Promise<RenderRecord[]> {
  return readJson<RenderRecord[]>(RENDERS_FILE, []);
}
export async function upsertRender(r: RenderRecord) {
  return withLock('renders', async () => {
    const all = await readJson<RenderRecord[]>(RENDERS_FILE, []);
    const i = all.findIndex((x) => x.id === r.id);
    if (i >= 0) all[i] = r; else all.unshift(r);
    await writeJson(RENDERS_FILE, all.slice(0, 500));
  });
}
export async function deleteRender(id: string) {
  return withLock('renders', async () => {
    const all = await readJson<RenderRecord[]>(RENDERS_FILE, []);
    const r = all.find((x) => x.id === id);
    if (r?.file) await fs.promises.rm(path.join(RENDERS_DIR, r.file), { force: true });
    await writeJson(RENDERS_FILE, all.filter((x) => x.id !== id));
  });
}

export interface Template { id: string; name: string; description: string; createdAt: string; project: Project; builtin?: boolean }
export async function listTemplates(): Promise<Template[]> { return readJson<Template[]>(TEMPLATES_FILE, []); }
export async function saveTemplates(t: Template[]) { return withLock('templates', () => writeJson(TEMPLATES_FILE, t)); }

export async function listCustomStyles(): Promise<StyleDef[]> { return readJson<StyleDef[]>(STYLES_FILE, []); }
export async function saveCustomStyles(s: StyleDef[]) { return withLock('styles', () => writeJson(STYLES_FILE, s)); }

export async function wipeAll(what: { projects?: boolean; renders?: boolean; templates?: boolean; styles?: boolean }) {
  if (what.projects) { await fs.promises.rm(PROJECTS_DIR, { recursive: true, force: true }); await fs.promises.mkdir(PROJECTS_DIR, { recursive: true }); }
  if (what.renders) { await fs.promises.rm(RENDERS_DIR, { recursive: true, force: true }); await fs.promises.mkdir(RENDERS_DIR, { recursive: true }); await writeJson(RENDERS_FILE, []); }
  if (what.templates) await writeJson(TEMPLATES_FILE, []);
  if (what.styles) await writeJson(STYLES_FILE, []);
}

export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const walk = async (d: string) => {
    for (const e of await fs.promises.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p); else total += (await fs.promises.stat(p).catch(() => ({ size: 0 }))).size;
    }
  };
  await walk(dir);
  return total;
}
