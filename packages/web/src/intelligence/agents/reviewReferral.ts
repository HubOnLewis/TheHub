import type { IntelligenceRecommendation, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import type { AgentRunResult } from './types.js';
import { eventEntity, makeAction, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runReviewReferral(ctx: IntelligenceDataContext): AgentRunResult {
  const signals: OperationalSignal[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const proposedActions: RecommendedAction[] = [];

  for (const e of ctx.events) {
    if (e.pvStatus === 'completed' || (e.pvStatus === 'confirmed' && e.eventDate < '2026-05-20')) {
      signals.push(
        makeSignal({
          id: `rr-elig-${e.id}`,
          type: 'review_eligible',
          severity: 'low',
          sourceAgent: 'review-referral',
          title: `Post-event · ${e.title}`,
          summary: 'Thank-you & review request eligible',
          ctx,
          entity: eventEntity(e.id, e.title),
          confidence: 80,
          triggerRule: 'completed_or_past_confirmed',
          requiresApproval: true,
          actions: [
            makeAction({
              id: `rr-req-${e.id}`,
              type: 'draft_message',
              title: `Review request · ${e.client}`,
              summary: 'Post-event gratitude sequence',
              sourceAgent: 'review-referral',
              confidence: 75,
              requiresApproval: true,
              entity: eventEntity(e.id, e.title),
            }),
          ],
        }),
      );
    }
  }

  const bingo = ctx.events.find(e => e.id === 'pv-bingo');
  if (bingo) {
    signals.push(
      makeSignal({
        id: 'rr-bingo',
        type: 'review_eligible',
        severity: 'low',
        sourceAgent: 'review-referral',
        title: 'Bingo fundraiser · nonprofit',
        summary: 'Mental health awareness — referral ask eligible',
        ctx,
        entity: eventEntity(bingo.id, bingo.title),
        confidence: 80,
        triggerRule: 'nonprofit_confirmed',
      }),
    );
  }

  return { agentId: 'review-referral', signals, recommendations, proposedActions };
}
