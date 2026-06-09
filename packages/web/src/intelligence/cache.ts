import type { IntelligenceSnapshot } from '@hub-crm/shared';

let cached: IntelligenceSnapshot | null = null;
let cacheKey = '';

export function getCachedIntelligence(key = 'pv-default'): IntelligenceSnapshot | null {
  if (cacheKey === key && cached) return cached;
  return null;
}

export function setCachedIntelligence(snapshot: IntelligenceSnapshot, key = 'pv-default'): void {
  cached = snapshot;
  cacheKey = key;
}

export function clearIntelligenceCache(): void {
  cached = null;
  cacheKey = '';
}
