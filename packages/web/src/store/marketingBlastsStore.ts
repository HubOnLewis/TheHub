import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketingBlastChannel, MarketingBlastDraft } from '@hub-crm/shared';
import { trackEvent } from '../analytics/index.js';

interface MarketingBlastsStore {
  drafts: MarketingBlastDraft[];
  createDraft: (input: {
    name: string;
    audienceSource: string;
    channels: MarketingBlastChannel[];
    subject: string;
    body: string;
    createdBy: string;
    createdByEmail: string;
  }) => string;
  updateDraft: (id: string, patch: Partial<Omit<MarketingBlastDraft, 'id' | 'createdAt' | 'createdBy' | 'createdByEmail'>>) => void;
  removeDraft: (id: string) => void;
}

function uid(): string {
  return `blast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useMarketingBlastsStore = create<MarketingBlastsStore>()(
  persist(
    set => ({
      drafts: [],

      createDraft(input) {
        const now = new Date().toISOString();
        const id = uid();
        const draft: MarketingBlastDraft = {
          id,
          ...input,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({ drafts: [draft, ...s.drafts] }));
        trackEvent('marketing_blast_draft_created', { blast_id: id, channels: input.channels.join(',') });
        return id;
      },

      updateDraft(id, patch) {
        set(s => ({
          drafts: s.drafts.map(d =>
            d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
          ),
        }));
      },

      removeDraft(id) {
        set(s => ({ drafts: s.drafts.filter(d => d.id !== id) }));
      },
    }),
    { name: 'hub-crm-marketing-blasts' },
  ),
);
