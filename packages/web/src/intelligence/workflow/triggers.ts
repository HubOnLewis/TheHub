import type { WorkflowTriggerMatch } from '@hub-crm/shared';
import type { IntelligenceDataContext } from '../context/types.js';
import { daysUntil } from '../agents/utils.js';

export const WORKFLOW_TRIGGER_IDS = [
  'proposal_sent',
  'proposal_viewed_no_deposit',
  'balance_overdue',
  'event_approaching',
  'checklist_incomplete',
  'inquiry_idle',
  'contract_signed',
  'payment_received',
] as const;

export function evaluateWorkflowTriggers(ctx: IntelligenceDataContext): WorkflowTriggerMatch[] {
  const matches: WorkflowTriggerMatch[] = [];
  const asOf = ctx.asOf;

  for (const e of ctx.events) {
    const entity = { kind: 'event' as const, id: e.id, label: e.title };
    if (e.pvStatus === 'proposal_sent') {
      matches.push({ triggerId: 'proposal_sent', entity, firedAt: asOf });
    }
    if (e.pvStatus === 'proposal_sent' && e.depositPaid === 0) {
      matches.push({ triggerId: 'proposal_viewed_no_deposit', entity, firedAt: asOf });
    }
    if (e.balanceDue > 0 && daysUntil(e.eventDate, asOf) < 21) {
      matches.push({ triggerId: 'balance_overdue', entity, firedAt: asOf });
    }
    const d = daysUntil(e.eventDate, asOf);
    if (d >= 0 && d <= 14 && e.pvStatus === 'confirmed') {
      matches.push({ triggerId: 'event_approaching', entity, firedAt: asOf });
    }
    if (e.depositPaid > 0) {
      matches.push({ triggerId: 'payment_received', entity, firedAt: asOf });
    }
  }

  for (const q of ctx.inquiries) {
    if (q.sla !== 'Met') {
      matches.push({
        triggerId: 'inquiry_idle',
        entity: { kind: 'inquiry', id: q.id, label: q.org },
        firedAt: asOf,
      });
    }
  }

  return matches;
}
