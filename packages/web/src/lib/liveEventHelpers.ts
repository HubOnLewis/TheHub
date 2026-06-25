/**
 * Normalized field access and derived insights from live CRM event rows.
 */

import { formatRelativeDate, daysSince } from '../config/productionData.js';
import {
  computeCrmMetrics,
  filterCrmRows,
  rowMetricCategory,
  type CrmEventRow,
  type CrmMetricCategory,
} from './crmEvents.js';

export function getEventDate(row: CrmEventRow): Date | null {
  if (!row.eventDate) return null;
  const d = new Date(row.eventDate.includes('T') ? row.eventDate : `${row.eventDate}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getEventTimeRange(row: CrmEventRow): string {
  return row.eventTime?.trim() || '';
}

export function getEventContactName(row: CrmEventRow): string {
  return row.contact?.trim() || '—';
}

export function getEventValue(row: CrmEventRow): number {
  return row.value ?? 0;
}

export function getBalanceDue(row: CrmEventRow): number {
  return row.balanceDue ?? 0;
}

export function getEventStatus(row: CrmEventRow): string {
  return row.statusLabel || row.status;
}

export function isUpcoming(row: CrmEventRow, from = new Date()): boolean {
  const d = getEventDate(row);
  if (!d) return false;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return d >= start;
}

export function isCompleted(row: CrmEventRow): boolean {
  return rowMetricCategory(row) === 'completed_ytd';
}

export function isLost(row: CrmEventRow): boolean {
  const cat = rowMetricCategory(row);
  return cat === null && (row.pvStatus === 'lost' || row.status === 'Lost');
}

export function daysUntilEvent(row: CrmEventRow): number | null {
  const d = getEventDate(row);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function daysSinceContact(row: CrmEventRow): number | null {
  return daysSince(row.lastContacted);
}

export function isThisMonth(row: CrmEventRow, ref = new Date()): boolean {
  const d = getEventDate(row);
  if (!d) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function monthGroupKey(row: CrmEventRow): string | null {
  const d = getEventDate(row);
  if (!d) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function activePipelineRows(rows: CrmEventRow[]): CrmEventRow[] {
  return filterCrmRows(rows, 'active');
}

export function datedRows(rows: CrmEventRow[]): CrmEventRow[] {
  return rows.filter(r => getEventDate(r) != null);
}

export type CalendarFilter = 'upcoming' | 'this_month' | 'confirmed' | 'balance_due';

export function filterCalendarRows(rows: CrmEventRow[], filter: CalendarFilter): CrmEventRow[] {
  let out = datedRows(rows).filter(r => !isLost(r) && !isCompleted(r));

  switch (filter) {
    case 'upcoming':
      out = out.filter(r => isUpcoming(r));
      break;
    case 'this_month':
      out = out.filter(r => isThisMonth(r));
      break;
    case 'confirmed':
      out = out.filter(r => {
        const cat = rowMetricCategory(r);
        return cat === 'confirmed' || cat === 'balance_due';
      });
      break;
    case 'balance_due':
      out = out.filter(r => getBalanceDue(r) > 0 || rowMetricCategory(r) === 'balance_due');
      break;
  }

  return out.sort((a, b) => {
    const da = getEventDate(a)!.getTime();
    const db = getEventDate(b)!.getTime();
    return da - db;
  });
}

export function groupRowsByMonth(rows: CrmEventRow[]): Array<{ label: string; rows: CrmEventRow[] }> {
  const map = new Map<string, CrmEventRow[]>();
  for (const row of rows) {
    const key = monthGroupKey(row);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(row);
    map.set(key, arr);
  }
  return [...map.entries()].map(([label, groupRows]) => ({
    label,
    rows: groupRows.sort((a, b) => getEventDate(a)!.getTime() - getEventDate(b)!.getTime()),
  }));
}

export type LiveTaskPriority = 'high' | 'medium' | 'low';

export type LiveTask = {
  id: string;
  title: string;
  eventId: string;
  eventTitle: string;
  contact: string;
  priority: LiveTaskPriority;
  reason: string;
  dueLabel: string;
  value: number;
  balanceDue: number;
  href: string;
};

const PRIORITY_ORDER: Record<LiveTaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function generateLiveTasks(rows: CrmEventRow[]): LiveTask[] {
  const tasks: LiveTask[] = [];
  const staleContactDays = 14;

  for (const row of rows) {
    if (isLost(row) || isCompleted(row)) continue;

    const cat = rowMetricCategory(row);
    const balance = getBalanceDue(row);
    const base = {
      eventId: row.id,
      eventTitle: row.title,
      contact: getEventContactName(row),
      value: getEventValue(row),
      balanceDue: balance,
      href: row.href,
    };

    if (balance > 0 || cat === 'balance_due') {
      tasks.push({
        id: `balance-${row.id}`,
        title: `Collect balance — ${row.title}`,
        priority: 'high',
        reason: 'Balance due follow-up',
        dueLabel: 'As soon as possible',
        ...base,
      });
    }

    if (cat === 'proposal_sent') {
      tasks.push({
        id: `proposal-${row.id}`,
        title: `Follow up on proposal — ${row.title}`,
        priority: 'medium',
        reason: 'Proposal follow-up',
        dueLabel: 'This week',
        ...base,
      });
    }

    if (cat === 'lead' || cat === 'qualified') {
      const stale = daysSinceContact(row);
      if (stale == null || stale >= staleContactDays) {
        tasks.push({
          id: `stale-${row.id}`,
          title: `Reconnect with ${getEventContactName(row)}`,
          priority: cat === 'lead' ? 'low' : 'medium',
          reason: 'Stale contact follow-up',
          dueLabel: stale != null ? `${stale} days since contact` : 'No contact logged',
          ...base,
        });
      }
    }

    if (cat === 'confirmed') {
      const days = daysUntilEvent(row);
      if (days != null && days >= 0 && days <= 14) {
        tasks.push({
          id: `prep-${row.id}`,
          title: `Prepare for event — ${row.title}`,
          priority: days <= 7 ? 'high' : 'medium',
          reason: 'Upcoming confirmed event',
          dueLabel: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`,
          ...base,
        });
      }
    }
  }

  return tasks.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return a.eventTitle.localeCompare(b.eventTitle);
  });
}

export type InboxActivityItem = {
  id: string;
  eventId: string;
  eventTitle: string;
  contact: string;
  reason: string;
  dateIso: string;
  dateDisplay: string;
  statusLabel: string;
  value: number;
  balanceDue: number;
  href: string;
  sortKey: number;
};

function pushInboxItem(
  items: InboxActivityItem[],
  row: CrmEventRow,
  reason: string,
  dateIso: string,
  suffix: string,
) {
  items.push({
    id: `${suffix}-${row.id}`,
    eventId: row.id,
    eventTitle: row.title,
    contact: getEventContactName(row),
    reason,
    dateIso,
    dateDisplay: formatRelativeDate(dateIso),
    statusLabel: getEventStatus(row),
    value: getEventValue(row),
    balanceDue: getBalanceDue(row),
    href: row.href,
    sortKey: new Date(dateIso).getTime() || 0,
  });
}

export function generateInboxActivity(rows: CrmEventRow[]): InboxActivityItem[] {
  const items: InboxActivityItem[] = [];
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  const threeDays = 3 * 86_400_000;

  for (const row of rows) {
    if (isLost(row)) continue;

    const cat = rowMetricCategory(row);
    const balance = getBalanceDue(row);
    const updated = row.lastContacted ?? row.createdAt ?? null;

    if (balance > 0 || cat === 'balance_due') {
      pushInboxItem(items, row, 'Balance due follow-up', updated ?? new Date().toISOString(), 'balance');
    }

    if (cat === 'proposal_sent') {
      pushInboxItem(items, row, 'Proposal awaiting response', updated ?? new Date().toISOString(), 'proposal');
    }

    if (row.createdAt) {
      const createdMs = new Date(row.createdAt).getTime();
      if (!Number.isNaN(createdMs) && now - createdMs <= sevenDays) {
        pushInboxItem(items, row, 'New event created', row.createdAt, 'created');
      }
    }

    if (cat === 'confirmed') {
      const days = daysUntilEvent(row);
      if (days != null && days >= 0 && days <= 14) {
        const eventIso = row.eventDate ?? updated ?? new Date().toISOString();
        pushInboxItem(items, row, 'Upcoming confirmed event', eventIso, 'upcoming');
      }
    }

    if (updated) {
      const updatedMs = new Date(updated).getTime();
      if (!Number.isNaN(updatedMs) && now - updatedMs <= threeDays) {
        pushInboxItem(items, row, 'Recently updated event', updated, 'updated');
      }
    }
  }

  const seen = new Set<string>();
  return items
    .filter(item => {
      const key = `${item.eventId}:${item.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.sortKey - a.sortKey);
}

export type LiveReportSummary = {
  metrics: ReturnType<typeof computeCrmMetrics>;
  activeCount: number;
  activePipelineValue: number;
  balanceDueTotal: number;
  paymentsCollected: number;
  byStatus: Array<{ label: string; count: number; value: number }>;
  upcomingByMonth: Array<{ month: string; count: number; value: number }>;
  balanceDueRows: CrmEventRow[];
};

const STATUS_BUCKETS: Array<{ id: CrmMetricCategory; label: string }> = [
  { id: 'lead', label: 'Lead' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'balance_due', label: 'Balance Due' },
  { id: 'completed_ytd', label: 'Completed YTD' },
];

export function buildLiveReportSummary(rows: CrmEventRow[]): LiveReportSummary {
  const metrics = computeCrmMetrics(rows);
  const active = activePipelineRows(rows);
  const balanceDueRows = rows
    .filter(r => getBalanceDue(r) > 0 || rowMetricCategory(r) === 'balance_due')
    .sort((a, b) => getBalanceDue(b) - getBalanceDue(a));

  const byStatus = STATUS_BUCKETS.map(({ id, label }) => {
    const matched = filterCrmRows(rows, id);
    return {
      label,
      count: matched.length,
      value: matched.reduce((s, r) => s + getEventValue(r), 0),
    };
  });

  const upcoming = datedRows(rows).filter(r => isUpcoming(r) && !isLost(r) && !isCompleted(r));
  const monthMap = new Map<string, { count: number; value: number }>();
  for (const row of upcoming) {
    const key = monthGroupKey(row);
    if (!key) continue;
    const cur = monthMap.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += getEventValue(row);
    monthMap.set(key, cur);
  }

  return {
    metrics,
    activeCount: active.length,
    activePipelineValue: active.reduce((s, r) => s + getEventValue(r), 0),
    balanceDueTotal: balanceDueRows.reduce((s, r) => s + getBalanceDue(r), 0),
    paymentsCollected: rows.reduce((s, r) => s + (r.amountPaid ?? 0), 0),
    byStatus,
    upcomingByMonth: [...monthMap.entries()].map(([month, data]) => ({ month, ...data })),
    balanceDueRows,
  };
}
