import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export function useDeliveryRecords(params: { status?: string; productionJobId?: string; buildId?: string; q?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['delivery', params],
    queryFn: () => client.get('/delivery', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDeliveryRecord(id: string | null) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: () => client.get(`/delivery/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCloseoutChecklist(productionJobId: string | null) {
  return useQuery({
    queryKey: ['delivery', 'closeout', productionJobId],
    queryFn: () => client.get(`/delivery/production-job/${productionJobId}/closeout`).then(r => r.data),
    enabled: !!productionJobId,
    staleTime: 30_000,
  });
}

export function useDeliveryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['delivery'] });
    void qc.invalidateQueries({ queryKey: ['production'] });
    void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    void qc.invalidateQueries({ queryKey: ['deals'] });
    void qc.invalidateQueries({ queryKey: ['companies'] });
  };
  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.post('/delivery', payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => client.patch(`/delivery/${id}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const updateCloseout = useMutation({
    mutationFn: ({ productionJobId, payload }: { productionJobId: string; payload: Record<string, unknown> }) =>
      client.patch(`/delivery/production-job/${productionJobId}/closeout`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const createPacket = useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload: Record<string, unknown> }) =>
      client.post(`/delivery/${deliveryId}/packet`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const updatePacket = useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload: Record<string, unknown> }) =>
      client.patch(`/delivery/${deliveryId}/packet`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const createFollowUp = useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload: Record<string, unknown> }) =>
      client.post(`/delivery/${deliveryId}/post-delivery-follow-ups`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const updateFollowUp = useMutation({
    mutationFn: ({ followUpId, payload }: { followUpId: string; payload: Record<string, unknown> }) =>
      client.patch(`/delivery/follow-ups/${followUpId}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  return { create, update, updateCloseout, createPacket, updatePacket, createFollowUp, updateFollowUp };
}
