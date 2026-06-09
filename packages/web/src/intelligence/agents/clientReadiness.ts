import { PV_FLAGSHIP_DEAL } from '../../data/perfectVenueSeed.js';
import type { AgentRunResult } from './types.js';
import { eventEntity, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

/** Portal-facing readiness signals — rules only */
export function runClientReadiness(ctx: IntelligenceDataContext): AgentRunResult {
  const signals = [];
  const flagship = eventEntity(PV_FLAGSHIP_DEAL.id, PV_FLAGSHIP_DEAL.title);

  const unpaid = PV_FLAGSHIP_DEAL.paymentMilestones.filter(m => m.status === 'due');
  if (unpaid.length) {
    signals.push(
      makeSignal({
        id: 'cr-pay',
        type: 'readiness_gap',
        severity: 'medium',
        sourceAgent: 'client-readiness',
        title: 'Final balance due',
        summary: unpaid.map(m => `${m.label} $${m.amount}`).join(' · '),
        ctx,
        entity: flagship,
        confidence: 90,
        triggerRule: 'paymentMilestone.status==due',
        requiresApproval: false,
        actions: [],
      }),
    );
  }

  const openSteps = PV_FLAGSHIP_DEAL.contractSteps.filter(s => !s.complete);
  if (openSteps.length) {
    signals.push(
      makeSignal({
        id: 'cr-check',
        type: 'readiness_gap',
        severity: 'low',
        sourceAgent: 'client-readiness',
        title: 'Planning items open',
        summary: openSteps.map(s => s.label).join(' · '),
        ctx,
        entity: flagship,
        confidence: 88,
        triggerRule: 'contractSteps incomplete',
      }),
    );
  }

  return {
    agentId: 'client-readiness',
    signals,
    recommendations: [
      {
        id: 'cr-concierge',
        sourceAgent: 'client-readiness',
        priority: 'medium',
        headline: PV_FLAGSHIP_DEAL.aiPlaybook.headline,
        rationale: PV_FLAGSHIP_DEAL.aiPlaybook.drivers.join(' · '),
        because: 'PV_FLAGSHIP_DEAL.aiPlaybook',
        confidence: 88,
        linkedEntity: flagship,
      },
    ],
    proposedActions: [],
  };
}
