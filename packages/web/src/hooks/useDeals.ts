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
  ownerUserId?: string;
  stage?: string;
  company?: string;
}

export function useDeals(params: DealsQuery = {}) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn:  () => client.get('/deals', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function usePipelinePressure(params: {
  ownerUserId?: string;
  stage?: string;
  pressureLevel?: 'critical' | 'high' | 'medium' | 'low';
  q?: string;
  companyId?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['deals', 'pipeline-pressure', params],
    queryFn: () => client.get('/deals/pipeline-pressure', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useForecastReview(params: {
  ownerUserId?: string;
  stage?: string;
  confidence?: 'low' | 'medium' | 'high';
  forecastCategory?: 'commit' | 'best_case' | 'pipeline' | 'excluded';
  needsManagementReview?: 1 | 0;
  q?: string;
  companyId?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['deals', 'forecast-review', params],
    queryFn: () => client.get('/deals/forecast-review', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDealInteractions(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'interactions'],
    queryFn: () => client.get(`/deals/${dealId}/interactions`).then(r => r.data),
    enabled: !!dealId,
    staleTime: 30_000,
  });
}

export function useDealMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['deals'] });
    void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    void qc.invalidateQueries({ queryKey: ['interactions', 'my-work'] });
  };

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
