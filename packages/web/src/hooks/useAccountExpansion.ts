import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export interface AccountExpansionRow {
  companyId: string;
  companyName: string;
  accountPenetrationState: {
    assignedOwnerUserId?: string;
    assignedOwnerName?: string;
    penetrationLevel: 'low' | 'medium' | 'high';
    coverageRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    daysSinceLastInteraction?: number;
    uniqueContacts30d: number;
    uniqueContacts90d: number;
    openDeals: number;
    activeDeals: number;
    stalledDeals: number;
    criticalDeals: number;
    openFollowUps: number;
    overdueFollowUps: number;
  };
  accountCoverageWarnings: string[];
  accountPlanId?: string;
  accountPlanStatus?: 'draft' | 'active' | 'paused' | 'completed';
  hasPlan: boolean;
  accountExpansionState: {
    expansionReadiness: 'low' | 'medium' | 'high';
    expansionReasons: string[];
    blockers: string[];
    opportunitySignals: string[];
    hasActiveExpansionMotion: boolean;
    hasOpenPipeline: boolean;
    hasRecentActivity: boolean;
    planningPriority: 'low' | 'medium' | 'high' | 'urgent';
    planningReasons: string[];
  };
}

export interface AccountPlan {
  _id: string;
  companyId: string;
  companyName?: string;
  ownerUserId?: string;
  ownerName?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  objectives: string[];
  opportunities: string[];
  risks: string[];
  nextSteps: string[];
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
}

export function useAccountExpansion(params: {
  ownerUserId?: string;
  expansionReadiness?: 'low' | 'medium' | 'high';
  planningPriority?: 'low' | 'medium' | 'high' | 'urgent';
  hasPlan?: 1 | 0;
  hasOpenPipeline?: 1 | 0;
  hasBlockers?: 1 | 0;
  q?: string;
} = {}) {
  return useQuery({
    queryKey: ['account-expansion', params],
    queryFn: () => client.get<AccountExpansionRow[]>('/account-expansion', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useAccountPlans(params: {
  ownerUserId?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed';
  q?: string;
  companyId?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['account-plans', params],
    queryFn: () =>
      client.get<{ data: AccountPlan[]; total: number; page: number; pages: number; limit: number }>('/account-plans', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useCompanyAccountPlan(companyId: string | null) {
  return useQuery({
    queryKey: ['companies', companyId, 'account-plan'],
    queryFn: () => client.get<AccountPlan | null>(`/companies/${companyId}/account-plan`).then(r => r.data),
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

export function useAccountPlanMutations(companyId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['account-plans'] });
    void qc.invalidateQueries({ queryKey: ['account-expansion'] });
    void qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    if (companyId) {
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'summary'] });
      void qc.invalidateQueries({ queryKey: ['companies', companyId, 'account-plan'] });
    }
  };
  const create = useMutation({
    mutationFn: (payload: Omit<AccountPlan, '_id' | 'reviewedAt' | 'reviewedByUserId' | 'reviewedByName'>) =>
      client.post<AccountPlan>('/account-plans', payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<AccountPlan, '_id'>> }) =>
      client.patch<AccountPlan>(`/account-plans/${id}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  return { create, update };
}
