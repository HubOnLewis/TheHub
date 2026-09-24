import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import { useLiveCrmEvents } from '../hooks/useLiveCrmEvents.js';
import { useVenueOpsQueue, useVenueOpsTaskAction } from '../hooks/useVenueOps.js';
import {
  daysUntilEvent,
  getBalanceDue,
  getEventDate,
  isCompleted,
  isLost,
} from '../lib/liveEventHelpers.js';
import type { CrmEventRow } from '../lib/crmEvents.js';
import LoadingState from '../components/crm/LoadingState.js';
import { formatTodayLabel } from '../config/productionData.js';
import { useMemo } from 'react';
import { useAppStore } from '../store/index.js';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function activeRows(rows: CrmEventRow[]): CrmEventRow[] {
  return rows.filter(r => !isLost(r) && !isCompleted(r));
}

function roomLine(row: CrmEventRow): string {
  const space = row.space && row.space !== '—' ? row.space : 'Room TBD';
  const time = row.eventTime || 'Time TBD';
  const guests = row.guests ? `${row.guests} guests` : '';
  return [time, space, guests].filter(Boolean).join(' · ');
}

export default function ProductionToday() {
  const { rows, isLoading, isError, sourceId } = useLiveCrmEvents();
  const ops = useVenueOpsQueue();
  const action = useVenueOpsTaskAction();
  const user = useAppStore(s => s.user);
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const myId = firstName.toLowerCase() === 'jason' ? 'jason' : firstName.toLowerCase() === 'hannah' ? 'hannah' : null;

  const today = startOfDay(new Date());
  const active = useMemo(() => activeRows(rows), [rows]);
  const tonight = useMemo(
    () =>
      active
        .filter(r => {
          const d = getEventDate(r);
          return d != null && startOfDay(d).getTime() === today.getTime();
        })
        .sort((a, b) => a.eventTime.localeCompare(b.eventTime)),
    [active, today],
  );
  const allQueue = ops.data?.tasks ?? [];
  const queue = myId ? allQueue.filter(t => t.assignee?.type === 'user' && t.assignee.id === myId) : allQueue;
  const balances = useMemo(
    () => active.filter(r => getBalanceDue(r) > 0).sort((a, b) => getBalanceDue(b) - getBalanceDue(a)),
    [active],
  );

  if (isLoading) return <LoadingState message="Loading today…" />;

  return (
    <main className="today-desk">
      <header className="today-desk__header">
        <div>
          <p className="today-desk__kicker">{formatTodayLabel()}</p>
          <h1 className="today-desk__title">${firstName}’s Today</h1>
          <p className="today-desk__sub">
            Your assigned work, today’s floor, and the money that needs your attention.
            {isError ? ' Showing saved venue data while the server refreshes.' : ''}
            {!isError && sourceId !== 'live-api' && sourceId !== 'none'
              ? ' Showing imported venue events.'
              : ''}
          </p>
        </div>
        <div className="today-desk__actions">
          <Link to={ROUTES.teamToday} className="btn btn-secondary btn-sm">
            Team Today
          </Link>
          <Link to={ROUTES.calendar} className="btn btn-secondary btn-sm">
            Calendar
          </Link>
          <Link to={`${ROUTES.opportunities}?new=1`} className="btn btn-primary btn-sm">
            + Add event
          </Link>
        </div>
      </header>

      <section className="today-desk__work" aria-label="Do this">
        <header className="today-desk__section-head">
          <h2>Do this</h2>
          <span>{queue.length || balances.length ? `${queue.length || balances.length}` : 'Clear'}</span>
        </header>
        {queue.length > 0 ? (
          <ul className="today-desk__list">
            {queue.slice(0, 12).map(t => (
              <li key={t.id} className="today-desk__row">
                <Link to={opportunityDetailPath(t.dealId)} className="today-desk__row-main">
                  <strong>{t.title}</strong>
                  <span>
                    {t.dueLabel} · {t.contact}
                  </span>
                </Link>
                <div className="today-desk__row-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ taskId: t.id, dealId: t.dealId, action: 'complete' })
                    }
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        taskId: t.id,
                        dealId: t.dealId,
                        action: 'snooze',
                        snoozeDays: 2,
                      })
                    }
                  >
                    Later
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : balances.length > 0 ? (
          <ul className="today-desk__list">
            {balances.slice(0, 8).map(r => (
              <li key={r.id} className="today-desk__row">
                <Link to={r.href} className="today-desk__row-main">
                  <strong>Collect balance — {r.title}</strong>
                  <span>
                    {r.contact} · {formatCurrency(getBalanceDue(r))} due
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="today-desk__empty">Nothing waiting. Check the calendar or add an event.</p>
        )}
      </section>

      <section className="today-desk__floor" aria-label="On the floor">
        <header className="today-desk__section-head">
          <h2>On the floor today</h2>
          <span>{tonight.length}</span>
        </header>
        {tonight.length === 0 ? (
          <p className="today-desk__empty">No events scheduled for today.</p>
        ) : (
          <ul className="today-desk__list">
            {tonight.map(r => {
              const days = daysUntilEvent(r);
              return (
                <li key={r.id} className="today-desk__row">
                  <Link to={r.href} className="today-desk__row-main">
                    <strong>{r.title}</strong>
                    <span>
                      {roomLine(r)}
                      {r.occupancy === 'hold' ? ' · Hold' : r.occupancy === 'booked' ? ' · Booked' : ''}
                      {days === 0 ? '' : ''}
                    </span>
                  </Link>
                  <span className="today-desk__chip">{r.statusLabel}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {balances.length > 0 && queue.length > 0 ? (
        <section className="today-desk__money" aria-label="Balances">
          <header className="today-desk__section-head">
            <h2>Money still out</h2>
            <span>{formatCurrency(balances.reduce((s, r) => s + getBalanceDue(r), 0))}</span>
          </header>
          <ul className="today-desk__list">
            {balances.slice(0, 6).map(r => (
              <li key={r.id} className="today-desk__row">
                <Link to={r.href} className="today-desk__row-main">
                  <strong>{r.title}</strong>
                  <span>{r.eventDateDisplay}</span>
                </Link>
                <span className="today-desk__amt">{formatCurrency(getBalanceDue(r))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
