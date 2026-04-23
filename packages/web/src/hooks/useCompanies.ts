// packages/web/src/hooks/useCompanies.ts
import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export interface CompanyAddress {
  street?:     string;
  city?:       string;
  state?:      string;
  postalCode?: string;
}

export interface Company {
  _id:                  string;
  tenantId:             string;
  name:                 string;
  address?:             CompanyAddress;
  phone?:               string;
  source:               string;
  sourceId:             string;
  daysSinceLastContact?: number;
  isStub:               boolean;
  createdAt:            string;
  updatedAt:            string;
}

export interface CompanySummary {
  dealCount:          number;
  openPipelineTotal:  number;
  wonTotal:           number;
  nextFollowUp:       {
    date:      string;
    summary:   string;
    isOverdue: boolean;
    ownerName: string;
  } | null;
  engagementState?: {
    lastInteractionAt: string | null;
    daysSinceLastInteraction: number | null;
    openFollowUps: number;
    overdueFollowUps: number;
    nextActionSummary: string | null;
    isStale: boolean;
  };
  accountPenetrationState?: {
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
  accountCoverageWarnings?: string[];
  accountExpansionState?: {
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
  accountPlan?: {
    _id: string;
    status: 'draft' | 'active' | 'paused' | 'completed';
    ownerUserId?: string;
    ownerName?: string;
    objectives: string[];
    opportunities: string[];
    risks: string[];
    nextSteps: string[];
    reviewedAt?: string;
    reviewedByName?: string;
  } | null;
}

interface CompaniesQuery {
  search?: string;
  source?: string;
  page?:   number;
  limit?:  number;
  sort?:   string;
  order?:  string;
}

export function useCompanies(params: CompaniesQuery = {}) {
  return useQuery({
    queryKey:  ['companies', params],
    queryFn:   () => client.get('/companies', { params }).then(r => r.data),
    staleTime: 60_000,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey:  ['companies', id],
    queryFn:   () => client.get(`/companies/${id}`).then(r => r.data),
    staleTime: 60_000,
    enabled:   !!id,
  });
}

export function useCompanySummary(companyId: string) {
  return useQuery({
    queryKey:  ['companies', companyId, 'summary'],
    queryFn:   () => client.get(`/companies/${companyId}/summary`).then(r => r.data as CompanySummary),
    staleTime: 120_000,
    enabled:   !!companyId,
  });
}

/** Autocomplete search — only fires when q has at least 2 characters */
export function useCompanySearch(q: string) {
  return useQuery({
    queryKey:  ['companies', 'search', q],
    queryFn:   () => client.get('/companies/search', { params: { q, limit: 10 } }).then(r => r.data as Company[]),
    staleTime: 30_000,
    enabled:   q.trim().length >= 2,
  });
}
