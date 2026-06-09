import { PV_EXECUTIVE_ANCHORS, PV_VENUE_SUMMARY } from '../../data/perfectVenueSeed.js';
import type { AgentRunResult } from './types.js';
import { makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runOwnerBriefing(ctx: IntelligenceDataContext): AgentRunResult {
  const signals = [
    makeSignal({
      id: 'ob-daily',
      type: 'daily_priority_stack',
      severity: 'low',
      sourceAgent: 'owner-briefing',
      title: 'Daily executive stack',
      summary: PV_EXECUTIVE_ANCHORS.focusHeadline,
      ctx,
      confidence: 95,
      triggerRule: 'scheduled.daily_briefing',
    }),
    makeSignal({
      id: 'ob-kpi',
      type: 'daily_priority_stack',
      severity: 'low',
      sourceAgent: 'owner-briefing',
      title: 'Venue KPI snapshot',
      summary: `${PV_VENUE_SUMMARY.activeEvents} active · ${PV_VENUE_SUMMARY.proposalSent} proposals · ${PV_VENUE_SUMMARY.confirmed} confirmed`,
      ctx,
      confidence: 95,
      triggerRule: 'venuesEventsSummary',
    }),
  ];

  const recommendations = PV_EXECUTIVE_ANCHORS.staleProposals.slice(0, 3).map((s, i) => ({
    id: `ob-stale-${i}`,
    sourceAgent: 'owner-briefing' as const,
    priority: (s.days > 20 ? 'high' : 'medium') as 'high' | 'medium',
    headline: `${s.title} · ${s.days}d open`,
    rationale: `Proposal aging — $${s.value} at risk`,
    because: 'PV_EXECUTIVE_ANCHORS.staleProposals',
    confidence: 88,
  }));

  return { agentId: 'owner-briefing', signals, recommendations, proposedActions: [] };
}
