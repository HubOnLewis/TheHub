// packages/web/src/hooks/useDeals.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import type { CreateDealPayload } from '@mtte-core/shared';

interface DealsQuery {
  search?:     string;
  status?:     string;
  assignedTo?: string;
  active?:     boolean;
  page?:       number;
  limit?:      number;
  sort?:       string;
  order?:      string;
}

export function useDeals(params: DealsQuery = {}) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn:  () => client.get('/deals', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDealMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['deals'] });

  const create = useMutation({
    mutationFn: (data: CreateDealPayload) => client.post('/deals', data).then(r => r.data),
    onSuccess:  invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDealPayload> }) =>
      client.patch(`/deals/${id}`, data).then(r => r.data),
    onSuccess:  invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.delete(`/deals/${id}`),
    onSuccess:  invalidate,
  });

  return { create, update, remove };
}
