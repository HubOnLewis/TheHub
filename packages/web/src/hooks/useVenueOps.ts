import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VenueOpsTask } from '@hub-crm/shared';
import client from '../api/client.js';

export type VenueOpsQueueResponse = {
  tasks: VenueOpsTask[];
  summary: { total: number; high: number; followUps: number; holds: number };
  asOf: string;
};

export function useVenueOpsQueue() {
  return useQuery({
    queryKey: ['venue-ops', 'queue'],
    queryFn: () => client.get<VenueOpsQueueResponse>('/venue-ops/queue').then(r => r.data),
    staleTime: 20_000,
    retry: false,
  });
}

export function useVenueOpsTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { taskId: string; dealId: string; action: 'complete' | 'snooze' | 'start' | 'block' | 'request_approval' | 'reopen'; snoozeDays?: number; note?: string }) =>
      client.post('/venue-ops/tasks', body).then(r => r.data),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['venue-ops'] });
      await qc.invalidateQueries({ queryKey: ['deal', vars.dealId] });
      await qc.invalidateQueries({ queryKey: ['deals'] });
      await qc.invalidateQueries({ queryKey: ['intelligence'] });
    },
  });
}

export function useVenueOpsTaskAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      taskId: string;
      dealId: string;
      assignee: { type: 'user' | 'agent' | 'unassigned'; id: string; name: string };
      reason?: string;
    }) => client.post('/venue-ops/tasks/assign', body).then(r => r.data),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['venue-ops'] });
      await qc.invalidateQueries({ queryKey: ['deal', vars.dealId] });
    },
  });
}
