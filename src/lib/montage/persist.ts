'use client';
// Sauvegarde automatique du montage en cours dans le navigateur (IndexedDB) :
// la vidéo importée et le plan restent là après un rechargement de la page.

import type { MontageSettings, Plan, SrcWord } from './types';

export interface Session { file: Blob & { name?: string }; words: SrcWord[]; transcriptSource: 'whisper' | 'script' | null; settings: MontageSettings; plan: Plan; language: 'fr' | 'en' | 'auto' }

const DB = 'studio-ai-montage', STORE = 'session', KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}

export async function saveSession(s: Session) {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(s, KEY); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* stockage indisponible (navigation privée) : on continue sans */ }
}

export async function loadSession(): Promise<Session | null> {
  try {
    const db = await open();
    const v = await new Promise<Session | null>((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => res((r.result as Session) ?? null); r.onerror = () => rej(r.error); });
    db.close(); return v;
  } catch { return null; }
}

export async function clearSession() {
  try { const db = await open(); db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY); db.close(); } catch {}
}
