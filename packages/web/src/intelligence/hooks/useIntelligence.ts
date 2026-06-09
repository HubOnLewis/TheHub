import { useMemo } from 'react';
import type { IntelligenceSnapshot } from '@hub-crm/shared';
import { runIntelligenceEngine } from '../engine.js';
import { summarizeOperationalRisk } from '../risk/operationalRisk.js';

export function useIntelligenceSnapshot(): IntelligenceSnapshot {
  return useMemo(() => runIntelligenceEngine(), []);
}

export function useIntelligenceScores() {
  const snap = useIntelligenceSnapshot();
  return snap.scores;
}

export function useTopSignals(limit = 8) {
  const snap = useIntelligenceSnapshot();
  return useMemo(() => {
    const weight = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...snap.signals]
      .sort((a, b) => weight[b.severity] - weight[a.severity] || b.confidence - a.confidence)
      .slice(0, limit);
  }, [snap, limit]);
}

export function useRiskSummary() {
  const snap = useIntelligenceSnapshot();
  return useMemo(() => summarizeOperationalRisk(snap.signals), [snap]);
}
