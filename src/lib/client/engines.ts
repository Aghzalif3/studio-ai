'use client';
import { create } from 'zustand';
import type { EngineInfo } from '../engines/catalog';
import { api } from './api';

export type EngineStatus = EngineInfo & { ready: boolean; reason: string };
export const useEngines = create<{ items: EngineStatus[]; selected: Record<string, string>; ollamaModels: string[]; loaded: boolean; load: (force?: boolean) => Promise<void> }>((set, get) => ({
  items: [], selected: {}, ollamaModels: [], loaded: false,
  load: async (force) => {
    if (get().loaded && !force) return;
    const r = await api<{ items: EngineStatus[]; selected: Record<string, string>; ollamaModels: string[] }>('/api/engines');
    set({ ...r, loaded: true });
  },
}));
