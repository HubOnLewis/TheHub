import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export type DashboardStats = {
  leadsByStatus?: Array<{ _id: string; count: number }>;
  dealsByStatus?: Array<{ _id: string; count: number; totalAmount: number }>;
  followUpOverdueOpen?: number;
  dueTodayActions?: number;
  criticalDeals?: number;
  highPressureDeals?: number;
  stalledDeals?: number;
  unassignedLeads?: number;
  unassignedDeals?: number;
  staleLeads?: { total: number; newUntouched: number };
  staleDeals?: { total: number; pendingApproval: number };
};

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => client.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    staleTime: 30_000,
    retry: false,
  });
}