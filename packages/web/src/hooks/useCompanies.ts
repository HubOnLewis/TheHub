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

export interface Activity {
  _id:              string;
  source:           string;
  sourceId:         string;
  companyId?:       string;
  companyNameRaw:   string;
  contactNameRaw?:  string;
  activityTypeRaw:  string;
  activityType:     string;
  createdAt:        string;
  createdByName:    string;
  milesFromCompany?: number;
  body:             string;
  tags:             Record<string, boolean>;
}

interface CompaniesQuery {
  search?: string;
  source?: string;
  page?:   number;
  limit?:  number;
  sort?:   string;
  order?:  string;
}

interface ActivitiesQuery {
  page?:  number;
  limit?: number;
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

export function useCompanyActivities(companyId: string, params: ActivitiesQuery = {}) {
  return useQuery({
    queryKey:  ['companies', companyId, 'activities', params],
    queryFn:   () => client.get(`/companies/${companyId}/activities`, { params }).then(r => r.data),
    staleTime: 60_000,
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
