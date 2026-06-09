// packages/web/src/hooks/useLeads.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import type { CreateLeadPayload } from '@hub-crm/shared';
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

export function useLeadMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['leads'] });

  const create = useMutation({
    mutationFn: (data: CreateLeadPayload) => client.post('/leads', data).then(r => r.data),
    onSuccess:  (_data, variables) => {
      trackEvent('lead_created', { source: variables.source ?? 'unknown' });
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLeadPayload> }) =>
      client.patch(`/leads/${id}`, data).then(r => r.data),
    onSuccess:  invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.delete(`/leads/${id}`),
    onSuccess:  invalidate,
  });

  return { create, update, remove };
}
