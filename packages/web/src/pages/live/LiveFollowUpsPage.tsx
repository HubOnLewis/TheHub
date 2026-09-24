import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isFollowUpKind } from '@hub-crm/shared';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell } from '../../components/live/LiveModuleTable.js';
import { useVenueOpsQueue, useVenueOpsTaskAction } from '../../hooks/useVenueOps.js';
import { opportunityDetailPath, ROUTES } from '../../config/paths.js';

export default function LiveFollowUpsPage() {
  const navigate = useNavigate();
  const queue = useVenueOpsQueue();
  const action = useVenueOpsTaskAction();
  const tasks = useMemo(
    () => (queue.data?.tasks ?? []).filter(t => isFollowUpKind(t.kind)),
    [queue.data?.tasks],
  );
  const urgent = tasks.filter(t => t.priority === 'high');

  if (queue.isLoading) return <LoadingState message="Loading follow-ups…" />;

  return (
    <div className="hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Follow-ups</h1>
          <p className="hub-admin-page__subtitle">
            Communication queue from live events — stale inquiries, expiring holds, proposals, and deposits.
          </p>
        </div>
        <div className="hub-live-header-actions">
          <span className="hub-admin-stat-pill">{tasks.length} in queue</span>
          <span className="hub-admin-stat-pill">{urgent.length} urgent</span>
          <Link to={ROUTES.tasks} className="btn btn-ghost btn-sm">
            All tasks →
          </Link>
        </div>
      </header>

      {queue.isError ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load follow-ups</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">No follow-ups waiting</p>
          <p className="text-muted text-sm">New inquiries, holds, and unsigned proposals land here automatically.</p>
        </div>
      ) : (
        <section className="hub-live-group card">
          <LiveModuleTable
            rows={tasks}
            rowKey={t => t.id}
            emptyTitle="No follow-ups"
            columns={[
              {
                key: 'task',
                header: 'Follow-up',
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
                render: t => (
                  <EventLink href={opportunityDetailPath(t.dealId)} title={t.eventTitle} subtitle={t.contact} />
                ),
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
                key: 'actions',
                header: '',
                className: 'crm-events-table__col--actions',
                render: t => (
                  <div className="venue-ops-row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ taskId: t.id, dealId: t.dealId, action: 'complete' })}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(opportunityDetailPath(t.dealId))}
                    >
                      Open
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      )}
    </div>
  );
}
