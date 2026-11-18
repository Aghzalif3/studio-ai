'use client';
import { create } from 'zustand';

export class ApiError extends Error { constructor(message: string, public hint?: string, public status = 500, public data?: any) { super(message); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), signal: opts.signal };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers = { 'content-type': 'application/json' }; }
  const r = await fetch(path, init);
  const ct = r.headers.get('content-type') || '';
  if (!r.ok) {
    const data = ct.includes('json') ? await r.json().catch(() => ({})) : {};
    throw new ApiError(data.error || `Erreur ${r.status}`, data.hint, r.status, data);
  }
  return (ct.includes('json') ? r.json() : (r as any)) as T;
}

// ——— Paid-generation confirmation: every request that can cost money goes through this.
type CostAsk = { costUsd: number; label: string; resolve: (ok: boolean) => void } | null;
export const useCostDialog = create<{ ask: CostAsk; open: (costUsd: number, label: string) => Promise<boolean>; close: (ok: boolean) => void }>((set, get) => ({
  ask: null,
  open: (costUsd, label) => new Promise<boolean>((resolve) => set({ ask: { costUsd, label, resolve } })),
  close: (ok) => { get().ask?.resolve(ok); set({ ask: null }); },
}));

/** Calls a generation endpoint; if the server answers 402 with a cost, asks the user, then retries with confirmCost. Returns null if declined. */
export async function paid<T = any>(path: string, body: Record<string, unknown>, label: string): Promise<T | null> {
  try { return await api<T>(path, { body }); }
  catch (e) {
    if (e instanceof ApiError && e.status === 402 && e.data?.needsConfirmation) {
      const ok = await useCostDialog.getState().open(e.data.costUsd, label);
      if (!ok) return null;
      return api<T>(path, { body: { ...body, confirmCost: true } });
    }
    throw e;
  }
}

// ——— Toasts
export type Toast = { id: number; kind: 'ok' | 'error' | 'info'; title: string; hint?: string };
export const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => { const id = Date.now() + Math.random(); set((s) => ({ items: [...s.items, { ...t, id }] })); setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), t.kind === 'error' ? 9000 : 4000); },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));
export const toast = {
  ok: (title: string, hint?: string) => useToasts.getState().push({ kind: 'ok', title, hint }),
  info: (title: string, hint?: string) => useToasts.getState().push({ kind: 'info', title, hint }),
  error: (e: unknown, fallback = 'Une erreur est survenue') => useToasts.getState().push({ kind: 'error', title: e instanceof Error ? e.message : fallback, hint: e instanceof ApiError ? e.hint : undefined }),
};

export const assetUrl = (projectId: string, assetId: string) =>
  assetId.startsWith('lib:sfx:') ? `/api/library/sfx/${assetId.slice(8)}` : `/api/projects/${projectId}/assets/${assetId}`;
