// packages/web/src/hooks/useLeads.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import type { CreateLeadPayload, PatchLeadPayload } from '@hub-crm/shared';
import { trackEvent } from '../analytics/index.js';

interface LeadsQuery {
  search?:     string;
  status?:     string;
  assignedTo?: string;
  active?:     boolean;
  page?:       number;
  limit?:      number;
  sort?:       string;
  order?:      string;
}

export function useLeads(params: LeadsQuery = {}) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn:  () => client.get('/leads', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useLead(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => client.get<Record<string, unknown>>(`/leads/${id}`).then(r => r.data),
    enabled: (options?.enabled ?? true) && !!id,
    retry: false,
  });
}

export function useLeadMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['leads'] });
    if (id) void qc.invalidateQueries({ queryKey: ['lead', id] });
  };

  const create = useMutation({
    mutationFn: (data: CreateLeadPayload) => client.post('/leads', data).then(r => r.data),
    onSuccess:  (_data, variables) => {
      trackEvent('lead_created', { source: variables.source ?? 'unknown' });
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatchLeadPayload }) =>
      client.patch(`/leads/${id}`, data).then(r => r.data),
    onSuccess:  (_data, variables) => invalidate(variables.id),
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.delete(`/leads/${id}`),
    onSuccess:  (_data, id) => invalidate(id),
  });

  return { create, update, remove };
}
