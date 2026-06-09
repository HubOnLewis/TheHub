import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, HUB_LABELS } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';
import { getDemoCalendarMonth } from '../data/demoVenue.js';
import { getCalendarMonthDigest } from '../data/pvUiIntelligence.js';
import OccupancyHeatMap, { type HeatDay } from '../components/calendar/OccupancyHeatMap.js';
import OperationalLoadStrip, { type LoadStripDay } from '../components/calendar/OperationalLoadStrip.js';
import EmbeddedAgentPanel from '../components/agents/EmbeddedAgentPanel.js';
import { CALENDAR_INSIGHTS } from '../data/embeddedAgentInsights.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import ContextAgentDock from '../components/agents/ContextAgentDock.js';

const calChipClass: Record<string, string> = {
  confirmed: 'cal-chip cal-chip--confirmed',
  hold: 'cal-chip cal-chip--hold',
  proposal: 'cal-chip cal-chip--proposal',
  site_visit: 'cal-chip cal-chip--site_visit',
  payment: 'cal-chip cal-chip--payment',
  closeout: 'cal-chip cal-chip--closeout',
};

function intensityFromItems(items: { type: string }[]): 0 | 1 | 2 | 3 | 4 {
  if (!items.length) return 0;
  const n = items.length;
  const hasConfirmed = items.some(i => i.type === 'confirmed');
  if (n >= 3 || (hasConfirmed && n >= 2)) return 4;
  if (n >= 2) return 3;
  if (hasConfirmed) return 2;
  return 1;
}

export default function CalendarOccupancy() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const monthDigest = useMemo(
    () => getCalendarMonthDigest(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const loadStrip: LoadStripDay[] = useMemo(
    () =>
      monthDigest.weekLoadStrip.map(d => ({
        id: d.id,
        label: d.label,
        sub: d.sub,
        stress: d.stress,
      })),
    [monthDigest],
  );

  const { labelMonth, days, heatDays } = useMemo(() => {
    const y = cursor.y;
    const m = cursor.m;
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const demoDays = getDemoCalendarMonth(y, m);
    const labelMonth = first.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const cells: Array<{ day: number; inMonth: boolean; items: typeof demoDays[0]['items'] }> = [];
    const heat: HeatDay[] = [];

    const prevMonthDays = new Date(y, m, 0).getDate();
    for (let i = 0; i < startDow; i++) {
      const day = prevMonthDays - startDow + i + 1;
      cells.push({ day, inMonth: false, items: [] });
      heat.push({ day, inMonth: false, intensity: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const items = demoDays[d - 1]?.items ?? [];
      cells.push({ day: d, inMonth: true, items });
      const inten = intensityFromItems(items);
      heat.push({
        day: d,
        inMonth: true,
        intensity: inten,
        label: items.map(i => i.label).join(', ') || undefined,
      });
    }
    let next = 1;
    while (cells.length % 7 !== 0 || cells.length < 42) {
      cells.push({ day: next, inMonth: false, items: [] });
      heat.push({ day: next++, inMonth: false, intensity: 0 });
    }

    return { labelMonth, days: cells, heatDays: heat };
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor(c => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <div className="command-page">
      <DemoFlowNav />
      <div className="page-header">
        <div>
          <span className="ai-chip" style={{ marginBottom: 8, display: 'inline-block' }}>
            Venue utilization intelligence
          </span>
          <h1 className="page-title">Booking calendar</h1>
          <div className="page-subtitle">
            Occupancy heat, load-in windows, turnover gaps, and staffing pressure — executive planning surface.
          </div>
        </div>
        <Link to={ROUTES.today} className="btn btn-secondary btn-sm">
          Today mission control →
        </Link>
      </div>

      <ContextAgentDock context="calendar" compact />

      <div className="cal-summary-strip">
        <div className="cal-summary-pill">
          <span className="cal-summary-pill__label">Month occupancy</span>
          <strong>{monthDigest.occupancyPct}%</strong>
          <span className="cal-summary-pill__hint">
            {monthDigest.bookedDays}/{monthDigest.daysInMonth} days with events
          </span>
        </div>
        <div className="cal-summary-pill">
          <span className="cal-summary-pill__label">Events on calendar</span>
          <strong>{monthDigest.totalEvents}</strong>
          <span className="cal-summary-pill__hint">
            {monthDigest.confirmedCount} confirmed · {monthDigest.proposalCount} proposals
          </span>
        </div>
        <div className="cal-summary-pill cal-summary-pill--warn">
          <span className="cal-summary-pill__label">High stress</span>
          <strong>
            {monthDigest.highStressDays[0]
              ? `Day ${monthDigest.highStressDays[0].day}`
              : '—'}
          </strong>
          <span className="cal-summary-pill__hint">
            {monthDigest.highStressDays[0]?.note ?? 'No multi-booking days'}
          </span>
        </div>
        <div className="cal-summary-pill cal-summary-pill--link">
          <Link to={ROUTES.ownerBriefing}>Owner briefing</Link>
        </div>
      </div>

      <OperationalLoadStrip days={loadStrip} />

      <div className="cal-intel-layout cal-layout--heatmap-primary">
        <div>
          <OccupancyHeatMap days={heatDays} monthLabel={labelMonth} />

          <div className="cal-day-focus">
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-cond)', fontSize: 15 }}>Selected month · operational overlay</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              Heatmap is primary — use month arrows for May/June PV export density. Turnover and staffing warnings in the rail.
            </p>
          </div>

          <div className="cal-shell" aria-hidden="true">
            <div className="cal-header">
              <button type="button" className="btn btn-ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                ←
              </button>
              <div style={{ fontFamily: 'var(--font-cond)', fontSize: 22, fontWeight: 800 }}>{labelMonth}</div>
              <button type="button" className="btn btn-ghost" onClick={() => shiftMonth(1)} aria-label="Next month">
                →
              </button>
            </div>
            <div className="cal-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="cal-dow">
                  {d}
                </div>
              ))}
              {days.map((cell, idx) => {
                const key = `${cell.day}-${idx}-${cell.inMonth}`;
                const stress = cell.inMonth && cell.items.length >= 2;
                return (
                  <div
                    key={key}
                    className={`cal-cell${!cell.inMonth ? ' cal-cell--muted' : ''}${stress ? ' cal-cell--stress' : ''}`}
                  >
                    <div className="cal-day-num">{cell.day}</div>
                    {cell.items.map((it, i) => (
                      <span
                        key={i}
                        className={calChipClass[it.type] ?? 'cal-chip'}
                        title={`${it.label}${it.time ? ` · ${it.time}` : ''}`}
                      >
                        {it.label}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <EmbeddedAgentPanel title="Calendar intelligence" insights={CALENDAR_INSIGHTS} compact />
        </div>

        <aside className="cal-intel-rail" aria-label="Calendar intelligence">
          <section className="exec-panel exec-panel--layered">
            <div className="exec-panel__head">
              <h2>Busiest week</h2>
            </div>
            <p className="cal-intel-rail__stress">
              {monthDigest.busiestDays[0]
                ? `Peak · day ${monthDigest.busiestDays[0].day} (${monthDigest.busiestDays[0].count} events)`
                : '—'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {monthDigest.busiestDays[0]?.label ?? monthDigest.label}
            </p>
          </section>
          <section className="exec-panel">
            <div className="exec-panel__head">
              <h2>Underutilized days</h2>
            </div>
            <ul className="exec-gap-list">
              {monthDigest.underusedDays.slice(0, 5).map(d => (
                <li key={d.day}>
                  Day {d.day} · {d.note}
                </li>
              ))}
            </ul>
          </section>
          <section className="exec-panel">
            <div className="exec-panel__head">
              <h2>Event type mix</h2>
            </div>
            <ul className="exec-gap-list">
              {monthDigest.eventTypeMix.map(t => (
                <li key={t.type}>
                  {t.type} · {t.count}
                </li>
              ))}
            </ul>
          </section>
          <section className="exec-panel exec-panel--accent">
            <div className="exec-panel__head">
              <h2>Highest revenue event</h2>
            </div>
            {monthDigest.highestRevenueEvent ? (
              <>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {monthDigest.highestRevenueEvent.title} · {monthDigest.highestRevenueEvent.date}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {formatCurrency(monthDigest.highestRevenueEvent.value)} · {monthDigest.highestRevenueEvent.guests}{' '}
                  guests
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13 }}>No revenue events this month.</p>
            )}
          </section>
          <section className="exec-panel">
            <div className="exec-panel__head">
              <h2>Turnover conflicts</h2>
            </div>
            <ul className="exec-gap-list">
              {monthDigest.turnoverAlerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </section>
          <section className="exec-panel">
            <div className="exec-panel__head">
              <h2>Staffing watch</h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {HUB_LABELS.bookings} coordinator · Kisi batch before Jun 7
            </p>
            <Link to={ROUTES.tasks} className="exec-panel__link">
              Tasks →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
