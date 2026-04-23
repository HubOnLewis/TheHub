import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export function useProductionJobs(params: {
  status?: 'queued' | 'ready' | 'in_progress' | 'paused' | 'completed';
  assignedTeam?: string;
  buildId?: string;
  unitId?: string;
  q?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['production', params],
    queryFn: () => client.get('/production', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useProductionJob(id: string | null) {
  return useQuery({
    queryKey: ['production', id],
    queryFn: () => client.get(`/production/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useProductionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['production'] });
    void qc.invalidateQueries({ queryKey: ['builds'] });
    void qc.invalidateQueries({ queryKey: ['deals'] });
    void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
  };
  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.post('/production', payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => client.patch(`/production/${id}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  return { create, update };
}
