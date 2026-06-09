import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import type { CreateBuildPayload, PatchBuildPayload } from '@hub-crm/shared';

export function useBuilds(params: {
  unitId?: string;
  dealId?: string;
  status?: string;
  marginRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  incompleteCosting?: 1 | 0;
  incompletePricing?: 1 | 0;
  hasSubstitutions?: 1 | 0;
  q?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['builds', params],
    queryFn: () => client.get('/builds', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useBuild(id: string | null) {
  return useQuery({
    queryKey: ['builds', id],
    queryFn: () => client.get(`/builds/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useBuildVersions(id: string | null) {
  return useQuery({
    queryKey: ['builds', id, 'versions'],
    queryFn: () => client.get(`/builds/${id}/versions`).then(r => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useBuildChangeOrders(id: string | null) {
  return useQuery({
    queryKey: ['builds', id, 'change-orders'],
    queryFn: () => client.get(`/builds/${id}/change-orders`).then(r => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useBuildDiff(id: string | null, fromVersionId: string | null, toVersionId: string | null) {
  return useQuery({
    queryKey: ['builds', id, 'diff', fromVersionId, toVersionId],
    queryFn: () => client.get(`/builds/${id}/diff`, { params: { fromVersionId, toVersionId } }).then(r => r.data),
    enabled: !!id && !!fromVersionId && !!toVersionId,
    staleTime: 30_000,
  });
}

export function useBuildMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['builds'] });
    void qc.invalidateQueries({ queryKey: ['deals'] });
    void qc.invalidateQueries({ queryKey: ['units'] });
    void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
  };
  const create = useMutation({
    mutationFn: (payload: CreateBuildPayload) => client.post('/builds', payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PatchBuildPayload }) => client.patch(`/builds/${id}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const createVersion = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { reason: string; specItems: Array<Record<string, unknown>> } }) =>
      client.post(`/builds/${id}/versions`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const createChangeOrder = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { fromVersionId: string; toVersionId: string; reason: string; description?: string } }) =>
      client.post(`/builds/${id}/change-orders`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const updateChangeOrder = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'pending_approval' | 'approved' | 'rejected' }) =>
      client.patch(`/builds/change-orders/${id}`, { status }).then(r => r.data),
    onSuccess: invalidate,
  });
  return { create, update, createVersion, createChangeOrder, updateChangeOrder };
}
