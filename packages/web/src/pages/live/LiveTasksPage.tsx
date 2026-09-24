import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { VenueOpsKind, VenueOpsPriority, VenueOpsTask } from '@hub-crm/shared';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell } from '../../components/live/LiveModuleTable.js';
import AttentionRail from '../../components/venue/AttentionRail.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { generateLiveTasks, type LiveTask } from '../../lib/liveEventHelpers.js';
import { useVenueAttention } from '../../hooks/useAgentSnapshot.js';
import { useVenueOpsQueue, useVenueOpsTaskAction } from '../../hooks/useVenueOps.js';
import { opportunityDetailPath, ROUTES } from '../../config/paths.js';

const PRIORITY_LABEL: Record<VenueOpsPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function kindLabel(kind: VenueOpsKind): string {
  switch (kind) {
    case 'stale_inquiry':
      return 'Inquiry';
    case 'hold_expiring':
    case 'hold_expired':
      return 'Hold';
    case 'walkthrough':
      return 'Walkthrough';
    case 'proposal_followup':
      return 'Proposal';
    case 'deposit_due':
      return 'Deposit';
    case 'balance_due':
      return 'Balance';
    case 'missing_details':
      return 'Details';
    case 'beo_missing':
      return 'BEO';
    case 'playbook_overdue':
      return 'Playbook';
    case 'prep':
      return 'Prep';
    default:
      return kind;
  }
}

function toLiveTask(task: VenueOpsTask): LiveTask {
  return {
    id: task.id,
    eventId: task.dealId,
    eventTitle: task.eventTitle,
    contact: task.contact,
    title: task.title,
    priority: task.priority,
    reason: task.reason,
    dueLabel: task.dueLabel,
    value: task.value,
    balanceDue: task.balanceDue,
    href: opportunityDetailPath(task.dealId),
  };
}

function groupByPriority(tasks: Array<LiveTask & { kind?: VenueOpsKind; dealId?: string }>) {
  const order: VenueOpsPriority[] = ['high', 'medium', 'low'];
  return order
    .map(priority => ({
      priority,
      tasks: tasks.filter(t => t.priority === priority),
    }))
    .filter(g => g.tasks.length > 0);
}

export default function LiveTasksPage() {
  const navigate = useNavigate();
  const { rows, isLoading: rowsLoading } = useLiveCrmEvents();
  const queue = useVenueOpsQueue();
  const action = useVenueOpsTaskAction();
  const derived = useMemo(() => generateLiveTasks(rows), [rows]);
  const apiTasks = queue.data?.tasks ?? [];
  const tasks = useMemo(() => {
    if (apiTasks.length || queue.isSuccess) {
      return apiTasks.map(t => ({ ...toLiveTask(t), kind: t.kind, dealId: t.dealId }));
    }
    return derived.map(t => ({ ...t, dealId: t.eventId }));
  }, [apiTasks, derived, queue.isSuccess]);
  const groups = useMemo(() => groupByPriority(tasks), [tasks]);
  const { items: attention } = useVenueAttention(rows);
  const summary = queue.data?.summary;

  if (rowsLoading && queue.isLoading) return <LoadingState message="Loading tasks…" />;

  return (
    <div className="hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Tasks</h1>
          <p className="hub-admin-page__subtitle">
            Persistable operations queue — holds, deposits, proposals, playbook, and event prep. Complete or snooze so work does not bounce back.
          </p>
        </div>
        <div className="hub-live-header-actions">
          <span className="hub-admin-stat-pill">{tasks.length} open</span>
          {summary && summary.high > 0 ? <span className="hub-admin-stat-pill">{summary.high} high</span> : null}
          <Link to={ROUTES.followUps} className="btn btn-ghost btn-sm">
            Follow-ups →
          </Link>
        </div>
      </header>

      <AttentionRail items={attention} title="Agent queue" max={4} />

      {queue.isError && !tasks.length ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load the operations queue</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">No open tasks right now</p>
          <p className="text-muted text-sm">Holds, deposits, proposals, and prep work appear here as events need attention.</p>
        </div>
      ) : (
        <div className="hub-live-groups">
          {groups.map(group => (
            <section key={group.priority} className="hub-live-group card">
              <h2 className="hub-live-group__title">{PRIORITY_LABEL[group.priority]} priority</h2>
              <LiveModuleTable
                rows={group.tasks}
                rowKey={t => t.id}
                emptyTitle="No tasks"
                columns={[
                  {
                    key: 'task',
                    header: 'Task',
                    render: t => (
                      <div>
                        <strong>{t.title}</strong>
                        <div className="text-muted text-sm">
                          {t.kind ? `${kindLabel(t.kind)} · ` : ''}
                          {t.reason}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'event',
                    header: 'Event',
                    render: t => <EventLink href={t.href} title={t.eventTitle} subtitle={t.contact} />,
                  },
                  {
                    key: 'due',
                    header: 'Due',
                    render: t => t.dueLabel,
                  },
                  {
                    key: 'value',
                    header: 'Value',
                    className: 'crm-events-table__col--num',
                    render: t => <MoneyCell amount={t.value} />,
                  },
                  {
                    key: 'balance',
                    header: 'Balance',
                    className: 'crm-events-table__col--num',
                    render: t =>
                      t.balanceDue > 0 ? <MoneyCell amount={t.balanceDue} /> : '—',
                  },
                  {
                    key: 'actions',
                    header: '',
                    className: 'crm-events-table__col--actions',
                    render: t => (
                      <div className="venue-ops-row-actions">
                        {t.kind && t.dealId ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={action.isPending}
                              onClick={() => action.mutate({ taskId: t.id, dealId: t.dealId!, action: 'complete' })}
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate({ taskId: t.id, dealId: t.dealId!, action: 'snooze', snoozeDays: 2 })
                              }
                            >
                              Later
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(t.href)}
                        >
                          Open
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
