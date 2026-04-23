import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export interface AccountCoverageRow {
  companyId: string;
  companyName: string;
  accountPenetrationState: {
    lastInteractionAt?: string;
    daysSinceLastInteraction?: number;
    totalInteractions30d: number;
    totalInteractions90d: number;
    uniqueContacts30d: number;
    uniqueContacts90d: number;
    openDeals: number;
    activeDeals: number;
    stalledDeals: number;
    criticalDeals: number;
    openFollowUps: number;
    overdueFollowUps: number;
    assignedOwnerUserId?: string;
    assignedOwnerName?: string;
    penetrationLevel: 'low' | 'medium' | 'high';
    penetrationReasons: string[];
    coverageRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    coverageRiskReasons: string[];
    whitespaceSignals: string[];
  };
  accountCoverageWarnings: string[];
}

export function useAccountCoverage(params: {
  ownerUserId?: string;
  penetrationLevel?: 'low' | 'medium' | 'high';
  coverageRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  hasOpenDeals?: 1 | 0;
  hasOverdueFollowUps?: 1 | 0;
  hasWhitespace?: 1 | 0;
  q?: string;
} = {}) {
  return useQuery({
    queryKey: ['account-coverage', params],
    queryFn: () => client.get<AccountCoverageRow[]>('/account-coverage', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}
