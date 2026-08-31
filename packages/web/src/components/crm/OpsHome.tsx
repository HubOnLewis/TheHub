import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { ROUTES, opportunityDetailPath } from '../../config/paths.js';
import {
  daysUntilEvent,
  getBalanceDue,
  getEventDate,
  isLost,
  isCompleted,
} from '../../lib/liveEventHelpers.js';
import type { CrmEventRow } from '../../lib/crmEvents.js';
import LoadingState from './LoadingState.js';
import EmptyState from './EmptyState.js';
import AddEventModal from './AddEventModal.js';
import AttentionRail from '../venue/AttentionRail.js';
import { useVenueAttention } from '../../hooks/useAgentSnapshot.js';
import { formatTodayLabel } from '../../config/productionData.js';
import { useInboxTriage } from '../../hooks/useInboxTriage.js';
import {
  buildMorningCards,
  pickDoThisNow,
  selectNewInquiries,
  type MorningEventRow,
} from '../../lib/morningCards.js';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function inRange(row: CrmEventRow, from: Date, to: Date): boolean {
  const d = getEventDate(row);
  if (!d) return false;
  const t = startOfDay(d).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function opsRows(rows: CrmEventRow[]): CrmEventRow[] {
  return rows.filter(r => !isLost(r) && !isCompleted(r));
}

function proposalHint(row: CrmEventRow): string | null {
  const s = `${row.pvStatus ?? ''} ${row.status} ${row.statusLabel}`.toLowerCase();
  if (/accepted|confirmed|won/.test(s)) return 'accepted';
  if (/proposal|approved/.test(s)) return 'sent';
  return null;
}

function toMorningRow(row: CrmEventRow): MorningEventRow {
  return {
    id: row.id,
    title: row.title,
    href: row.href,
    statusLabel: row.statusLabel,
    stage: row.status,
    proposalStatus: proposalHint(row),
    space: row.space,
    eventDateIso: row.eventDate,
    guests: row.guests,
  };
}

function EventOpsRow({ row }: { row: CrmEventRow }) {
  const days = daysUntilEvent(row);
  const when =
    days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days != null && days > 1 ? `In ${days}d` : row.eventDateDisplay;
  return (
    <Link to={row.href} className="ops-home-row">
      <span className="ops-home-row__when">{when}</span>
      <div className="ops-home-row__main">
        <strong>{row.title}</strong>
        <span>
          {row.eventTime || 'Time TBD'} · {row.space || 'Space required'} · {row.guests || 0} guests
        </span>
      </div>
      <span className="ops-home-row__status">{row.statusLabel}</span>
      <span className="ops-home-row__money">
        {formatCurrency(row.value)}
        {(row.balanceDue ?? 0) > 0 ? ` · ${formatCurrency(row.balanceDue ?? 0)} due` : ''}
      </span>
    </Link>
  );
}

export default function OpsHome() {
  const { rows, isLoading, isError, sourceId } = useLiveCrmEvents();
  const { data: triage } = useInboxTriage();
  const [addOpen, setAddOpen] = useState(false);
  const [showFar, setShowFar] = useState(false);

  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 6);
  const horizon = addDays(today, 13);

  const active = useMemo(() => opsRows(rows), [rows]);
  const todayRows = useMemo(
    () => active.filter(r => inRange(r, today, today)).sort((a, b) => a.eventTime.localeCompare(b.eventTime)),
    [active, today],
  );
  const weekRows = useMemo(
    () =>
      active
        .filter(r => inRange(r, today, weekEnd))
        .sort((a, b) => (getEventDate(a)!.getTime() - getEventDate(b)!.getTime()) || a.eventTime.localeCompare(b.eventTime)),
    [active, today, weekEnd],
  );
  const comingUp = useMemo(
    () =>
      active
        .filter(r => inRange(r, addDays(today, 1), horizon))
        .sort((a, b) => getEventDate(a)!.getTime() - getEventDate(b)!.getTime()),
    [active, today, horizon],
  );
  const balances = useMemo(
    () => active.filter(r => getBalanceDue(r) > 0).sort((a, b) => getBalanceDue(b) - getBalanceDue(a)),
    [active],
  );
  const missingSpace = useMemo(
    () => weekRows.filter(r => !r.space || r.space === 'TBD' || r.space === '—'),
    [weekRows],
  );
  const farPipeline = useMemo(() => {
    const cut = addDays(today, 90).getTime();
    return active.filter(r => {
      const d = getEventDate(r);
      return d != null && d.getTime() > cut;
    });
  }, [active, today]);


  const morningRows = useMemo(() => active.map(toMorningRow), [active]);
  const inquiries = useMemo(() => selectNewInquiries(morningRows), [morningRows]);
  const morningCards = useMemo(
    () =>
      buildMorningCards({
        inquiries,
        unsignedProposals: (triage?.unsignedProposals ?? []).map(u => ({
          eventId: u.eventId,
          eventTitle: u.eventTitle,
          href: opportunityDetailPath(u.eventId),
        })),
        unpaidDeposits: (triage?.unpaidDeposits ?? []).map(u => ({
          eventId: u.eventId,
          eventTitle: u.eventTitle,
          href: opportunityDetailPath(u.eventId),
        })),
        unansweredMessages: (triage?.unansweredMessages ?? []).map(u => ({
          eventId: u.eventId,
          eventTitle: u.eventTitle,
          preview: u.preview,
          href: opportunityDetailPath(u.eventId),
        })),
        missingSpace: missingSpace.map(toMorningRow),
      }),
    [inquiries, triage, missingSpace],
  );
  const doNow = useMemo(() => pickDoThisNow(morningCards), [morningCards]);

  const { items: attention, source: attentionSource } = useVenueAttention(active);

  const balanceTotal = balances.reduce((s, r) => s + getBalanceDue(r), 0);

  if (isLoading) return <LoadingState message="Loading today…" />;

  return (
    <div className="ops-home">
      <header className="ops-home__header">
        <div>
          <p className="ops-home__kicker">{formatTodayLabel()}</p>
          <h1 className="ops-home__title">Today at The Hub</h1>
          <p className="ops-home__sub">
            What is on the floor this week — not the 2027 pipeline.
            {sourceId === 'live-api' ? ' Live CRM.' : ' Imported venue data.'}
          </p>
        </div>
        <div className="ops-home__header-actions">
          <Link to={ROUTES.calendar} className="btn btn-secondary btn-sm">
            Calendar
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            + Add event
          </button>
        </div>
      </header>

      {isError ? (
        <p className="text-muted text-sm">Could not refresh the live API — showing imported events when available.</p>
      ) : null}

      <div className="ops-home__metrics" role="status">
        <div className="ops-home__metric">
          <span>Today</span>
          <strong>{todayRows.length}</strong>
        </div>
        <div className="ops-home__metric">
          <span>This week</span>
          <strong>{weekRows.length}</strong>
        </div>
        <div className={`ops-home__metric${balanceTotal > 0 ? ' ops-home__metric--warn' : ''}`}>
          <span>Balances due</span>
          <strong>{formatCurrency(balanceTotal)}</strong>
        </div>
        <div className={`ops-home__metric${attention.length > 0 ? ' ops-home__metric--urgent' : ''}`}>
          <span>Needs follow-up</span>
          <strong>{attention.length}</strong>
        </div>
      </div>

      <section className="ops-home__morning" aria-label="This morning">
        <header className="ops-home__morning-head">
          <h2>This morning</h2>
          <Link to={ROUTES.inbox} className="ops-home__link">
            Inbox / Activity →
          </Link>
        </header>
        {doNow ? (
          <div className="ops-home__do-now">
            <div>
              <span className="ops-home__do-now-kicker">Do this now</span>
              <strong>{doNow.action}</strong>
              <p>
                {doNow.title} · {doNow.count} · {doNow.preview}
              </p>
            </div>
            <Link to={doNow.href} className="btn btn-primary">
              {doNow.action}
            </Link>
          </div>
        ) : null}
        <div className="inbox-triage-grid">
          {morningCards.map(card => (
            <Link
              key={card.key}
              to={card.href}
              className={`inbox-triage-card${card.urgent ? (card.key === 'unanswered' || card.key === 'missing-space' ? ' inbox-triage-card--urgent' : ' inbox-triage-card--warn') : card.count > 0 ? ' inbox-triage-card--warn' : ''}`}
            >
              <span>{card.title}</span>
              <strong>{card.count}</strong>
              <em>{card.preview}</em>
              <span className="inbox-triage-card__action">{card.action}</span>
            </Link>
          ))}
        </div>
      </section>

      {attention[0] ? (
        <div className="crm-start-here">
          <div>
            <span className="crm-start-here__kicker">Start here</span>
            <strong>{attention[0].title}</strong>
            <p>{attention[0].detail}</p>
          </div>
          <Link to={attention[0].href} className="btn btn-primary">
            {attention[0].actionLabel}
          </Link>
        </div>
      ) : null}

      <AttentionRail items={attention} title="Do this next" max={4} />
      <p className="text-muted text-sm" style={{ margin: '-8px 0 16px' }}>
        {attentionSource === 'api-agents'
          ? 'Live agent snapshot from CRM events and leads.'
          : 'Live rules on current CRM rows.'}
      </p>

      <div className="ops-home__grid">
        <section className="ops-home__panel">
          <header>
            <h2>Today</h2>
            <span>{todayRows.length}</span>
          </header>
          {todayRows.length === 0 ? (
            <p className="ops-home__empty">No events on the floor today. Protect this inventory — or add a booking.</p>
          ) : (
            <div className="ops-home__list">
              {todayRows.map(row => (
                <EventOpsRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </section>

        <section className="ops-home__panel">
          <header>
            <h2>This week</h2>
            <span>{weekRows.length}</span>
          </header>
          {weekRows.length === 0 ? (
            <p className="ops-home__empty">Nothing else dated this week.</p>
          ) : (
            <div className="ops-home__list">
              {weekRows.map(row => (
                <EventOpsRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="ops-home__panel">
        <header>
          <h2>Coming up (next 14 days)</h2>
          <Link to={ROUTES.calendar} className="ops-home__link">
            Open calendar →
          </Link>
        </header>
        {comingUp.length === 0 ? (
          <EmptyState
            title="No dated events in the next two weeks"
            hint="Add an event with a date and space, or import Perfect Venue reports."
            actionLabel="Add Event"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="ops-home__list">
            {comingUp.map(row => (
              <EventOpsRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      {balances.length > 0 ? (
        <section className="ops-home__panel">
          <header>
            <h2>Balances to collect</h2>
            <span>{formatCurrency(balanceTotal)}</span>
          </header>
          <div className="ops-home__list">
            {balances.slice(0, 6).map(row => (
              <EventOpsRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      ) : null}

      {farPipeline.length > 0 ? (
        <details className="ops-home__far" open={showFar} onToggle={e => setShowFar((e.target as HTMLDetailsElement).open)}>
          <summary>
            {farPipeline.length} far-pipeline event{farPipeline.length === 1 ? '' : 's'} (90+ days out, including 2027)
          </summary>
          <p className="text-muted text-sm">
            Dated 90+ days out stay here so today stays clear. New inquiries still surface in This morning so you can send a proposal.
          </p>
          <div className="ops-home__list">
            {farPipeline.slice(0, 20).map(row => (
              <EventOpsRow key={row.id} row={row} />
            ))}
          </div>
        </details>
      ) : null}

      <AddEventModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}