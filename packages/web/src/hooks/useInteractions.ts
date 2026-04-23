// packages/web/src/hooks/useInteractions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import type { CreateInteractionRequestPayload, PatchInteractionRequestPayload } from '@mtte-core/shared';

export type InteractionRow = {
  _id:              string;
  companyId:        string;
  companyName?:     string;
  contactId?:       string;
  relatedDealId?:   string;
  unitId?:          string;
  buildId?:         string;
  parentInteractionId?: string;
  type:             string;
  direction:        string;
  summary:          string;
  body:             string;
  outcome:          string;
  status:           string;
  followUpAt?:      string;
  isOverdue?:       boolean;
  nextAction?: {
    type: 'call' | 'follow_up' | 'quote' | 'visit' | 'task';
    reason: string;
    dueAt: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  };
  createdAt:        string;
  createdByUserId:  string;
  createdByName:    string;
  ownerUserId:      string;
  ownerName:        string;
  completedAt?:     string;
  completedByUserId?: string;
  completedByName?: string;
  lastEditedAt?:    string;
  lastEditedByUserId?: string;
  lastEditedByName?: string;
  attachments:      Array<{
    id:         string;
    type:       'image' | 'document';
    url:        string;
    fileName:   string;
    mimeType:   string;
    sizeBytes:  number;
    originalFileName: string;
    storageKey: string;
    uploadedByUserId: string;
    uploadedByName: string;
    uploadedAt: string;
  }>;
  metadata:         Record<string, unknown>;
  aiInsights?: {
    suggestedFollowUp?: string;
    detectedIntent?:  string;
    sentiment?:         string;
    urgencyScore?: number;
    nextBestAction?: string;
  };
};

export function useCompanyInteractions(
  companyId: string,
  page = 1,
  limit = 20,
  filters: { type?: string; status?: string; ownerUserId?: string; hasFollowUp?: boolean; q?: string } = {},
) {
  return useQuery({
    queryKey:  ['companies', companyId, 'interactions', { page, limit, ...filters }],
    queryFn:   () =>
      client.get<{ data: InteractionRow[]; total: number; page: number; pages: number; limit: number }>(
        `/companies/${companyId}/interactions`,
        { params: { page, limit, ...filters } },
      ).then(r => r.data),
    staleTime: 30_000,
    enabled:   !!companyId,
  });
}

export function useInteraction(id: string | null) {
  return useQuery({
    queryKey:  ['interactions', id],
    queryFn:   () => client.get<InteractionRow>(`/interactions/${id}`).then(r => r.data),
    staleTime: 30_000,
    enabled:   !!id,
  });
}

export function useCreateInteraction(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInteractionRequestPayload) =>
      client.post<InteractionRow>('/interactions', body).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'interactions'] });
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'summary'] });
      void qc.invalidateQueries({ queryKey: ['interactions', 'follow-ups'] });
      void qc.invalidateQueries({ queryKey: ['interactions', 'my-work'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useUpdateInteraction(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchInteractionRequestPayload }) =>
      client.patch<InteractionRow>(`/interactions/${id}`, body).then(r => r.data),
    onSuccess: (_data, v) => {
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'interactions'] });
      void qc.invalidateQueries({ queryKey: ['interactions', v.id] });
      void qc.invalidateQueries({ queryKey: ['interactions', 'follow-ups'] });
      void qc.invalidateQueries({ queryKey: ['interactions', 'my-work'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useAddInteractionAttachment(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return client.post<InteractionRow>(`/interactions/${id}/attachments`, form).then(r => r.data);
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'interactions'] });
      void qc.invalidateQueries({ queryKey: ['interactions', v.id] });
      void qc.invalidateQueries({ queryKey: ['interactions', 'my-work'] });
    },
  });
}

export function useRemoveInteractionAttachment(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, attachmentId }: { id: string; attachmentId: string }) =>
      client.delete<InteractionRow>(`/interactions/${id}/attachments/${attachmentId}`).then(r => r.data),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'interactions'] });
      void qc.invalidateQueries({ queryKey: ['interactions', v.id] });
      void qc.invalidateQueries({ queryKey: ['interactions', 'my-work'] });
    },
  });
}

export function useFollowUps(filters: {
  mine?: 1 | 0;
  ownerUserId?: string;
  overdueOnly?: 1 | 0;
  status?: 'open' | 'completed';
  q?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey:  ['interactions', 'follow-ups', filters],
    queryFn:   () =>
      client.get<{ data: InteractionRow[]; total: number; page: number; pages: number; limit: number }>(
        '/interactions/follow-ups',
        { params: { mine: 1, limit: 100, ...filters } },
      ).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useMyWork(filters: {
  ownerUserId?: string;
  q?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['interactions', 'my-work', filters],
    queryFn: () =>
      client.get<{
        overdue: InteractionRow[];
        dueToday: InteractionRow[];
        upcoming: InteractionRow[];
        suggested: InteractionRow[];
      }>('/interactions/my-work', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}
