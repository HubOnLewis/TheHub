import type { IntelligenceSnapshot } from '@hub-crm/shared';
import { AGENT_RUNNERS } from '../agents/index.js';
import { buildIntelligenceContext } from '../context/buildContext.js';
import { computeIntelligenceScores } from '../scoring/compute.js';
import { rankRecommendations } from '../recommendations/rank.js';
import { runWorkflowEngine } from '../workflow/engine.js';

export function runIntelligenceOrchestrator(asOf?: string): IntelligenceSnapshot {
  const ctx = buildIntelligenceContext(asOf);
  const agentResults = AGENT_RUNNERS.map(run => run(ctx));
  const signals = agentResults.flatMap(r => r.signals);
  const proposedActions = agentResults
    .flatMap(r => r.proposedActions)
    .filter(a => a.requiresApproval || a.type !== 'suggest_upsell');
  const { plans: workflowPlans } = runWorkflowEngine(ctx, agentResults);
  const recommendations = rankRecommendations(agentResults);
  const scores = computeIntelligenceScores(ctx);

  const agentActivity = agentResults.map((r, i) => ({
    id: `act-${r.agentId}`,
    agentId: r.agentId,
    summary: `${r.signals.length} signals · ${r.recommendations.length} recommendations`,
    at: ['2:14a', '3:40a', '4:55a', '7:05a', '9:12a', '9:50a', '10:05a', '10:20a'][i] ?? '—',
    state: r.proposedActions.some(a => a.requiresApproval)
      ? ('needs_review' as const)
      : ('completed' as const),
  }));

  return {
    generatedAt: ctx.asOf,
    context: {
      venueId: ctx.venueId,
      venueName: ctx.venueName,
      asOfDate: ctx.asOf.slice(0, 10),
      source: 'perfect-venue-seed',
      activeEventCount: ctx.activeEventCount,
    },
    scores,
    signals,
    recommendations,
    proposedActions,
    workflowPlans,
    agentActivity,
  };
}
