import { useMemo, useState } from 'react';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell, StatusCell } from '../../components/live/LiveModuleTable.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import {
  filterCalendarRows,
  groupRowsByMonth,
  type CalendarFilter,
} from '../../lib/liveEventHelpers.js';
import type { CrmEventRow } from '../../lib/crmEvents.js';

const FILTERS: Array<{ id: CalendarFilter; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'this_month', label: 'This month' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'balance_due', label: 'Balance due' },
];

function CalendarGroups({ groups }: { groups: Array<{ label: string; rows: CrmEventRow[] }> }) {
  return (
    <div className="hub-live-groups">
      {groups.map(group => (
        <section key={group.label} className="hub-live-group card">
          <h2 className="hub-live-group__title">{group.label}</h2>
          <LiveModuleTable
            rows={group.rows}
            rowKey={r => r.id}
            emptyTitle="No events"
            columns={[
              {
                key: 'event',
                header: 'Event',
                render: r => <EventLink href={r.href} title={r.title} subtitle={r.contact} />,
              },
              {
                key: 'status',
                header: 'Status',
                render: r => <StatusCell label={r.statusLabel} status={r.status} />,
              },
              {
                key: 'date',
                header: 'Date',
                render: r => (
                  <div>
                    <div>{r.eventDateDisplay}</div>
                    {r.eventTime ? <div className="text-muted text-sm">{r.eventTime}</div> : null}
                  </div>
                ),
              },
              {
                key: 'value',
                header: 'Value',
                className: 'crm-events-table__col--num',
                render: r => <MoneyCell amount={r.value} />,
              },
              {
                key: 'balance',
                header: 'Balance',
                className: 'crm-events-table__col--num',
                render: r =>
                  (r.balanceDue ?? 0) > 0 ? <MoneyCell amount={r.balanceDue ?? 0} /> : '—',
              },
              {
                key: 'owner',
                header: 'Owner',
                render: r => r.owner || '—',
              },
            ]}
          />
        </section>
      ))}
    </div>
  );
}

export default function LiveCalendarPage() {
  const [filter, setFilter] = useState<CalendarFilter>('upcoming');
  const { rows, isLoading, isError } = useLiveCrmEvents();

  const filtered = useMemo(() => filterCalendarRows(rows, filter), [rows, filter]);
  const groups = useMemo(() => groupRowsByMonth(filtered), [filtered]);

  if (isLoading) return <LoadingState message="Loading calendar…" />;

  return (
    <div className="hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Event Calendar</h1>
          <p className="hub-admin-page__subtitle">
            Upcoming booked events with dates from your live pipeline.
          </p>
        </div>
        <span className="hub-admin-stat-pill">{filtered.length} dated event{filtered.length === 1 ? '' : 's'}</span>
      </header>

      <div className="hub-live-filters" role="tablist" aria-label="Calendar filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load events</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">No dated events for this filter</p>
          <p className="text-muted text-sm">Events without dates are shown on Home only.</p>
        </div>
      ) : (
        <CalendarGroups groups={groups} />
      )}
    </div>
  );
}
