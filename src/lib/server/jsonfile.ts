import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Atomic JSON write: write to a temp file then rename (never leaves a half-written file). */
export async function writeJson(file: string, data: unknown) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.promises.rename(tmp, file);
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.promises.readFile(file, 'utf8')) as T; }
  catch (e: any) { if (e?.code === 'ENOENT') return fallback; throw e; }
}

const locks = new Map<string, Promise<unknown>>();
/** Serialises read-modify-write on one key inside this process. */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(key, prev.then(() => next));
  await prev;
  try { return await fn(); } finally { release(); if (locks.get(key) === next) locks.delete(key); }
}
