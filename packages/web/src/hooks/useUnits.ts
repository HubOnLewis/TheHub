// packages/web/src/hooks/useUnits.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import type { UnitStatus } from '@mtte-core/shared';
import type { CreateUnitPayload } from '@mtte-core/shared';

interface UnitsQuery {
  search?:  string;
  status?:  string;
  page?:    number;
  limit?:   number;
  sort?:    string;
  order?:   string;
}

export function useUnits(params: UnitsQuery = {}) {
  return useQuery({
    queryKey: ['units', params],
    queryFn:  () => client.get('/units', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useUnitSummary() {
  return useQuery({
    queryKey: ['units', 'summary'],
    queryFn:  () => client.get('/units/summary').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useUnitMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['units'] });

  const create = useMutation({
    mutationFn: (data: CreateUnitPayload) => client.post('/units', data).then(r => r.data),
    onSuccess:  invalidate,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UnitStatus }) =>
      client.patch(`/units/${id}/status`, { status }).then(r => r.data),
    onSuccess:  invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateUnitPayload> }) =>
      client.patch(`/units/${id}`, data).then(r => r.data),
    onSuccess:  invalidate,
  });

  return { create, setStatus, update };
}
