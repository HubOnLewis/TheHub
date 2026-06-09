import { PV_FLAGSHIP_DEAL } from '../../data/perfectVenueSeed.js';
import type { IntelligenceRecommendation, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import type { AgentRunResult } from './types.js';
import { eventEntity, makeAction, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runRevenueLift(ctx: IntelligenceDataContext): AgentRunResult {
  const signals: OperationalSignal[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const proposedActions: RecommendedAction[] = [];

  for (const e of ctx.events) {
    if (e.pvStatus === 'confirmed' && e.depositPaid > 0 && e.value > 400) {
      signals.push(
        makeSignal({
          id: `rl-up-${e.id}`,
          type: 'upsell_window',
          severity: 'low',
          sourceAgent: 'revenue-lift',
          title: `Upsell window · ${e.title}`,
          summary: `Deposit on file — ${e.eventType} · ${e.guests} guests`,
          ctx,
          entity: eventEntity(e.id, e.title),
          confidence: 74,
          triggerRule: 'confirmed && depositPaid>0',
        }),
      );
    }
    if (e.guests >= 75) {
      recommendations.push({
        id: `rl-av-${e.id}`,
        sourceAgent: 'revenue-lift',
        priority: 'low',
        headline: `AV / staffing upgrade · ${e.title}`,
        rationale: 'High guest count — premium layout opportunity',
        because: `guests>=75`,
        confidence: 70,
        linkedEntity: eventEntity(e.id, e.title),
      });
    }
  }

  for (const upsell of PV_FLAGSHIP_DEAL.aiUpsells) {
    recommendations.push({
      id: `rl-flag-${upsell.slice(0, 12)}`,
      sourceAgent: 'revenue-lift',
      priority: 'medium',
      headline: upsell,
      rationale: 'Flagship deal playbook',
      because: 'PV_FLAGSHIP_DEAL.aiUpsells',
      confidence: 72,
      linkedEntity: eventEntity(PV_FLAGSHIP_DEAL.id, PV_FLAGSHIP_DEAL.title),
    });
  }

  proposedActions.push(
    makeAction({
      id: 'rl-suggest-dessert',
      type: 'suggest_upsell',
      title: 'Surface dessert station · Miller/Harris',
      summary: PV_FLAGSHIP_DEAL.aiUpsells[0] ?? 'Add-on from playbook',
      sourceAgent: 'revenue-lift',
      confidence: 72,
      requiresApproval: false,
    }),
  );

  return { agentId: 'revenue-lift', signals, recommendations, proposedActions };
}
