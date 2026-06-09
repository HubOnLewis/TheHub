import type { WorkflowActionPlan, WorkflowTriggerMatch } from '@hub-crm/shared';
import type { IntelligenceDataContext } from '../context/types.js';
import type { AgentRunResult } from '../agents/types.js';
import { evaluateWorkflowTriggers } from './triggers.js';

export function buildWorkflowPlans(
  ctx: IntelligenceDataContext,
  triggers: WorkflowTriggerMatch[],
  agentResults: AgentRunResult[],
): WorkflowActionPlan[] {
  const actions = agentResults.flatMap(r => r.proposedActions);
  const plans: WorkflowActionPlan[] = [];

  for (const t of triggers) {
    const related = actions.filter(
      a => a.linkedEntity?.id === t.entity.id || a.summary.toLowerCase().includes(t.entity.label.toLowerCase().slice(0, 8)),
    );
    if (related.length === 0) continue;
    plans.push({
      id: `wf-${t.triggerId}-${t.entity.id}`,
      triggerId: t.triggerId,
      actions: related,
    });
  }

  return plans;
}

export function runWorkflowEngine(
  ctx: IntelligenceDataContext,
  agentResults: AgentRunResult[],
): { triggers: WorkflowTriggerMatch[]; plans: WorkflowActionPlan[] } {
  const triggers = evaluateWorkflowTriggers(ctx);
  const plans = buildWorkflowPlans(ctx, triggers, agentResults);
  return { triggers, plans };
}
