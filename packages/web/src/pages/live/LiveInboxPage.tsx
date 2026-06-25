import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell, StatusCell } from '../../components/live/LiveModuleTable.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { generateInboxActivity, type InboxActivityItem } from '../../lib/liveEventHelpers.js';

export default function LiveInboxPage() {
  const navigate = useNavigate();
  const { rows, isLoading, isError } = useLiveCrmEvents();

  const items = useMemo(() => generateInboxActivity(rows), [rows]);

  if (isLoading) return <LoadingState message="Loading activity…" />;

  return (
    <div className="hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Activity Inbox</h1>
          <p className="hub-admin-page__subtitle">
            Event activity and follow-ups from your live pipeline — not email messages.
          </p>
        </div>
        <span className="hub-admin-stat-pill">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </header>

      {isError ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load activity</p>
          <p className="text-muted text-sm">Try refreshing the page.</p>
        </div>
      ) : (
        <LiveModuleTable
          rows={items}
          rowKey={r => r.id}
          emptyTitle="No activity items right now"
          emptyHint="New proposals, balance-due events, and upcoming bookings will appear here."
          columns={[
            {
              key: 'reason',
              header: 'Activity',
              render: (r: InboxActivityItem) => (
                <div>
                  <strong>{r.reason}</strong>
                  <div className="text-muted text-sm">{r.dateDisplay}</div>
                </div>
              ),
            },
            {
              key: 'event',
              header: 'Event',
              render: (r: InboxActivityItem) => <EventLink href={r.href} title={r.eventTitle} subtitle={r.contact} />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r: InboxActivityItem) => <StatusCell label={r.statusLabel} />,
            },
            {
              key: 'value',
              header: 'Value',
              className: 'crm-events-table__col--num',
              render: (r: InboxActivityItem) => <MoneyCell amount={r.value} />,
            },
            {
              key: 'balance',
              header: 'Balance Due',
              className: 'crm-events-table__col--num',
              render: (r: InboxActivityItem) => (r.balanceDue > 0 ? <MoneyCell amount={r.balanceDue} /> : '—'),
            },
            {
              key: 'open',
              header: '',
              className: 'crm-events-table__col--actions',
              render: (r: InboxActivityItem) => (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(r.href)}>
                  Open
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
