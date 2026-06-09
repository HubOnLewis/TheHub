/**
 * Hub CRM — platform audit event model (shared web + future API).
 */

export type AuditEntityType =
  | 'event'
  | 'opportunity'
  | 'contact'
  | 'client'
  | 'task'
  | 'proposal'
  | 'payment'
  | 'message'
  | 'automation'
  | 'agent_approval'
  | 'settings'
  | 'user'
  | 'review_note';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'archived'
  | 'status_changed'
  | 'note_added'
  | 'message_drafted'
  | 'message_queued'
  | 'message_sent_future'
  | 'task_completed'
  | 'task_reopened'
  | 'approval_approved'
  | 'approval_dismissed'
  | 'approval_queued'
  | 'approval_edited'
  | 'automation_toggled'
  | 'user_invited'
  | 'role_changed'
  | 'payment_link_created_future'
  | 'payment_received_future'
  | 'recommendation_planned'
  | 'recommendation_done'
  | 'signal_reviewed';

export type AuditSource = 'user' | 'automation' | 'agent' | 'system';

export type AuditVisibility = 'internal' | 'owner' | 'client_review';

export type AuditSeverity = 'info' | 'notice' | 'important' | 'critical';

export interface AuditActor {
  actorId: string;
  actorName: string;
  actorRole: string;
}

export interface AuditEntityRef {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
}

export interface AuditMetadata {
  beforeSummary?: string;
  afterSummary?: string;
  correlationId?: string;
  sessionId?: string;
  ipAddress?: string;
  deviceLabel?: string;
  agentId?: string;
  agentName?: string;
  channel?: string;
  extra?: Record<string, string>;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  beforeSummary?: string;
  afterSummary?: string;
  timestamp: string;
  source: AuditSource;
  visibility: AuditVisibility;
  severity: AuditSeverity;
  visibleToClientReview: boolean;
  correlationId?: string;
  sessionId?: string;
  ipAddress?: string;
  deviceLabel?: string;
}

export type AuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};
