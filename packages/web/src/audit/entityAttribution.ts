import type { AuditAction, AuditEntityType } from '@hub-crm/shared';
import { formatRelativeTime } from '../lib/relativeTime.js';
import type { AuditEvent } from './auditStore.js';

const EDIT_ACTIONS: AuditAction[] = [
  'updated',
  'status_changed',
  'note_added',
  'message_drafted',
  'message_queued',
  'task_completed',
  'task_reopened',
  'approval_approved',
  'approval_dismissed',
  'approval_queued',
  'approval_edited',
  'automation_toggled',
  'role_changed',
  'recommendation_planned',
  'recommendation_done',
  'signal_reviewed',
];

export interface EntityAttribution {
  createdBy: string;
  createdAt: string;
  createdAtRel: string;
  lastEditedBy: string;
  lastEditedAt: string;
  lastEditedAtRel: string;
  lastSource: string;
  recentEvents: AuditEvent[];
}

function entityKey(type: AuditEntityType, id: string): string {
  return `${type}:${id}`;
}

export function getEntityAttribution(
  events: AuditEvent[],
  entityType: AuditEntityType,
  entityId: string,
  fallbackCreated?: { by: string; at: string },
): EntityAttribution | null {
  const key = entityKey(entityType, entityId);
  const related = events
    .filter(e => entityKey(e.entityType, e.entityId) === key)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (related.length === 0 && !fallbackCreated) return null;

  const createdEvent = related.find(e => e.action === 'created');
  const created = createdEvent ?? null;

  const lastEdit = related.find(e => EDIT_ACTIONS.includes(e.action)) ?? related[0];

  const createdAt = created?.timestamp ?? fallbackCreated?.at ?? new Date().toISOString();
  const lastAt = lastEdit?.timestamp ?? createdAt;

  return {
    createdBy: created?.actorName ?? fallbackCreated?.by ?? '—',
    createdAt,
    createdAtRel: formatRelativeTime(createdAt),
    lastEditedBy: lastEdit?.actorName ?? created?.actorName ?? '—',
    lastEditedAt: lastAt,
    lastEditedAtRel: formatRelativeTime(lastAt),
    lastSource: lastEdit?.source ?? 'system',
    recentEvents: related.slice(0, 6),
  };
}
