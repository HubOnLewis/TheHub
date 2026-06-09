import type { AuditEntityType } from '@hub-crm/shared';
import type { AuditEvent } from '../../audit/auditStore.js';
import { formatRelativeTime } from '../../lib/relativeTime.js';

const ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  status_changed: 'Status changed',
  note_added: 'Note added',
  message_drafted: 'Drafted',
  message_queued: 'Queued',
  task_completed: 'Completed',
  approval_approved: 'Approved',
  approval_dismissed: 'Dismissed',
  approval_queued: 'Queued',
};

interface AuditEntityHistoryProps {
  events: AuditEvent[];
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
}

export default function AuditEntityHistory({ events, entityType, entityId, limit = 8 }: AuditEntityHistoryProps) {
  const rows = events
    .filter(e => e.entityType === entityType && e.entityId === entityId)
    .slice(0, limit);

  if (rows.length === 0) {
    return <p className="audit-entity-history__empty">No audit entries yet for this record.</p>;
  }

  return (
    <ol className="audit-entity-history">
      {rows.map(e => (
        <li key={e.id} className={`audit-entity-history__row audit-entity-history__row--${e.source}`}>
          <div className="audit-entity-history__meta">
            <span className="audit-entity-history__action">{ACTION_LABEL[e.action] ?? e.action}</span>
            <time>{formatRelativeTime(e.timestamp)}</time>
          </div>
          <strong>{e.actorName}</strong>
          {(e.beforeSummary || e.afterSummary) && (
            <p className="audit-entity-history__detail">
              {e.beforeSummary && <span>{e.beforeSummary} → </span>}
              {e.afterSummary}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
