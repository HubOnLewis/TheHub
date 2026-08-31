/**
 * True venue calendar — week / day views, space awareness, conflict highlighting.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import type { CrmEventRow } from '../../lib/crmEvents.js';
import {
  addDays,
  blocksForDate,
  detectConflicts,
  formatMinutes,
  hourSlots,
  rowsToCalendarBlocks,
  startOfWeek,
  toDateKey,
  type CalendarBlock,
  type CalendarConflict,
  type CalendarViewMode,
  weekDateKeys,
} from '../../venue/calendarEngine.js';

type Props = {
  rows: CrmEventRow[];
  hideLostDefault?: boolean;
};

function dayLabel(dateKey: string): { weekday: string; date: string; isToday: boolean } {
  const d = new Date(`${dateKey}T12:00:00`);
  const today = toDateKey(new Date());
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isToday: dateKey === today,
  };
}

function blockStyle(block: CalendarBlock, dayStart = 8 * 60, dayEnd = 24 * 60): React.CSSProperties {
  const span = dayEnd - dayStart;
  const top = ((Math.max(block.startMin, dayStart) - dayStart) / span) * 100;
  const height = ((Math.min(block.endMin, dayEnd) - Math.max(block.startMin, dayStart)) / span) * 100;
  return {
    top: `${Math.max(0, top)}%`,
    height: `${Math.max(3.5, height)}%`,
  };
}

function ConflictBanner({ conflicts }: { conflicts: CalendarConflict[] }) {
  const hard = conflicts.filter(c => c.severity === 'hard');
  if (hard.length === 0) return null;
  return (
    <div className="venue-cal-conflict-banner" role="alert">
      <strong>Schedule conflicts detected</strong>
      <ul>
        {hard.slice(0, 4).map(c => (
          <li key={c.id}>{c.reason}</li>
        ))}
      </ul>
    </div>
  );
}

function EventChip({
  block,
  hasConflict,
}: {
  block: CalendarBlock;
  hasConflict: boolean;
}) {
  return (
    <Link
      to={block.href}
      className={`venue-cal-chip${hasConflict ? ' venue-cal-chip--conflict' : ''}${block.balanceDue > 0 ? ' venue-cal-chip--balance' : ''}`}
      title={`${block.title}\n${block.contact}\n${block.space}\n${formatMinutes(block.startMin)} – ${formatMinutes(block.endMin)}`}
    >
      <span className="venue-cal-chip__time">
        {formatMinutes(block.startMin)}
      </span>
      <span className="venue-cal-chip__title">{block.title}</span>
      <span className="venue-cal-chip__meta">
        {block.space}
        {block.balanceDue > 0 ? ` · ${formatCurrency(block.balanceDue)} due` : ''}
      </span>
    </Link>
  );
}

export default function VenueCalendar({ rows, hideLostDefault = true }: Props) {
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [spaceFilter, setSpaceFilter] = useState<string>('all');
  const [hideLost, setHideLost] = useState(hideLostDefault);

  const visibleRows = useMemo(() => {
    if (!hideLost) return rows;
    return rows.filter(r => {
      const st = (r.pvStatus || r.status || '').toLowerCase();
      return st !== 'lost' && r.status !== 'Lost';
    });
  }, [rows, hideLost]);

  const blocks = useMemo(() => rowsToCalendarBlocks(visibleRows), [visibleRows]);
  const conflicts = useMemo(() => detectConflicts(blocks), [blocks]);
  const conflictBlockIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      if (c.severity !== 'hard') continue;
      set.add(c.eventA.id);
      set.add(c.eventB.id);
    }
    return set;
  }, [conflicts]);

  const weekKeys = useMemo(() => weekDateKeys(anchor), [anchor]);
  const dayKey = toDateKey(anchor);
  const slots = hourSlots(8, 24);

  const spaces = useMemo(() => {
    const s = new Set(blocks.map(b => b.space));
    return ['all', ...[...s].sort()];
  }, [blocks]);

  const filteredBlocks = useMemo(() => {
    if (spaceFilter === 'all') return blocks;
    return blocks.filter(b => b.space === spaceFilter || b.space === 'Full venue');
  }, [blocks, spaceFilter]);

  const weekLabel = useMemo(() => {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }, [anchor]);

  const shift = (days: number) => {
    setAnchor(a => addDays(a, days));
  };

  const goToday = () => setAnchor(new Date());

  const dayBlocks = blocksForDate(filteredBlocks, mode === 'day' ? dayKey : '');

  return (
    <div className="venue-cal">
      <header className="venue-cal-toolbar">
        <div className="venue-cal-toolbar__left">
          <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => shift(mode === 'day' ? -1 : -7)}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => shift(mode === 'day' ? 1 : 7)}
            aria-label="Next"
          >
            ›
          </button>
          <h2 className="venue-cal-toolbar__title">
            {mode === 'day'
              ? new Date(`${dayKey}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : weekLabel}
          </h2>
        </div>
        <div className="venue-cal-toolbar__right">
          <label className="venue-cal-lost-toggle">
            <input type="checkbox" checked={hideLost} onChange={e => setHideLost(e.target.checked)} />
            Hide Lost
          </label>
          <select
            className="venue-cal-space-select"
            value={spaceFilter}
            onChange={e => setSpaceFilter(e.target.value)}
            aria-label="Filter by space"
          >
            {spaces.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? 'All spaces' : s}
              </option>
            ))}
          </select>
          <div className="venue-cal-mode" role="tablist" aria-label="Calendar view">
            {(['week', 'day'] as const).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`venue-cal-mode__btn${mode === m ? ' is-active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'week' ? 'Week' : 'Day'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <ConflictBanner conflicts={conflicts} />

      {mode === 'week' ? (
        <div className="venue-cal-week">
          <div className="venue-cal-week__gutter" aria-hidden>
            <div className="venue-cal-week__corner" />
            {slots.map(min => (
              <div key={min} className="venue-cal-hour-label">
                {formatMinutes(min)}
              </div>
            ))}
          </div>
          {weekKeys.map(key => {
            const label = dayLabel(key);
            const dayList = blocksForDate(filteredBlocks, key);
            return (
              <div
                key={key}
                className={`venue-cal-daycol${label.isToday ? ' venue-cal-daycol--today' : ''}`}
              >
                <button
                  type="button"
                  className="venue-cal-daycol__head"
                  onClick={() => {
                    setAnchor(new Date(`${key}T12:00:00`));
                    setMode('day');
                  }}
                >
                  <span className="venue-cal-daycol__wd">{label.weekday}</span>
                  <span className="venue-cal-daycol__dt">{label.date}</span>
                  <span className="venue-cal-daycol__count">
                    {dayList.length} event{dayList.length === 1 ? '' : 's'}
                  </span>
                </button>
                <div className="venue-cal-daycol__body">
                  {slots.map(min => (
                    <div key={min} className="venue-cal-hour-slot" />
                  ))}
                  {dayList.map(block => (
                    <div
                      key={block.id}
                      className="venue-cal-abs"
                      style={blockStyle(block)}
                    >
                      <EventChip
                        block={block}
                        hasConflict={conflictBlockIds.has(block.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="venue-cal-day">
          <div className="venue-cal-day__timeline">
            <div className="venue-cal-week__gutter" aria-hidden>
              {slots.map(min => (
                <div key={min} className="venue-cal-hour-label">
                  {formatMinutes(min)}
                </div>
              ))}
            </div>
            <div className="venue-cal-day__track">
              {slots.map(min => (
                <div key={min} className="venue-cal-hour-slot" />
              ))}
              {dayBlocks.map(block => (
                <div key={block.id} className="venue-cal-abs" style={blockStyle(block)}>
                  <EventChip
                    block={block}
                    hasConflict={conflictBlockIds.has(block.id)}
                  />
                </div>
              ))}
              {dayBlocks.length === 0 ? (
                <div className="venue-cal-empty">No events on this day</div>
              ) : null}
            </div>
          </div>
          <aside className="venue-cal-day__list card">
            <h3>Day agenda</h3>
            {dayBlocks.length === 0 ? (
              <p className="text-muted text-sm">Nothing scheduled — protect this inventory.</p>
            ) : (
              <ul className="venue-cal-agenda">
                {dayBlocks.map(b => (
                  <li key={b.id}>
                    <Link to={b.href}>
                      <strong>{b.title}</strong>
                      <span>
                        {formatMinutes(b.startMin)} – {formatMinutes(b.endMin)} · {b.space}
                      </span>
                      <span className="text-muted">
                        {b.contact} · {formatCurrency(b.value)}
                        {b.balanceDue > 0 ? ` · ${formatCurrency(b.balanceDue)} due` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

      <footer className="venue-cal-legend">
        <span className="venue-cal-legend__item">
          <i className="venue-cal-dot venue-cal-dot--ok" /> Scheduled
        </span>
        <span className="venue-cal-legend__item">
          <i className="venue-cal-dot venue-cal-dot--balance" /> Balance due
        </span>
        <span className="venue-cal-legend__item">
          <i className="venue-cal-dot venue-cal-dot--conflict" /> Conflict
        </span>
        <span className="text-muted text-sm">
          {filteredBlocks.length} dated events · {conflicts.filter(c => c.severity === 'hard').length} hard conflicts
        </span>
      </footer>
    </div>
  );
}
