import type { IntelligenceRecommendation, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import type { AgentRunResult } from './types.js';
import { daysUntil, eventEntity, makeAction, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runBookingCoordinator(ctx: IntelligenceDataContext): AgentRunResult {
  const signals: OperationalSignal[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const proposedActions: RecommendedAction[] = [];

  for (const t of ctx.tasks) {
    if (t.title.includes('Kisi') || t.automationSource) {
      signals.push(
        makeSignal({
          id: `bc-task-${t.id}`,
          type: 'automated_task_due',
          severity: t.overdue ? 'high' : t.priority === 'urgent' ? 'medium' : 'low',
          sourceAgent: 'booking-coordinator',
          title: `Ops task · ${t.title}`,
          summary: `${t.linkedEvent} · due in ${t.daysUntil}d`,
          ctx,
          entity: { kind: 'task', id: t.id, label: t.linkedEvent },
          confidence: 91,
          triggerRule: 'task.kisi_or_automation',
          requiresApproval: true,
        }),
      );
    }
  }

  for (const e of ctx.events) {
    const until = daysUntil(e.eventDate, ctx.asOf);
    const entity = eventEntity(e.id, e.title);
    if ((e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due') && until <= 14 && until >= 0) {
      const tasks: string[] = [];
      if (until <= 10) tasks.push('Kisi access email');
      if (e.guests >= 25) tasks.push('Final headcount lock');
      if (until <= 7) tasks.push('Walkthrough / load-in window');
      signals.push(
        makeSignal({
          id: `bc-pre-${e.id}`,
          type: 'pre_event_window',
          severity: until <= 3 ? 'high' : 'medium',
          sourceAgent: 'booking-coordinator',
          title: `Event readiness · ${e.title}`,
          summary: tasks.join(' · ') || 'Prep checklist review',
          ctx,
          entity,
          confidence: 89,
          triggerRule: `confirmed && daysUntil<=${until}`,
        }),
      );
    }
  }

  recommendations.push({
    id: 'bc-rec-kisi',
    sourceAgent: 'booking-coordinator',
    priority: 'high',
    headline: 'Approve Kisi email batch before June load-in week',
    rationale: 'PV automated tasks queue door-access for Dufferfest & Miller/Harris.',
    because: 'Send Kisi Email tasks in PV_TASKS',
    confidence: 91,
  });

  proposedActions.push(
    makeAction({
      id: 'bc-act-kisi',
      type: 'queue_approval',
      title: 'Approve Kisi batch · Dufferfest + Miller/Harris',
      summary: 'Door codes and timed access — human approval required.',
      sourceAgent: 'booking-coordinator',
      confidence: 91,
      requiresApproval: true,
    }),
    makeAction({
      id: 'bc-act-walk',
      type: 'create_task',
      title: 'Schedule walkthroughs · June cluster',
      summary: 'Internal task — Event Space flips Jun 6–7.',
      sourceAgent: 'booking-coordinator',
      confidence: 80,
      requiresApproval: false,
    }),
  );

  return { agentId: 'booking-coordinator', signals, recommendations, proposedActions };
}
