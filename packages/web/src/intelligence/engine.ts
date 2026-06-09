import type { IntelligenceSnapshot } from '@hub-crm/shared';
import { runIntelligenceOrchestrator } from './automation/orchestrator.js';
import { clearIntelligenceCache, getCachedIntelligence, setCachedIntelligence } from './cache.js';

export function runIntelligenceEngine(force = false): IntelligenceSnapshot {
  if (!force) {
    const hit = getCachedIntelligence();
    if (hit) return hit;
  }
  const snapshot = runIntelligenceOrchestrator();
  setCachedIntelligence(snapshot);
  return snapshot;
}

export function resetIntelligenceEngine(): void {
  clearIntelligenceCache();
}

export { runIntelligenceOrchestrator } from './automation/orchestrator.js';
export { computeIntelligenceScores } from './scoring/compute.js';
export { buildIntelligenceContext } from './context/buildContext.js';
