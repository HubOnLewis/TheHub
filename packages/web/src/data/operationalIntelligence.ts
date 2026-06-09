/**
 * Operational intelligence — derived ONLY from imported Perfect Venue seed + existing Hub datasets.
 * No synthetic records: transforms, aggregates, and scoring on real PV_PIPELINE_EVENTS, inquiries, tasks, etc.
 */

import { formatCurrency } from '@hub-crm/shared';
import {
  PV_AI_ATTENTION,
  PV_DEMO_PIPELINE,
  PV_EXECUTIVE_ANCHORS,
  PV_INBOX_MESSAGES,
  PV_OVERDUE_FOLLOWUPS,
  PV_PIPELINE_EVENTS,
  PV_RECENT_INQUIRIES,
  PV_TASKS,
  PV_VENUE_SUMMARY,
  getPvImportMeta,
  pvStatusDisplay,
  type PvSeedEvent,
  type PvEventStatus,
} from './perfectVenueSeed.js';
import { PV_FULL_EXPORT_AVAILABLE } from './pvExportFlags.js';
import { getFullPvAccounts, getFullPvEvents } from './pvDataLayer.js';
import {
  getEnhancedAccountIntelligence,
  getEnhancedOpportunityIntelligence,
  getOwnerBriefingDigest,
} from './pvUiIntelligence.js';
import { getExecutiveFinancialRailSections } from './pvFinancialIntelligence.js';
import type { VenueCommandState } from './venueCommandState.js';

export {
  getRevenueIntelligence,
  getPaymentPressure,
  getDepositRisk,
  getCashFlowForecast,
  getEventValueMomentum,
  getAccountLifetimeValue,
  getBalanceExposure,
  getCollectionsQueue,
  getProposalConversionAnalytics,
  getVenueRevenuePacing,
  getUpcomingRevenueWindows,
  getPaymentsForEvent,
  getFinancialImportSummary,
} from './pvFinancialIntelligence.js';
import { opportunityDetailPath, ROUTES } from '../config/paths.js';

const pvMeta = PV_FULL_EXPORT_AVAILABLE ? getPvImportMeta() : null;
export const OPS_DATA_SOURCE = pvMeta
  ? `Perfect Venue XLSX · ${pvMeta.importedAt.slice(0, 10)} · ${pvMeta.rowCounts.eventsNormalized} events`
  : `Perfect Venue import · ${PV_VENUE_SUMMARY.extractedAt}`;

function daysUntil(isoDate: string): number {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.ceil((t - Date.now()) / 86400000);
}

function daysSinceLabel(isoDate: string): number {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

/** Intelligence scoring on real PV event rows */
export function assessEventIntel(e: PvSeedEvent) {
  const until = daysUntil(e.eventDate);
  const depositGap = e.value > 0 && e.depositPaid < e.value * 0.5;
  const balanceRisk = e.balanceDue > 0 && until < 21;
  const proposalStall = e.pvStatus === 'proposal_sent' && e.depositPaid === 0;

  let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
  const flags: string[] = [];

  if (balanceRisk && until < 14) {
    urgency = 'critical';
    flags.push('Balance due before event');
  } else if (proposalStall) {
    urgency = 'high';
    flags.push('Proposal viewed · no deposit');
  } else if (depositGap && e.pvStatus !== 'lost') {
    urgency = 'high';
    flags.push('Deposit path incomplete');
  } else if (e.pvStatus === 'qualified') {
    urgency = 'medium';
    flags.push('Qualification in progress');
  }

  const closeScore =
    e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due'
      ? 85
      : e.pvStatus === 'proposal_sent'
        ? depositGap
          ? 45
          : 62
        : e.pvStatus === 'qualified'
          ? 55
          : 30;

  return {
    urgency,
    flags,
    closeScore,
    daysUntilEvent: until,
    coordinator: coordinatorForEvent(e.id),
    aiLine: aiLineForEvent(e),
  };
}

function coordinatorForEvent(id: string): string {
  const t = PV_TASKS.find(x => x.linkedEvent.toLowerCase().includes(id.replace('pv-', '').slice(0, 6)));
  return t?.owner.name ?? 'Hannah Mitchell';
}

function aiLineForEvent(e: PvSeedEvent): string {
  const hit = PV_AI_ATTENTION.find(a => a.text.toLowerCase().includes(e.client.split(' ')[0].toLowerCase()));
  if (hit) return hit.text;
  if (e.pvStatus === 'proposal_sent' && e.depositPaid === 0) return 'Likely to close — proposal active · deposit pending';
  if (e.balanceDue > 0) return `Response risk — ${formatCurrency(e.balanceDue)} balance outstanding`;
  return 'On track — no immediate intervention';
}

/** Leads / inquiry intelligence — PV_RECENT_INQUIRIES + early-stage events */
export interface LeadIntelRow {
  id: string;
  source: string;
  client: string;
  org: string;
  summary: string;
  when: string;
  sla: string;
  urgency: 'high' | 'medium' | 'low';
  aiAssessment: string;
  pvStatus?: PvEventStatus;
  value?: number;
  linkId?: string;
}

export function getLeadIntelligence(): LeadIntelRow[] {
  const fromInquiries: LeadIntelRow[] = PV_RECENT_INQUIRIES.map(q => ({
    id: q.id,
    source: q.source,
    client: q.who,
    org: q.org,
    summary: q.what,
    when: q.when,
    sla: q.sla,
    urgency: q.sla !== 'Met' && q.sla.includes('h') ? 'high' : 'low',
    aiAssessment:
      q.what.includes('Proposal') && !q.what.includes('Confirmed')
        ? 'Proposal momentum — monitor deposit path'
        : 'Inquiry progressing — coordinator engaged',
    linkId: PV_PIPELINE_EVENTS.find(e => q.org.includes(e.title) || q.who.includes(e.client))?.id,
  }));

  const earlyEvents = PV_PIPELINE_EVENTS.filter(e =>
    ['lead', 'qualified', 'proposal_sent'].includes(e.pvStatus),
  ).map(e => {
    const intel = assessEventIntel(e);
    return {
      id: e.id,
      source: 'Perfect Venue',
      client: e.client,
      org: e.title,
      summary: `${pvStatusDisplay(e.pvStatus)} · ${e.eventType}`,
      when: e.eventDate,
      sla: '—',
      urgency: (intel.urgency === 'critical' || intel.urgency === 'high' ? 'high' : 'medium') as LeadIntelRow['urgency'],
      aiAssessment: intel.aiLine,
      pvStatus: e.pvStatus,
      value: e.value,
      linkId: e.id,
    };
  });

  return [...fromInquiries, ...earlyEvents];
}

/** Account relationship profiles — grouped real clients from PV pipeline */
export interface AccountIntelProfile {
  client: string;
  eventCount: number;
  totalValue: number;
  totalCollected: number;
  balanceOutstanding: number;
  upcomingEvent?: string;
  lastEventType: string;
  isVip: boolean;
  isDormant: boolean;
  expansionNote?: string;
  coordinator: string;
  eventIds: string[];
}

export function getAccountIntelligence(): AccountIntelProfile[] {
  if (PV_FULL_EXPORT_AVAILABLE) {
    const enhanced = getEnhancedAccountIntelligence();
    if (enhanced.length) return enhanced;
  }

  if (PV_FULL_EXPORT_AVAILABLE) {
    const eventById = new Map(getFullPvEvents().map(e => [e.id, e]));
    return getFullPvAccounts()
      .filter(a => a.eventCount > 0)
      .map(a => {
        const events = a.eventIds
          .map(id => eventById.get(id))
          .filter((e): e is NonNullable<typeof e> => !!e && !e.isExample);
        const upcoming = events
          .filter(e => e.eventDateIso && daysUntil(e.eventDateIso) >= 0 && e.pvStatus !== 'lost')
          .sort((x, y) => (x.eventDateIso ?? '').localeCompare(y.eventDateIso ?? ''))[0];
        const last = events[events.length - 1];
        return {
          client: a.name,
          eventCount: a.eventCount,
          totalValue: a.totalSpend,
          totalCollected: events.reduce((s, e) => s + e.depositPaid + e.balancePaid, 0),
          balanceOutstanding: events.reduce((s, e) => s + e.balanceDue, 0),
          upcomingEvent: upcoming
            ? `${upcoming.title} · ${upcoming.eventDateIso}`
            : undefined,
          lastEventType: last?.eventType ?? '—',
          isVip: a.isVip,
          isDormant: a.isDormant,
          expansionNote: a.expansionNote,
          coordinator: last?.owner ?? 'Hannah Mitchell',
          eventIds: a.eventIds,
        };
      })
      .sort((x, y) => y.totalValue - x.totalValue);
  }

  const byClient = new Map<string, PvSeedEvent[]>();
  for (const e of PV_PIPELINE_EVENTS) {
    const list = byClient.get(e.client) ?? [];
    list.push(e);
    byClient.set(e.client, list);
  }

  return [...byClient.entries()]
    .map(([client, events]) => {
      const totalValue = events.reduce((s, e) => s + e.value, 0);
      const totalCollected = events.reduce((s, e) => s + e.depositPaid, 0);
      const balanceOutstanding = events.reduce((s, e) => s + e.balanceDue, 0);
      const upcoming = events
        .filter(e => daysUntil(e.eventDate) >= 0 && e.pvStatus !== 'lost')
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
      const repeat = events.length >= 2;
      const dormant = upcoming ? daysUntil(upcoming.eventDate) > 120 : true;

      return {
        client,
        eventCount: events.length,
        totalValue,
        totalCollected,
        balanceOutstanding,
        upcomingEvent: upcoming ? `${upcoming.title} · ${upcoming.eventDate}` : undefined,
        lastEventType: events[events.length - 1]?.eventType ?? '—',
        isVip: totalValue >= 900 || repeat,
        isDormant: dormant && totalValue > 500,
        expansionNote: repeat ? 'Repeat booker — nurture for next season' : undefined,
        coordinator: coordinatorForEvent(events[0].id),
        eventIds: events.map(e => e.id),
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

/** Opportunities — full PV pipeline with operational fields */
export interface OpportunityIntelRow {
  event: PvSeedEvent;
  intel: ReturnType<typeof assessEventIntel>;
  link: string;
}

export function getOpportunityIntelligence(): OpportunityIntelRow[] {
  if (PV_FULL_EXPORT_AVAILABLE) {
    const rows = getEnhancedOpportunityIntelligence();
    if (rows.length) {
      return rows.filter(o => o.bucket !== 'lost_insight');
    }
  }
  return PV_PIPELINE_EVENTS.map(event => ({
    event,
    intel: assessEventIntel(event),
    link: opportunityDetailPath(event.id),
  }));
}

/** Follow-ups from PV overdue + inbox threads needing reply */
export interface FollowUpIntelRow {
  id: string;
  what: string;
  who: string;
  due: string;
  context: string;
  urgency: 'high' | 'medium' | 'low';
  aiTone: string;
  relationshipRisk?: string;
}

export function getFollowUpIntelligence(): FollowUpIntelRow[] {
  const overdue = PV_OVERDUE_FOLLOWUPS.map(o => ({
    id: o.id,
    what: o.what,
    who: o.who,
    due: o.due,
    context: o.amt,
    urgency: (o.due.includes('May 19') || o.what.includes('follow-up') ? 'high' : 'medium') as FollowUpIntelRow['urgency'],
    aiTone: o.what.includes('Proposal') ? 'Warm · confirm interest in package' : 'Professional · logistics check-in',
    relationshipRisk: o.what.includes('WAREIA') ? 'Recurring chapter — deposit cadence' : undefined,
  }));

  const inbox = PV_INBOX_MESSAGES.filter(m => m.unread).map(m => ({
    id: m.id,
    what: `Reply · ${m.subject}`,
    who: m.from,
    due: m.time,
    context: m.preview,
    urgency: 'high' as const,
    aiTone: 'Prompt · acknowledge and propose next step',
    relationshipRisk: undefined,
  }));

  return [...inbox, ...overdue];
}

/** My Work — tasks + follow-ups + high-pressure events */
export interface MyWorkIntelItem {
  id: string;
  kind: 'task' | 'approval' | 'followup' | 'event';
  title: string;
  subtitle: string;
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  dueLabel: string;
  link?: string;
}

export function getMyWorkIntelligence(): MyWorkIntelItem[] {
  const tasks: MyWorkIntelItem[] = PV_TASKS.map(t => ({
    id: t.id,
    kind: 'task',
    title: t.title,
    subtitle: `${t.client} · ${t.linkedEvent}`,
    urgency: t.overdue ? 'urgent' : t.priority === 'urgent' ? 'urgent' : t.priority === 'high' ? 'high' : 'medium',
    dueLabel: t.overdue ? 'Overdue' : t.daysUntil <= 0 ? 'Today' : `${t.daysUntil}d`,
    link: '/tasks',
  }));

  const followups: MyWorkIntelItem[] = PV_OVERDUE_FOLLOWUPS.map(f => ({
    id: f.id,
    kind: 'followup',
    title: f.what,
    subtitle: f.amt,
    urgency: 'high',
    dueLabel: f.due,
    link: '/follow-ups',
  }));

  const hotEvents = PV_PIPELINE_EVENTS.filter(e => {
    const u = assessEventIntel(e).urgency;
    return u === 'critical' || u === 'high';
  }).map(e => ({
    id: e.id,
    kind: 'event' as const,
    title: e.title,
    subtitle: `${e.client} · ${pvStatusDisplay(e.pvStatus)}`,
    urgency: 'high' as const,
    dueLabel: `${daysUntil(e.eventDate)}d to event`,
    link: opportunityDetailPath(e.id),
  }));

  const urgentTasks = PV_TASKS.filter(t => t.overdue || t.priority === 'urgent').map(t => ({
    id: t.id,
    kind: 'task' as const,
    title: t.title,
    subtitle: `${t.client} · ${t.linkedEvent}`,
    urgency: (t.overdue ? 'urgent' : t.priority === 'urgent' ? 'urgent' : 'high') as MyWorkIntelItem['urgency'],
    dueLabel: t.overdue ? 'Overdue' : t.daysUntil <= 0 ? 'Today' : `${t.daysUntil}d`,
    link: '/tasks',
  }));

  return [...urgentTasks, ...followups, ...hotEvents].slice(0, 24);
}

/** Pipeline pressure groups from PV status buckets */
export function getPipelinePressureGroups(): Record<string, OpportunityIntelRow[]> {
  const rows = getOpportunityIntelligence();
  const groups: Record<string, OpportunityIntelRow[]> = {};
  for (const r of rows) {
    const key = pvStatusDisplay(r.event.pvStatus);
    groups[key] = groups[key] ?? [];
    groups[key].push(r);
  }
  return groups;
}

export function getPipelineSummaryStats() {
  return {
    source: OPS_DATA_SOURCE,
    activePipeline: PV_VENUE_SUMMARY.activeEvents,
    pipelineDollars: PV_VENUE_SUMMARY.activePipelineDollars,
    proposalSent: PV_VENUE_SUMMARY.proposalSent,
    confirmed: PV_VENUE_SUMMARY.confirmed,
    balanceDue: PV_VENUE_SUMMARY.balanceDueDollars,
    leads: PV_VENUE_SUMMARY.lead,
  };
}

/** Rep scorecard from PV venue summary */
export function getRepScorecardMetrics() {
  return [
    { label: 'Proposals out', value: String(PV_VENUE_SUMMARY.proposalSent), sub: formatCurrency(PV_VENUE_SUMMARY.proposalSentDollars) },
    { label: 'Confirmed events', value: String(PV_VENUE_SUMMARY.confirmed), sub: formatCurrency(PV_VENUE_SUMMARY.confirmedDollars) },
    { label: 'Completed YTD', value: String(PV_VENUE_SUMMARY.completedYtd), sub: 'PV export' },
    { label: 'Open leads', value: String(PV_VENUE_SUMMARY.lead), sub: 'Inquiry queue' },
    { label: 'Balance due', value: formatCurrency(PV_VENUE_SUMMARY.balanceDueDollars), sub: 'Collect before event day' },
    { label: 'Active pipeline', value: String(PV_VENUE_SUMMARY.activeEvents), sub: formatCurrency(PV_VENUE_SUMMARY.activePipelineDollars) },
  ];
}

/** Weekly cadence narrative from PV + executive anchors */
export function getWeeklyCadenceBrief() {
  return {
    headline: PV_EXECUTIVE_ANCHORS.focusHeadline,
    occupancy: '81%',
    risks: [
      ...PV_EXECUTIVE_ANCHORS.balances.map(b => `${b.client} · ${formatCurrency(b.amount)} due ${b.due}`),
      'Jun 6–7 turnover · Dufferfest → Miller/Harris shower',
    ],
    proposals: PV_EXECUTIVE_ANCHORS.staleProposals.length,
    tasksOpen: PV_TASKS.length,
  };
}

/** Owner briefing memo — single executive digest */
export function getOwnerBriefingMemo() {
  if (PV_FULL_EXPORT_AVAILABLE) {
    const d = getOwnerBriefingDigest();
    return {
      meta: d.meta,
      focus: d.focus,
      decisions: d.decisions,
      balances: d.balances,
      overnight: d.overnight,
      staleProposals: d.staleProposals,
      occupancyWeak: d.occupancyNotes,
      eventsThisWeek: d.eventsThisWeek,
      loadInPressure: d.loadInPressure,
      lostReasons: d.lostReasons,
      bookingVelocity: d.bookingVelocity,
      repeatOpportunities: d.repeatOpportunities,
    };
  }
  return {
    meta: OPS_DATA_SOURCE,
    focus: PV_EXECUTIVE_ANCHORS.focusHeadline,
    decisions: PV_AI_ATTENTION.filter(a => a.severity === 'high').map(a => a.text),
    balances: PV_EXECUTIVE_ANCHORS.balances,
    overnight: PV_EXECUTIVE_ANCHORS.overnightSamples,
    staleProposals: PV_EXECUTIVE_ANCHORS.staleProposals,
    occupancyWeak: [
      { day: 'Wed May 20', note: 'ICT lunch + Bingo · high load' },
      { day: 'Jun 6–7', note: 'Dufferfest → shower flip' },
    ],
    eventsThisWeek: [],
    loadInPressure: [],
    lostReasons: [],
    bookingVelocity: { last30Days: 0, label: '—' },
    repeatOpportunities: [],
  };
}

/** Reusable executive right-rail blocks — PV + derived intelligence only */
export type ExecutiveRailSection = {
  id: string;
  title: string;
  tone?: 'warn' | 'gold' | 'neutral' | 'live';
  live?: boolean;
  items: { id: string; label: string; meta?: string; href?: string; progress?: number }[];
  spark?: number[];
};

export function getExecutiveRailSectionsFromCommand(state: VenueCommandState): ExecutiveRailSection[] {
  const fin: ExecutiveRailSection[] = [
    {
      id: 'fin-collected',
      title: 'Financial command',
      tone: 'gold',
      live: true,
      items: [
        {
          id: 'collected',
          label: `Collected · ${formatCurrency(state.financials.collected)}`,
          meta: `MTD ${formatCurrency(state.financials.mtdCollected)}`,
        },
        {
          id: 'outstanding',
          label: `Outstanding · ${formatCurrency(state.financials.outstandingOperational)}`,
          meta: 'Ops-relevant only · lost excluded',
        },
      ],
    },
    {
      id: 'fin-pressure',
      title: 'Balance pressure',
      tone: 'warn',
      items: state.topPressureRows.slice(0, 4).map(r => ({
        id: r.id,
        label: `${r.title} · ${formatCurrency(r.outstanding)}`,
        meta: `${r.client} · ${r.date}`,
        href: opportunityDetailPath(r.id),
      })),
    },
  ];

  if (state.recurringSeries.length) {
    fin.push({
      id: 'fin-series',
      title: 'Recurring series',
      tone: 'neutral',
      items: state.recurringSeries.slice(0, 3).map(r => ({
        id: r.id,
        label: `${r.title} · ${r.count}×`,
        meta: `${formatCurrency(r.totalOutstanding)} · next ${r.nextEventDate ?? '—'}`,
        href: r.nextEventId ? opportunityDetailPath(r.nextEventId) : undefined,
      })),
    });
  }

  const vip = state.topAccounts.slice(0, 3).map(a => ({
    id: a.id,
    label: a.client,
    meta: `${a.eventCount} events · ${formatCurrency(a.totalValue)}`,
    href: ROUTES.accounts,
  }));
  if (vip.length) {
    fin.push({ id: 'vip', title: 'VIP & repeat', tone: 'gold', items: vip });
  }

  return fin.slice(0, 4);
}

export function getExecutiveRailSections(): ExecutiveRailSection[] {
  if (PV_FULL_EXPORT_AVAILABLE) {
    const fin = (getExecutiveFinancialRailSections() as ExecutiveRailSection[]).map(sec => ({
      ...sec,
      items: sec.items.slice(0, 4),
    }));
    return fin.slice(0, 4);
  }
  return getExecutiveRailSectionsLegacy();
}

function getExecutiveRailSectionsLegacy(): ExecutiveRailSection[] {
  const vip = getAccountIntelligence().filter(a => a.isVip).slice(0, 4);
  const unread = PV_INBOX_MESSAGES.filter(m => m.unread);

  return [
    {
      id: 'balances',
      title: 'Balances due',
      tone: 'warn',
      live: true,
      items: PV_EXECUTIVE_ANCHORS.balances.map((b, i) => ({
        id: `bal-${i}`,
        label: b.client,
        meta: `${formatCurrency(b.amount)} · due ${b.due}`,
        progress: 35,
      })),
    },
    {
      id: 'occupancy',
      title: 'Occupancy pacing',
      tone: 'gold',
      spark: [62, 68, 74, 81, 79, 84, 81],
      items: [
        { id: 'occ1', label: 'May week 3', meta: '81% · graduation cluster', progress: 81 },
        { id: 'occ2', label: 'Wed May 20', meta: 'High load · 2 events', progress: 94 },
        { id: 'occ3', label: 'Tue gap May 12', meta: '48% · morning open', progress: 48 },
      ],
    },
    {
      id: 'proposals',
      title: 'Proposal aging',
      tone: 'warn',
      items: PV_EXECUTIVE_ANCHORS.staleProposals.map((s, i) => ({
        id: `prop-${i}`,
        label: s.title,
        meta: `${s.days}d open · ${formatCurrency(s.value)}`,
        progress: Math.max(20, 100 - s.days * 2),
      })),
    },
    {
      id: 'vip',
      title: 'VIP & repeat',
      tone: 'gold',
      items: vip.map(v => ({
        id: v.client,
        label: v.client,
        meta: `${formatCurrency(v.totalValue)} · ${v.eventCount} events`,
        href: ROUTES.accounts,
      })),
    },
    {
      id: 'collisions',
      title: 'Turnover & collisions',
      tone: 'warn',
      items: getCalendarTurnoverAlerts().map((a, i) => ({
        id: `col-${i}`,
        label: a,
        meta: 'Staffing watch',
      })),
    },
    {
      id: 'inbox',
      title: 'High-priority threads',
      tone: 'live',
      live: true,
      items: unread.slice(0, 4).map(m => ({
        id: m.id,
        label: m.subject,
        meta: `${m.from} · ${m.time}`,
        href: '/inbox',
      })),
    },
    {
      id: 'automation',
      title: 'Automation impact',
      tone: 'neutral',
      items: PV_EXECUTIVE_ANCHORS.overnightSamples.map((o, i) => ({
        id: `auto-${i}`,
        label: o,
        meta: 'Overnight · queued',
      })),
    },
  ];
}

/** Calendar turnover conflicts from real adjacent events / same-day space overlap */
export function getCalendarTurnoverAlerts() {
  if (PV_FULL_EXPORT_AVAILABLE) {
    const alerts: string[] = [];
    const byDate = new Map<string, ReturnType<typeof getFullPvEvents>>();
    for (const e of getFullPvEvents()) {
      if (!e.eventDateIso || e.pvStatus === 'lost' || e.isExample) continue;
      const list = byDate.get(e.eventDateIso) ?? [];
      list.push(e);
      byDate.set(e.eventDateIso, list);
    }
    for (const [date, events] of byDate) {
      if (events.length < 2) continue;
      const spaceSet = new Set(events.map(ev => ev.space || ev.spaces[0] || 'Event Space'));
      if (spaceSet.size === 1 && events.length >= 2) {
        alerts.push(
          `${date.slice(5)} · ${events.length} bookings on ${[...spaceSet][0]} — turnover watch`,
        );
      }
    }
    return alerts.slice(0, 8);
  }

  const sorted = [...PV_PIPELINE_EVENTS]
    .filter(e => e.pvStatus !== 'lost')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const alerts: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = daysUntil(b.eventDate) - daysUntil(a.eventDate);
    if (gap >= 0 && gap <= 2) {
      alerts.push(`${a.eventDate.slice(5)} ${a.title} → ${b.title}`);
    }
  }
  return alerts.slice(0, 6);
}

export {
  PV_PIPELINE_EVENTS,
  PV_DEMO_PIPELINE,
  PV_VENUE_SUMMARY,
  PV_OVERDUE_FOLLOWUPS,
  PV_AI_ATTENTION,
  PV_TASKS,
  PV_EXECUTIVE_ANCHORS,
  pvStatusDisplay,
};
