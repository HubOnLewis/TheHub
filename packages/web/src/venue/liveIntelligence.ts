/**
 * Live venue intelligence — attention queue, owner briefing, agent signals from CRM rows.
 */

import { formatCurrency, resolveVenueStage, venueStageLabel, type VenueStage } from '@hub-crm/shared';
import type { CrmEventRow } from '../lib/crmEvents.js';
import { rowMetricCategory } from '../lib/crmEvents.js';
import {
  daysUntilEvent,
  getBalanceDue,
  getEventDate,
  isCompleted,
  isLost,
  isUpcoming,
} from '../lib/liveEventHelpers.js';
import {
  detectConflicts,
  rowsToCalendarBlocks,
  type CalendarConflict,
} from './calendarEngine.js';

export type AttentionPriority = 'critical' | 'high' | 'medium' | 'low';

export type AttentionItem = {
  id: string;
  priority: AttentionPriority;
  title: string;
  detail: string;
  eventId: string;
  eventTitle: string;
  href: string;
  agent: string;
  actionLabel: string;
  amount?: number;
};

export type OwnerBriefingLive = {
  generatedAt: string;
  headline: string;
  summary: string;
  kpis: Array<{ label: string; value: string; tone?: 'warn' | 'ok' | 'neutral' }>;
  risks: AttentionItem[];
  opportunities: AttentionItem[];
  todayEvents: CrmEventRow[];
  weekEvents: CrmEventRow[];
  conflicts: CalendarConflict[];
  revenueAtRisk: number;
  pipelineValue: number;
  balanceOutstanding: number;
};

const PRIORITY_RANK: Record<AttentionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function stageOf(row: CrmEventRow): VenueStage {
  return resolveVenueStage({
    dealStatus: row.status,
    pvStatus: row.pvStatus ?? row.status,
    balanceDue: row.balanceDue,
    amountPaid: row.amountPaid,
    grandTotal: row.value,
  });
}

export function buildAttentionQueue(rows: CrmEventRow[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  const blocks = rowsToCalendarBlocks(rows);
  const conflicts = detectConflicts(blocks);

  for (const c of conflicts.filter(x => x.severity === 'hard')) {
    items.push({
      id: c.id,
      priority: 'critical',
      title: 'Calendar conflict',
      detail: c.reason,
      eventId: c.eventA.id,
      eventTitle: c.eventA.title,
      href: c.eventA.href,
      agent: 'Calendar Conflict',
      actionLabel: 'Resolve schedule',
    });
  }

  for (const row of rows) {
    if (isLost(row) || isCompleted(row)) continue;
    const balance = getBalanceDue(row);
    const days = daysUntilEvent(row);
    const stage = stageOf(row);
    const cat = rowMetricCategory(row);

    if (balance > 0) {
      const urgent = days != null && days >= 0 && days <= 7;
      items.push({
        id: `bal-${row.id}`,
        priority: urgent ? 'critical' : 'high',
        title: `Collect balance — ${formatCurrency(balance)}`,
        detail:
          days != null && days >= 0
            ? `${row.title} · event in ${days} day${days === 1 ? '' : 's'}`
            : `${row.title} · outstanding balance`,
        eventId: row.id,
        eventTitle: row.title,
        href: row.href,
        agent: 'Balance Guardian',
        actionLabel: 'Send payment link',
        amount: balance,
      });
    }

    if (cat === 'proposal_sent' || stage === 'proposal') {
      items.push({
        id: `prop-${row.id}`,
        priority: 'high',
        title: 'Proposal follow-up',
        detail: `${row.title} · ${row.contact} · ${formatCurrency(row.value)}`,
        eventId: row.id,
        eventTitle: row.title,
        href: row.href,
        agent: 'Follow-Up Hunter',
        actionLabel: 'Draft follow-up',
        amount: row.value,
      });
    }

    if (stage === 'inquiry' || cat === 'lead') {
      items.push({
        id: `inq-${row.id}`,
        priority: 'medium',
        title: 'New inquiry needs response',
        detail: `${row.title} · ${row.contact}`,
        eventId: row.id,
        eventTitle: row.title,
        href: row.href,
        agent: 'Lead Concierge',
        actionLabel: 'Open inquiry',
      });
    }

    if (days != null && days >= 0 && days <= 3 && (stage === 'confirmed' || stage === 'prep' || cat === 'confirmed')) {
      items.push({
        id: `prep-${row.id}`,
        priority: days === 0 ? 'critical' : 'high',
        title: days === 0 ? 'Event is today — final prep' : `Event in ${days} days — prep check`,
        detail: `${row.title} · ${row.space || 'Space TBD'} · ${row.guests || '?'} guests`,
        eventId: row.id,
        eventTitle: row.title,
        href: row.href,
        agent: 'Booking Coordinator',
        actionLabel: 'Open BEO tools',
      });
    }
  }

  return items
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 40);
}

function isThisWeek(row: CrmEventRow, ref = new Date()): boolean {
  const d = getEventDate(row);
  if (!d) return false;
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

function isToday(row: CrmEventRow, ref = new Date()): boolean {
  const d = getEventDate(row);
  if (!d) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function buildOwnerBriefing(rows: CrmEventRow[]): OwnerBriefingLive {
  const active = rows.filter(r => !isLost(r) && !isCompleted(r));
  const attention = buildAttentionQueue(rows);
  const blocks = rowsToCalendarBlocks(rows);
  const conflicts = detectConflicts(blocks).filter(c => c.severity === 'hard');
  const todayEvents = rows.filter(r => isToday(r) && !isLost(r));
  const weekEvents = rows.filter(r => isThisWeek(r) && !isLost(r) && isUpcoming(r));
  const balanceOutstanding = active.reduce((s, r) => s + getBalanceDue(r), 0);
  const pipelineValue = active.reduce((s, r) => s + (r.value || 0), 0);
  const revenueAtRisk = attention
    .filter(a => a.priority === 'critical' || a.priority === 'high')
    .reduce((s, a) => s + (a.amount ?? 0), 0);

  const risks = attention.filter(a => a.priority === 'critical' || a.priority === 'high').slice(0, 8);
  const opportunities = attention
    .filter(a => a.agent === 'Follow-Up Hunter' || a.agent === 'Lead Concierge')
    .slice(0, 6);

  const hardCount = conflicts.length;
  const headline =
    hardCount > 0
      ? `${hardCount} schedule conflict${hardCount === 1 ? '' : 's'} need attention`
      : balanceOutstanding > 0
        ? `${formatCurrency(balanceOutstanding)} outstanding across the pipeline`
        : todayEvents.length > 0
          ? `${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'} on the floor today`
          : 'Venue pipeline is calm — protect occupancy and follow-ups';

  const summary = [
    `${active.length} active events`,
    `${weekEvents.length} this week`,
    balanceOutstanding > 0 ? `${formatCurrency(balanceOutstanding)} balance due` : 'no open balances',
    hardCount > 0 ? `${hardCount} hard conflicts` : 'no hard conflicts',
  ].join(' · ');

  return {
    generatedAt: new Date().toISOString(),
    headline,
    summary,
    kpis: [
      { label: 'Active events', value: String(active.length), tone: 'neutral' },
      {
        label: 'Pipeline value',
        value: formatCurrency(pipelineValue),
        tone: 'ok',
      },
      {
        label: 'Balances due',
        value: formatCurrency(balanceOutstanding),
        tone: balanceOutstanding > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Revenue at risk',
        value: formatCurrency(revenueAtRisk),
        tone: revenueAtRisk > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Today',
        value: String(todayEvents.length),
        tone: todayEvents.length > 0 ? 'ok' : 'neutral',
      },
      {
        label: 'Conflicts',
        value: String(hardCount),
        tone: hardCount > 0 ? 'warn' : 'ok',
      },
    ],
    risks,
    opportunities,
    todayEvents,
    weekEvents,
    conflicts,
    revenueAtRisk,
    pipelineValue,
    balanceOutstanding,
  };
}

export function stageLabelForRow(row: CrmEventRow): string {
  return venueStageLabel(stageOf(row));
}

export type GlobalSearchHit = {
  id: string;
  kind: 'event' | 'task' | 'attention';
  title: string;
  subtitle: string;
  href: string;
};

export function globalSearch(
  query: string,
  rows: CrmEventRow[],
  attention: AttentionItem[],
): GlobalSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: GlobalSearchHit[] = [];

  for (const row of rows) {
    const hay = [
      row.title,
      row.contact,
      row.space,
      row.owner,
      row.statusLabel,
      row.eventDateDisplay,
    ]
      .join(' ')
      .toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        id: `ev-${row.id}`,
        kind: 'event',
        title: row.title,
        subtitle: `${row.contact} · ${row.eventDateDisplay} · ${row.statusLabel}`,
        href: row.href,
      });
    }
  }

  for (const a of attention) {
    if (
      a.title.toLowerCase().includes(q) ||
      a.detail.toLowerCase().includes(q) ||
      a.eventTitle.toLowerCase().includes(q)
    ) {
      hits.push({
        id: `att-${a.id}`,
        kind: 'attention',
        title: a.title,
        subtitle: a.detail,
        href: a.href,
      });
    }
  }

  return hits.slice(0, 20);
}
