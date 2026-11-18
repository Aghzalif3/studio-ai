'use client';
import { create } from 'zustand';
import type { StyleDef } from '../styles/types';
import { resolveStyle } from '../styles/registry';
import { api } from './api';

export const useCustomStyles = create<{ items: StyleDef[]; loaded: boolean; load: (force?: boolean) => Promise<void> }>((set, get) => ({
  items: [], loaded: false,
  load: async (force) => { if (get().loaded && !force) return; const r = await api<{ custom: StyleDef[] }>('/api/styles'); set({ items: r.custom, loaded: true }); },
}));

export function useStyle(id: string | undefined) {
  const { items, loaded, load } = useCustomStyles();
  if (!loaded && typeof window !== 'undefined') void load().catch(() => {});
  return resolveStyle(id ?? '', items);
}
