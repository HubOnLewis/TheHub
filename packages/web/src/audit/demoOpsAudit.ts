/**
 * Audit hooks for demoOpsStore actions — keeps store file readable.
 */

import { logAudit, logAgentAudit } from './logAudit.js';

export function auditApprovalApproved(id: string, title: string, agentName: string): void {
  logAudit({
    action: 'approval_approved',
    entityType: 'agent_approval',
    entityId: id,
    entityName: title,
    afterSummary: `Approved · proposed by ${agentName}`,
    severity: 'notice',
    visibleToClientReview: true,
  });
}

export function auditApprovalDismissed(id: string, title: string): void {
  logAudit({
    action: 'approval_dismissed',
    entityType: 'agent_approval',
    entityId: id,
    entityName: title,
    afterSummary: 'Dismissed by coordinator',
    severity: 'info',
  });
}

export function auditApprovalQueued(id: string, title: string): void {
  logAudit({
    action: 'approval_queued',
    entityType: 'agent_approval',
    entityId: id,
    entityName: title,
    afterSummary: 'Queued for later review',
  });
}

export function auditApprovalEdited(id: string, title: string): void {
  logAudit({
    action: 'approval_edited',
    entityType: 'agent_approval',
    entityId: id,
    entityName: title,
    afterSummary: 'Edit requested before send',
  });
}

export function auditTaskCompleted(taskId: string, title: string): void {
  logAudit({
    action: 'task_completed',
    entityType: 'task',
    entityId: taskId,
    entityName: title,
    afterSummary: 'Marked complete',
    visibleToClientReview: true,
  });
}

export function auditTaskReopened(taskId: string, title: string): void {
  logAudit({
    action: 'task_reopened',
    entityType: 'task',
    entityId: taskId,
    entityName: title,
    afterSummary: 'Reopened',
  });
}

export function auditTaskCreated(taskId: string, title: string, source?: string): void {
  logAudit({
    action: 'created',
    entityType: 'task',
    entityId: taskId,
    entityName: title,
    afterSummary: source ?? 'Task added',
  });
}

export function auditDealStage(before: string, after: string): void {
  logAudit({
    action: 'status_changed',
    entityType: 'opportunity',
    entityId: 'pv-miller-harris',
    entityName: 'Miller/Harris Baby Shower',
    beforeSummary: before,
    afterSummary: after,
    visibleToClientReview: true,
    severity: 'notice',
  });
}

export function auditDealNote(text: string): void {
  logAudit({
    action: 'note_added',
    entityType: 'opportunity',
    entityId: 'pv-miller-harris',
    entityName: 'Miller/Harris Baby Shower',
    afterSummary: text.slice(0, 80),
  });
}

export function auditDealTimeline(title: string): void {
  logAudit({
    action: 'updated',
    entityType: 'opportunity',
    entityId: 'pv-miller-harris',
    entityName: 'Miller/Harris Baby Shower',
    afterSummary: `Timeline · ${title}`,
  });
}

export function auditDealDraftQueued(agentName: string): void {
  logAgentAudit('follow-up-hunter', agentName, {
    action: 'message_queued',
    entityType: 'message',
    entityId: 'deal-draft-miller',
    entityName: 'Miller/Harris · client draft',
    afterSummary: 'Queued for approval — no send',
  });
}

export function auditInboxDraftQueued(threadId: string): void {
  logAudit({
    action: 'message_queued',
    entityType: 'message',
    entityId: threadId,
    entityName: 'Inbox reply',
    afterSummary: 'Reply queued for approval',
  });
}

export function auditInboxDraftGenerated(threadId: string): void {
  logAudit({
    action: 'message_drafted',
    entityType: 'message',
    entityId: threadId,
    entityName: 'Inbox reply',
    afterSummary: 'AI/template draft generated',
    source: 'agent',
  });
}

export function auditAutomationToggle(key: string, on: boolean): void {
  logAudit({
    action: 'automation_toggled',
    entityType: 'automation',
    entityId: key,
    entityName: key,
    beforeSummary: on ? 'off' : 'on',
    afterSummary: on ? 'on' : 'off',
  });
}

export function auditRecommendationPlanned(id: string): void {
  logAudit({
    action: 'recommendation_planned',
    entityType: 'automation',
    entityId: id,
    entityName: `Recommendation ${id}`,
    source: 'agent',
  });
}

export function auditRecommendationDone(id: string): void {
  logAudit({
    action: 'recommendation_done',
    entityType: 'automation',
    entityId: id,
    entityName: `Recommendation ${id}`,
    source: 'agent',
  });
}

export function auditSignalReviewed(id: string): void {
  logAudit({
    action: 'signal_reviewed',
    entityType: 'automation',
    entityId: id,
    entityName: `Signal ${id}`,
  });
}

export function auditDepositReminderQueued(): void {
  logAgentAudit('balance-guardian', 'Balance Guardian', {
    action: 'message_queued',
    entityType: 'message',
    entityId: 'balance-miller',
    entityName: 'Miller/Harris · balance reminder',
    afterSummary: 'Reminder prepared — approval-gated',
  });
}
