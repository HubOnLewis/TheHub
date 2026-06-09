import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  EVENT_FINALIZATION_ITEMS,
  type EventFinalizationItemId,
  type EventFinalizationState,
} from '@hub-crm/shared';
import { trackEvent } from '../analytics/index.js';

interface FinalizationStore {
  byDeal: Record<string, EventFinalizationState>;
  toggleItem: (dealId: string, itemId: EventFinalizationItemId, userEmail?: string) => void;
  getState: (dealId: string) => EventFinalizationState;
  getCompletion: (dealId: string) => { completed: number; total: number; percent: number; allComplete: boolean };
}

function emptyState(dealId: string): EventFinalizationState {
  return { dealId, completed: {}, updatedAt: new Date().toISOString() };
}

export const useFinalizationStore = create<FinalizationStore>()(
  persist(
    (set, get) => ({
      byDeal: {},

      getState(dealId) {
        return get().byDeal[dealId] ?? emptyState(dealId);
      },

      getCompletion(dealId) {
        const state = get().getState(dealId);
        const required = EVENT_FINALIZATION_ITEMS.filter(i => i.required);
        const completed = required.filter(i => state.completed[i.id]).length;
        const total = required.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { completed, total, percent, allComplete: completed === total };
      },

      toggleItem(dealId, itemId, userEmail) {
        set(s => {
          const current = s.byDeal[dealId] ?? emptyState(dealId);
          const nextVal = !current.completed[itemId];
          const completed = { ...current.completed, [itemId]: nextVal };
          const updated: EventFinalizationState = {
            ...current,
            completed,
            updatedAt: new Date().toISOString(),
            updatedBy: userEmail,
          };
          const byDeal = { ...s.byDeal, [dealId]: updated };

          const required = EVENT_FINALIZATION_ITEMS.filter(i => i.required);
          const allDone = required.every(i => (i.id === itemId ? nextVal : completed[i.id]));
          if (allDone) {
            trackEvent('event_finalization_completed', { deal_id: dealId });
          }

          return { byDeal };
        });
      },
    }),
    { name: 'hub-crm-finalization' },
  ),
);
