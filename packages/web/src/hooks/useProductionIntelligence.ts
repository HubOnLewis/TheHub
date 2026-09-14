import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export function useTodayIntelligence() {
  return useQuery({ queryKey: ['intelligence', 'today'], queryFn: () => client.get('/intelligence/today').then(r => r.data), staleTime: 30_000 });
}
export function useRevenueLeakIntelligence() {
  return useQuery({ queryKey: ['intelligence', 'revenue-leaks'], queryFn: () => client.get('/intelligence/revenue-leaks').then(r => r.data), staleTime: 30_000 });
}
export function useAutopilotIntelligence() {
  return useQuery({ queryKey: ['intelligence', 'autopilot'], queryFn: () => client.get('/intelligence/autopilot').then(r => r.data), staleTime: 30_000 });
}
export function useProductionAudit() {
  return useQuery({ queryKey: ['intelligence', 'audit'], queryFn: () => client.get('/intelligence/audit').then(r => r.data), staleTime: 30_000 });
}
