import type { AuditEventInput, AuditSource } from '@hub-crm/shared';
import { useAppStore } from '../store/index.js';
import { appendAuditEvent } from './auditStore.js';

const SESSION_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `sess-${Date.now()}`;

export interface LogAuditOptions {
  action: AuditEventInput['action'];
  entityType: AuditEventInput['entityType'];
  entityId: string;
  entityName: string;
  beforeSummary?: string;
  afterSummary?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  source?: AuditSource;
  visibility?: AuditEventInput['visibility'];
  severity?: AuditEventInput['severity'];
  visibleToClientReview?: boolean;
  correlationId?: string;
  sessionId?: string;
  ipAddress?: string;
  deviceLabel?: string;
}

/** Record an audit event from UI interactions (demo + future API parity). */
export function logAudit(opts: LogAuditOptions): void {
  const user = useAppStore.getState().user;
  const actorId = opts.actorId ?? user?.id ?? 'system';
  const actorName = opts.actorName ?? user?.name ?? 'System';
  const actorRole = opts.actorRole ?? user?.role?.replace(/_/g, ' ') ?? 'system';

  appendAuditEvent({
    actorId,
    actorName,
    actorRole,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    entityName: opts.entityName,
    beforeSummary: opts.beforeSummary,
    afterSummary: opts.afterSummary,
    source: opts.source ?? 'user',
    visibility: opts.visibility ?? 'internal',
    severity: opts.severity ?? 'info',
    visibleToClientReview: opts.visibleToClientReview ?? false,
    correlationId: opts.correlationId,
    sessionId: opts.sessionId ?? SESSION_ID,
    ipAddress: opts.ipAddress,
    deviceLabel: opts.deviceLabel ?? 'Web · Client review',
  });
}

/** Log agent/automation actions with agent as actor */
export function logAgentAudit(
  agentId: string,
  agentName: string,
  opts: Omit<LogAuditOptions, 'actorId' | 'actorName' | 'actorRole' | 'source'>,
): void {
  logAudit({
    ...opts,
    actorId: agentId,
    actorName: agentName,
    actorRole: 'Agent',
    source: 'agent',
  });
}
