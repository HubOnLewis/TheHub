import { useMemo } from 'react';
import type { AuditEvent } from '../../audit/auditStore.js';
import { formatRelativeTime } from '../../lib/relativeTime.js';

const SOURCE_CLASS: Record<string, string> = {
  user: 'audit-chip audit-chip--user',
  agent: 'audit-chip audit-chip--agent',
  automation: 'audit-chip audit-chip--auto',
  system: 'audit-chip audit-chip--system',
};

const SEVERITY_CLASS: Record<string, string> = {
  info: '',
  notice: 'audit-timeline__row--notice',
  important: 'audit-timeline__row--important',
  critical: 'audit-timeline__row--critical',
};

function sourceHumanLabel(source: AuditEvent['source']): string {
  if (source === 'user') return 'Human';
  if (source === 'agent') return 'Agent';
  if (source === 'automation') return 'Automation';
  return 'System';
}

function lifecycleTag(action: AuditEvent['action']): string | null {
  if (action.includes('approval')) return 'Approval trail';
  if (action.includes('message')) return 'Client communication';
  if (action === 'status_changed') return 'Lifecycle';
  if (action === 'task_completed') return 'Operations';
  return null;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface AuditTimelineProps {
  events: AuditEvent[];
}

export default function AuditTimeline({ events }: AuditTimelineProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, AuditEvent[]>();
    for (const e of events) {
      const day = formatDay(e.timestamp);
      const list = map.get(day) ?? [];
      list.push(e);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [events]);

  if (events.length === 0) {
    return (
      <p className="audit-timeline__empty">
        No audit events match your filters. Interact with tasks, approvals, or opportunities to build the trail.
      </p>
    );
  }

  return (
    <div className="audit-timeline">
      {grouped.map(([day, rows]) => (
        <section key={day} className="audit-timeline__day">
          <h3 className="audit-timeline__day-label">{day}</h3>
          <ol className="audit-timeline__list">
            {rows.map(e => (
              <li
                key={e.id}
                className={`audit-timeline__row ${SEVERITY_CLASS[e.severity] ?? ''}`}
              >
                <div className="audit-timeline__rail">
                  <span className="audit-timeline__node" />
                </div>
                <div className="audit-timeline__body">
                  <div className="audit-timeline__head">
                    <span className={e.source === 'user' ? 'audit-source-human' : 'audit-source-agent'}>
                      {sourceHumanLabel(e.source)}
                    </span>
                    <span className={SOURCE_CLASS[e.source] ?? 'audit-chip'}>{e.source}</span>
                    <span className="audit-chip audit-chip--entity">{e.entityType.replace('_', ' ')}</span>
                    <time dateTime={e.timestamp}>{formatRelativeTime(e.timestamp)}</time>
                  </div>
                  {lifecycleTag(e.action) && (
                    <span className="audit-lifecycle-tag">{lifecycleTag(e.action)}</span>
                  )}
                  <p className="audit-timeline__title">
                    <strong>{e.actorName}</strong>
                    <span className="audit-timeline__action">{e.action.replace(/_/g, ' ')}</span>
                    <span className="audit-timeline__entity">{e.entityName}</span>
                  </p>
                  {(e.beforeSummary || e.afterSummary) && (
                    <div className="audit-replay-row">
                      <span className="audit-replay-before">{e.beforeSummary ?? '—'}</span>
                      <span aria-hidden>→</span>
                      <span className="audit-replay-after">{e.afterSummary ?? '—'}</span>
                    </div>
                  )}
                  {e.source === 'agent' && (
                    <span className="audit-timeline__automation-flag">Automation intervened · approval-gated</span>
                  )}
                  {e.action === 'approval_approved' && (
                    <span className="audit-timeline__client-flag">Approvals granted by {e.actorName}</span>
                  )}
                  {e.visibleToClientReview && (
                    <span className="audit-timeline__client-flag">Viewed in client review · defensible record</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
