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

export function useProductionTasks(productionJobId: string | null) {
  return useQuery({
    queryKey: ['production', productionJobId, 'tasks'],
    queryFn: () => client.get(`/production/${productionJobId}/tasks`).then(r => r.data),
    enabled: !!productionJobId,
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
  const createTask = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.post('/production/tasks', payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const updateTask = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => client.patch(`/production/tasks/${id}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const generateDefaultTasks = useMutation({
    mutationFn: (jobId: string) => client.post(`/production/${jobId}/tasks/generate-default`).then(r => r.data),
    onSuccess: invalidate,
  });
  return { create, update, createTask, updateTask, generateDefaultTasks };
}
