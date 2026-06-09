import type { IntelligenceRecommendation, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import type { AgentRunResult } from './types.js';
import { daysUntil, eventEntity, makeAction, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runBalanceGuardian(ctx: IntelligenceDataContext): AgentRunResult {
  const signals: OperationalSignal[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const proposedActions: RecommendedAction[] = [];

  for (const e of ctx.events) {
    const until = daysUntil(e.eventDate, ctx.asOf);
    const entity = eventEntity(e.id, e.title);

    if (e.balanceDue > 0 && (e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due')) {
      const severity = e.balanceDue >= 300 && until < 14 ? 'high' : until < 7 ? 'critical' : 'medium';
      signals.push(
        makeSignal({
          id: `bg-bal-${e.id}`,
          type: 'balance_due',
          severity,
          sourceAgent: 'balance-guardian',
          title: `Balance due · ${e.title}`,
          summary: `${e.client} — $${e.balanceDue} remaining · $${e.depositPaid} collected.`,
          ctx,
          entity,
          confidence: 88,
          triggerRule: `balanceDue>0 && pvStatus in (confirmed,balance_due) && daysUntil=${until}`,
          requiresApproval: true,
          actions: [
            makeAction({
              id: `bg-act-${e.id}`,
              type: 'send_reminder',
              title: `Balance reminder · ${e.title}`,
              summary: `Final $${e.balanceDue} due before event.`,
              sourceAgent: 'balance-guardian',
              confidence: 86,
              requiresApproval: true,
              entity,
            }),
          ],
        }),
      );
    }

    if (e.pvStatus === 'proposal_sent' && e.depositPaid === 0) {
      signals.push(
        makeSignal({
          id: `bg-nodep-${e.id}`,
          type: 'proposal_viewed_no_deposit',
          severity: 'high',
          sourceAgent: 'balance-guardian',
          title: `No deposit · ${e.title}`,
          summary: `Proposal active — $${e.value} package without deposit path.`,
          ctx,
          entity,
          confidence: 84,
          triggerRule: 'proposal_sent && depositPaid==0',
        }),
      );
    }
  }

  const top = ctx.events.filter(e => e.balanceDue > 0).sort((a, b) => b.balanceDue - a.balanceDue)[0];
  if (top) {
    recommendations.push({
      id: 'bg-rec-top',
      sourceAgent: 'balance-guardian',
      priority: 'high',
      headline: `Collect ${top.title} balance before event`,
      rationale: `$${top.balanceDue} outstanding · cash-flow protection.`,
      because: `Highest balance_due in PV pipeline.`,
      confidence: 90,
      linkedEntity: eventEntity(top.id, top.title),
    });
    proposedActions.push(
      makeAction({
        id: 'bg-act-escalate',
        type: 'notify_owner',
        title: 'Owner escalation · balance concentration',
        summary: 'Multiple balances due within 14 days — review collection cadence.',
        sourceAgent: 'balance-guardian',
        confidence: 82,
        requiresApproval: true,
      }),
    );
  }

  return { agentId: 'balance-guardian', signals, recommendations, proposedActions };
}
