import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell } from '../../components/live/LiveModuleTable.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { generateLiveTasks, type LiveTask, type LiveTaskPriority } from '../../lib/liveEventHelpers.js';

const PRIORITY_LABEL: Record<LiveTaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function groupByPriority(tasks: LiveTask[]): Array<{ priority: LiveTaskPriority; tasks: LiveTask[] }> {
  const order: LiveTaskPriority[] = ['high', 'medium', 'low'];
  return order
    .map(priority => ({
      priority,
      tasks: tasks.filter(t => t.priority === priority),
    }))
    .filter(g => g.tasks.length > 0);
}

export default function LiveTasksPage() {
  const navigate = useNavigate();
  const { rows, isLoading, isError } = useLiveCrmEvents();
  const tasks = useMemo(() => generateLiveTasks(rows), [rows]);
  const groups = useMemo(() => groupByPriority(tasks), [tasks]);

  if (isLoading) return <LoadingState message="Loading tasks…" />;

  return (
    <div className="hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Tasks</h1>
          <p className="hub-admin-page__subtitle">
            Operational follow-ups generated from live event status, balances, and dates.
          </p>
        </div>
        <span className="hub-admin-stat-pill">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
      </header>

      {isError ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load tasks</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">No open tasks right now</p>
          <p className="text-muted text-sm">Follow-ups appear when events need balance, proposal, or prep attention.</p>
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
                        <div className="text-muted text-sm">{t.reason}</div>
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
                    key: 'open',
                    header: '',
                    className: 'crm-events-table__col--actions',
                    render: t => (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(t.href)}
                      >
                        Open
                      </button>
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
