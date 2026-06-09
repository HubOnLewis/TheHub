import type { IntelligenceRecommendation, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import type { AgentRunResult } from './types.js';
import { daysUntil, eventEntity, makeAction, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runFollowUpHunter(ctx: IntelligenceDataContext): AgentRunResult {
  const signals: OperationalSignal[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const proposedActions: RecommendedAction[] = [];

  for (const q of ctx.inquiries) {
    if (q.sla !== 'Met') {
      signals.push(
        makeSignal({
          id: `fh-inq-${q.id}`,
          type: 'inquiry_aging',
          severity: q.sla.includes('h') ? 'high' : 'medium',
          sourceAgent: 'follow-up-hunter',
          title: `Inquiry SLA · ${q.who}`,
          summary: `${q.what} · ${q.when}`,
          ctx,
          entity: { kind: 'inquiry', id: q.id, label: q.org },
          confidence: 80,
          triggerRule: `inquiry.sla!=Met (${q.sla})`,
          requiresApproval: true,
          actions: [
            makeAction({
              id: `fh-draft-${q.id}`,
              type: 'draft_message',
              title: `Follow up · ${q.who}`,
              summary: 'Warm check-in on inquiry progress.',
              sourceAgent: 'follow-up-hunter',
              confidence: 78,
              requiresApproval: true,
            }),
          ],
        }),
      );
    }
  }

  for (const e of ctx.events) {
    const entity = eventEntity(e.id, e.title);
    if (e.pvStatus === 'proposal_sent') {
      const closeScore = e.depositPaid > 0 ? 72 : 48;
      signals.push(
        makeSignal({
          id: `fh-prop-${e.id}`,
          type: 'proposal_sent_idle',
          severity: 'medium',
          sourceAgent: 'follow-up-hunter',
          title: `Proposal follow-up · ${e.title}`,
          summary: `${e.client} — conversion probability ~${closeScore}%.`,
          ctx,
          entity,
          confidence: 82,
          triggerRule: 'pvStatus==proposal_sent',
        }),
      );
      if (e.value >= 650) {
        recommendations.push({
          id: `fh-rec-${e.id}`,
          sourceAgent: 'follow-up-hunter',
          priority: 'high',
          headline: `High-value proposal · ${e.title}`,
          rationale: 'Likely to close with deposit nudge.',
          because: `value>=650 && proposal_sent`,
          confidence: closeScore,
          linkedEntity: entity,
        });
      }
    }
    if (e.pvStatus === 'qualified' && daysUntil(e.eventDate, ctx.asOf) < 120) {
      signals.push(
        makeSignal({
          id: `fh-qual-${e.id}`,
          type: 'qualified_no_touch',
          severity: 'low',
          sourceAgent: 'follow-up-hunter',
          title: `Qualified · ${e.title}`,
          summary: `${e.guests} guests · ${e.eventDate}.`,
          ctx,
          entity,
          confidence: 76,
          triggerRule: 'pvStatus==qualified',
        }),
      );
    }
  }

  proposedActions.push(
    makeAction({
      id: 'fh-act-batch',
      type: 'queue_approval',
      title: 'Batch proposal follow-ups',
      summary: 'Queue coordinator-approved touches for stale proposals.',
      sourceAgent: 'follow-up-hunter',
      confidence: 85,
      requiresApproval: true,
    }),
  );

  return { agentId: 'follow-up-hunter', signals, recommendations, proposedActions };
}
