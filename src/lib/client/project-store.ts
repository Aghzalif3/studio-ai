'use client';
// Workspace state: the open project, debounced autosave and undo/redo.
import { create } from 'zustand';
import type { Project } from '../types';
import { api, toast } from './api';

type Status = 'saved' | 'dirty' | 'saving' | 'error';
interface S {
  project: Project | null;
  status: Status;
  past: Project[]; future: Project[];
  busy: Record<string, boolean>;
  load: (id: string) => Promise<void>;
  /** Local edit (autosaved). `history:false` for continuous gestures (drag) that call `checkpoint` once. */
  edit: (fn: (p: Project) => void, opts?: { history?: boolean }) => void;
  checkpoint: () => void;
  /** Replace with the server's version after a server-side operation. */
  replace: (p: Project) => void;
  flush: () => Promise<void>;
  undo: () => void; redo: () => void;
  setBusy: (k: string, v: boolean) => void;
  /** Runs a server operation after flushing pending edits; the result replaces the local project. */
  run: <T extends Project | { project: Project }>(key: string, fn: () => Promise<T | null>) => Promise<T | null>;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let delay = 800;

export const useProject = create<S>((set, get) => {
  const save = async () => {
    timer = null;
    const p = get().project; if (!p) return;
    set({ status: 'saving' });
    const job = api<{ updatedAt: string; assets: Project['assets'] }>(`/api/projects/${p.id}`, { method: 'PUT', body: p })
      .then((r) => { const cur = get().project; if (cur && cur.id === p.id) set({ project: cur === p ? { ...cur, updatedAt: r.updatedAt, assets: r.assets } : { ...cur, assets: r.assets }, status: get().project === p ? 'saved' : 'dirty' }); })
      .catch((e) => { set({ status: 'error' }); toast.error(e, 'Échec de l’enregistrement automatique'); });
    inflight = job; await job; inflight = null;
    if (get().status === 'dirty' && !timer) timer = setTimeout(save, delay);
  };
  const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(save, delay); };
  return {
    project: null, status: 'saved', past: [], future: [], busy: {},
    load: async (id) => {
      set({ project: null, past: [], future: [], status: 'saved' });
      const [p, s] = await Promise.all([api<Project>(`/api/projects/${id}`), api<{ settings: { autosaveMs: number } }>('/api/settings').catch(() => null)]);
      if (s) delay = s.settings.autosaveMs;
      set({ project: p });
    },
    edit: (fn, opts) => {
      const cur = get().project; if (!cur) return;
      const next = structuredClone(cur); fn(next);
      set((st) => ({ project: next, status: 'dirty', past: opts?.history === false ? st.past : [...st.past.slice(-60), cur], future: opts?.history === false ? st.future : [] }));
      schedule();
    },
    checkpoint: () => { const cur = get().project; if (cur) set((st) => ({ past: [...st.past.slice(-60), structuredClone(cur)], future: [] })); },
    replace: (p) => set({ project: p, status: 'saved' }),
    flush: async () => { if (timer) { clearTimeout(timer); await save(); } else if (inflight) await inflight; },
    undo: () => { const { past, project } = get(); if (!past.length || !project) return; set((st) => ({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...st.future], status: 'dirty' })); schedule(); },
    redo: () => { const { future, project } = get(); if (!future.length || !project) return; set((st) => ({ project: future[0], future: future.slice(1), past: [...st.past, project], status: 'dirty' })); schedule(); },
    setBusy: (k, v) => set((st) => ({ busy: { ...st.busy, [k]: v } })),
    run: async (key, fn) => {
      get().setBusy(key, true);
      try {
        await get().flush();
        const r = await fn();
        if (r) { const p = 'project' in r && (r as any).project ? (r as any).project : r; if ((p as Project).id) set({ project: p as Project, status: 'saved' }); }
        return r;
      } catch (e) { toast.error(e); return null; }
      finally { get().setBusy(key, false); }
    },
  };
});
