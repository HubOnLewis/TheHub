import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Prospect, ProspectStatus } from '@hub-crm/shared';

interface ProspectsStore {
  prospects: Prospect[];
  addProspect: (input: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProspect: (id: string, patch: Partial<Omit<Prospect, 'id' | 'createdAt'>>) => void;
  removeProspect: (id: string) => void;
}

function uid(): string {
  return `prospect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useProspectsStore = create<ProspectsStore>()(
  persist(
    set => ({
      prospects: [],

      addProspect(input) {
        const now = new Date().toISOString();
        const row: Prospect = {
          ...input,
          id: uid(),
          status: input.status as ProspectStatus,
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({ prospects: [row, ...s.prospects] }));
      },

      updateProspect(id, patch) {
        set(s => ({
          prospects: s.prospects.map(p =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
          ),
        }));
      },

      removeProspect(id) {
        set(s => ({ prospects: s.prospects.filter(p => p.id !== id) }));
      },
    }),
    { name: 'hub-crm-prospects' },
  ),
);
