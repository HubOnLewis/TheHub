import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

export interface RepScorecard {
  ownerUserId: string;
  ownerName?: string;
  interactionMetrics: {
    total30d: number;
    calls30d: number;
    meetings30d: number;
    notes30d: number;
    avgPerWorkday30d?: number;
    daysSinceLastInteraction?: number;
  };
  followUpMetrics: {
    open: number;
    overdue: number;
    completed30d: number;
    overdueRate?: number;
  };
  dealMetrics: {
    openDeals: number;
    stalledDeals: number;
    criticalDeals: number;
    highPressureDeals: number;
    dealsWithoutRecentActivity: number;
    atRiskDeals: number;
  };
  forecastMetrics: {
    commitCount: number;
    bestCaseCount: number;
    pipelineCount: number;
    excludedCount: number;
    commitAmount: number;
    bestCaseAmount: number;
    pipelineAmount: number;
    excludedAmount: number;
    lowConfidenceLateStageDeals: number;
    dealsNeedingManagementReview: number;
  };
  executionMetrics: {
    dealsWithOpenFollowUps: number;
    dealsWithOverdueFollowUps: number;
    dealsWithNextAction: number;
    dealsWithoutNextAction: number;
    interactionCoverageRate?: number;
    followUpDisciplineRate?: number;
  };
  ownerCoverageSummary?: {
    ownedAccounts: number;
    activeAccounts30d: number;
    inactiveAccounts90d: number;
    lowPenetrationAccounts: number;
    criticalCoverageRiskAccounts: number;
    accountsWithSingleContactDependency: number;
  };
  coachingSignals: string[];
}

export function useRepScorecards(params: {
  ownerUserId?: string;
  hasOverdueFollowUps?: 1 | 0;
  hasCriticalDeals?: 1 | 0;
  hasDealsNeedingReview?: 1 | 0;
  q?: string;
  activeOnly?: 1 | 0;
  days?: number;
} = {}) {
  return useQuery({
    queryKey: ['rep-scorecards', params],
    queryFn: () => client.get<RepScorecard[]>('/rep-scorecards', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useRepScorecard(ownerUserId: string | null, days = 30) {
  return useQuery({
    queryKey: ['rep-scorecards', ownerUserId, days],
    queryFn: () => client.get<RepScorecard | null>(`/rep-scorecards/${ownerUserId}`, { params: { days } }).then(r => r.data),
    enabled: !!ownerUserId,
    staleTime: 30_000,
  });
}

export interface WeeklyCadenceReview {
  _id: string;
  ownerUserId: string;
  ownerName?: string;
  weekStart: string;
  weekEnd: string;
  summary?: string;
  priorities?: string[];
  risks?: string[];
  commitments?: string[];
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
}

export function useWeeklyCadenceReviews(params: {
  ownerUserId?: string;
  weekStart?: string;
  weekEnd?: string;
  reviewedByUserId?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['weekly-cadence-reviews', params],
    queryFn: () =>
      client.get<{ data: WeeklyCadenceReview[]; total: number; page: number; pages: number; limit: number }>(
        '/weekly-cadence-reviews',
        { params },
      ).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useWeeklyCadenceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['weekly-cadence-reviews'] });
  };
  const create = useMutation({
    mutationFn: (payload: Omit<WeeklyCadenceReview, '_id'>) =>
      client.post('/weekly-cadence-reviews', payload).then(r => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<WeeklyCadenceReview, '_id'>> }) =>
      client.patch(`/weekly-cadence-reviews/${id}`, payload).then(r => r.data),
    onSuccess: invalidate,
  });
  return { create, update };
}
