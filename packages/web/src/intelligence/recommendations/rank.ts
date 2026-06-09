import type { IntelligenceRecommendation } from '@hub-crm/shared';
import type { AgentRunResult } from '../agents/types.js';

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

export function rankRecommendations(results: AgentRunResult[]): IntelligenceRecommendation[] {
  return results
    .flatMap(r => r.recommendations)
    .sort(
      (a, b) =>
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || b.confidence - a.confidence,
    );
}
