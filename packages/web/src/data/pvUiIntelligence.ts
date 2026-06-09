/**
 * Memoized UI intelligence derived from Perfect Venue full export.
 * No synthetic entities — transforms and scoring only.
 */

import { formatCurrency } from '@hub-crm/shared';
import {
  FULL_PV_OPERATIONAL_INTELLIGENCE,
  FULL_PV_PROPOSALS,
  FULL_PV_FINANCIAL_SNAPSHOT,
  FULL_PV_ACCOUNT_FINANCIALS,
  FULL_PV_EVENT_FINANCIALS,
} from './perfectVenueFullExport.js';
import {
  getFullPvAccounts,
  getFullPvContacts,
  getFullPvEvents,
  getFullPvProposal,
  isFullPvExportAvailable,
  toPvSeedEvent,
} from './pvDataLayer.js';
import type { AccountIntelProfile, OpportunityIntelRow } from './operationalIntelligence.js';
import {
  PV_PIPELINE_EVENTS,
  PV_VENUE_SUMMARY,
  PV_OCCUPANCY_PCT,
  isFullPvExportAvailable as seedFullAvailable,
  pvStatusDisplay,
  type PvEventStatus,
  type PvSeedEvent,
} from './perfectVenueSeed.js';
import { opportunityDetailPath } from '../config/paths.js';
import {
  buildVenueCommandState,
  clearVenueCommandStateCache,
  commandStateToDashboardDigest,
} from './venueCommandState.js';
import { buildCanonicalFinancials, getOperationalPressureViews } from './pvEventModel.js';

const AS_OF = new Date('2026-05-20T12:00:00.000Z');
const MIN_MEANINGFUL_VALUE = 75;
const VISIBLE_ACCOUNT_CAP = 30;
const VISIBLE_OPPORTUNITY_CAP = 12;
const VISIBLE_LOST_CAP = 8;

export type AccountRelationshipStage =
  | 'vip_repeat'
  | 'active_client'
  | 'recent_inquiry'
  | 'at_risk'
  | 'dormant'
  | 'low_signal';

export type OpportunityBucket =
  | 'likely_to_close'
  | 'balance_risk'
  | 'event_approaching'
  | 'proposal_stale'
  | 'confirmed_prep'
  | 'pipeline'
  | 'lost_insight';

export interface EnhancedAccountProfile extends AccountIntelProfile {
  id: string;
  averageSpend: number;
  lastEventDate: string | null;
  nextEventDate: string | null;
  healthScore: number;
  relationshipStage: AccountRelationshipStage;
  expansionOpportunity?: string;
  primaryContactLabel: string;
  segmentTags: string[];
  lifetimeCollected: number;
  paymentReliability: 'strong' | 'mixed' | 'at_risk';
  revenueTier: 'platinum' | 'gold' | 'silver' | 'standard';
}

export interface EnhancedOpportunityRow extends OpportunityIntelRow {
  bucket: OpportunityBucket;
  owner: string;
  lastContacted: string | null;
  daysOut: number | null;
  readiness: number;
  paymentRisk: 'low' | 'medium' | 'high';
  valueAtRisk: number;
  spaceLabel: string;
  proposalTotal: number;
  depositPaid: number;
  groupSize: number;
  collected: number;
  paymentConfidence: number;
}

export interface AccountIntelSections {
  vipRepeat: EnhancedAccountProfile[];
  upcoming: EnhancedAccountProfile[];
  balanceRisk: EnhancedAccountProfile[];
  dormantValuable: EnhancedAccountProfile[];
  recent: EnhancedAccountProfile[];
  all: EnhancedAccountProfile[];
}

export interface OpportunityIntelSections {
  likelyToClose: EnhancedOpportunityRow[];
  balanceRisk: EnhancedOpportunityRow[];
  eventApproaching: EnhancedOpportunityRow[];
  proposalStale: EnhancedOpportunityRow[];
  confirmedPrep: EnhancedOpportunityRow[];
  pipeline: EnhancedOpportunityRow[];
  lostInsight: EnhancedOpportunityRow[];
}

export interface DashboardDigest {
  activeEvents: number;
  confirmed: number;
  proposalSent: number;
  leads: number;
  qualified: number;
  lost: number;
  completed: number;
  outstandingBalance: number;
  pipelineDollars: number;
  occupancyPct: number;
  collectedTotal: number;
  mtdCollected: number;
  conversionRatePct: number;
  avgBookingValue: number;
  proposalExposure: number;
  upcomingEvents: Array<{ id: string; title: string; client: string; date: string; status: string; balance: number }>;
  topAccounts: EnhancedAccountProfile[];
  staleProposals: Array<{ title: string; days: number; value: number }>;
  followUpPressure: number;
  attentionItems: Array<{ id: string; text: string; severity: 'high' | 'medium' | 'low' }>;
}

export interface OwnerBriefingDigest {
  meta: string;
  focus: string;
  decisions: string[];
  balances: Array<{ client: string; event: string; amount: number; due: string }>;
  overnight: string[];
  staleProposals: Array<{ title: string; days: number; value: number }>;
  eventsThisWeek: Array<{ id: string; title: string; date: string; guests: number; status: string }>;
  loadInPressure: string[];
  lostReasons: Array<{ reason: string; count: number }>;
  bookingVelocity: { last30Days: number; label: string };
  repeatOpportunities: Array<{ name: string; events: number; spend: number; note: string }>;
  occupancyNotes: Array<{ day: string; note: string }>;
}

export interface CalendarMonthDigest {
  year: number;
  monthIndex: number;
  label: string;
  occupancyPct: number;
  bookedDays: number;
  daysInMonth: number;
  totalEvents: number;
  confirmedCount: number;
  proposalCount: number;
  busiestDays: Array<{ day: number; count: number; label: string }>;
  underusedDays: Array<{ day: number; note: string }>;
  highStressDays: Array<{ day: number; note: string }>;
  turnoverAlerts: string[];
  eventTypeMix: Array<{ type: string; count: number }>;
  highestRevenueEvent: { title: string; date: string; value: number; guests: number } | null;
  weekLoadStrip: Array<{ id: string; label: string; sub: string; stress: 'normal' | 'elevated' | 'high' }>;
}

let accountCache: EnhancedAccountProfile[] | null = null;
let opportunityCache: EnhancedOpportunityRow[] | null = null;
let dashboardCache: DashboardDigest | null = null;
let ownerCache: OwnerBriefingDigest | null = null;
const calendarCache = new Map<string, CalendarMonthDigest>();

export function clearPvUiIntelCache() {
  accountCache = null;
  opportunityCache = null;
  dashboardCache = null;
  ownerCache = null;
  calendarCache.clear();
  clearVenueCommandStateCache();
}

void FULL_PV_EVENT_FINANCIALS;

function daysUntil(iso: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.ceil((t - AS_OF.getTime()) / 86400000);
}

function assessEventIntel(e: PvSeedEvent) {
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
    coordinator: e.client,
    aiLine:
      e.balanceDue > 0
        ? `Balance ${formatCurrency(e.balanceDue)} outstanding`
        : e.pvStatus === 'proposal_sent'
          ? 'Likely to close — deposit path open'
          : 'On track',
  };
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.floor((AS_OF.getTime() - t) / 86400000);
}

function proposalAgeDays(createdOn: string | null): number {
  if (!createdOn) return 0;
  return daysSince(createdOn);
}

function healthScoreFor(
  eventCount: number,
  totalSpend: number,
  balance: number,
  dormant: boolean,
  hasUpcoming: boolean,
): number {
  let s = 45;
  if (eventCount >= 3) s += 28;
  else if (eventCount >= 2) s += 18;
  if (totalSpend >= 2000) s += 12;
  else if (totalSpend >= 600) s += 6;
  if (hasUpcoming) s += 14;
  if (balance > 0) s -= Math.min(30, Math.round(balance / 50));
  if (dormant) s -= 18;
  return Math.max(5, Math.min(98, s));
}

function relationshipStageFor(
  eventCount: number,
  totalSpend: number,
  balance: number,
  dormant: boolean,
  hasUpcoming: boolean,
  isVip: boolean,
): AccountRelationshipStage {
  if (eventCount >= 3 || (isVip && eventCount >= 2)) return 'vip_repeat';
  if (totalSpend < MIN_MEANINGFUL_VALUE && eventCount <= 1) return 'low_signal';
  if (balance >= MIN_MEANINGFUL_VALUE) return 'at_risk';
  if (dormant && totalSpend >= 300) return 'dormant';
  if (dormant) return 'low_signal';
  if (eventCount === 1 && !hasUpcoming) return 'recent_inquiry';
  if (hasUpcoming || eventCount >= 2) return 'active_client';
  return 'dormant';
}

function buildEnhancedAccounts(): EnhancedAccountProfile[] {
  if (!isFullPvExportAvailable) {
    return [];
  }

  const eventById = new Map(getFullPvEvents().map(e => [e.id, e]));
  const contactByAccount = new Map<string, string>();
  for (const c of getFullPvContacts()) {
    if (c.account && !contactByAccount.has(c.account)) {
      contactByAccount.set(c.account, c.displayName);
    }
  }

  const finByAcct = new Map(FULL_PV_ACCOUNT_FINANCIALS.map(f => [f.accountId, f]));

  return getFullPvAccounts()
    .filter(a => a.eventCount > 0)
    .map(a => {
      const fin = finByAcct.get(a.id);
      const events = a.eventIds
        .map(id => eventById.get(id))
        .filter((e): e is NonNullable<typeof e> => !!e && !e.isExample);
      const dated = events.filter(e => e.eventDateIso);
      const upcoming = dated
        .filter(e => daysUntil(e.eventDateIso) >= 0 && e.pvStatus !== 'lost')
        .sort((x, y) => (x.eventDateIso ?? '').localeCompare(y.eventDateIso ?? ''))[0];
      const past = dated
        .filter(e => daysUntil(e.eventDateIso) < 0)
        .sort((x, y) => (y.eventDateIso ?? '').localeCompare(x.eventDateIso ?? ''))[0];
      const last = past ?? events[events.length - 1];
      const totalValue = events.reduce((s, e) => s + (e.proposalTotal || e.value), 0);
      const balanceOutstanding = events
        .filter(e => e.pvStatus !== 'lost' && !/archived/i.test(e.statusRaw))
        .reduce((s, e) => s + buildCanonicalFinancials(e).outstandingBalance, 0);
      const hasUpcoming = !!upcoming;
      const stage = relationshipStageFor(
        a.eventCount,
        a.totalSpend || totalValue,
        balanceOutstanding,
        a.isDormant,
        hasUpcoming,
        a.isVip,
      );
      const health = healthScoreFor(a.eventCount, a.totalSpend || totalValue, balanceOutstanding, a.isDormant, hasUpcoming);

      const tags: string[] = [];
      if (stage === 'vip_repeat') tags.push('VIP · repeat');
      if (stage === 'active_client') tags.push('Active client');
      if (stage === 'recent_inquiry') tags.push('Recent inquiry');
      if (stage === 'low_signal') tags.push('Low signal');
      if (balanceOutstanding > 0) tags.push('Balance risk');
      if (hasUpcoming) tags.push('Upcoming booking');
      if (a.isDormant && (a.totalSpend > 300 || a.eventCount >= 2)) tags.push('Dormant · valuable');

      let expansion = a.expansionNote;
      if (stage === 'vip_repeat' && !hasUpcoming) {
        expansion = `${a.eventCount} lifetime events — schedule next season hold`;
      } else if (stage === 'dormant' && a.eventCount >= 2) {
        expansion = 'Re-engagement window · repeat history on file';
      }

      const lifetimeCollected = fin?.lifetimeCollected ?? events.reduce((s, e) => s + e.depositPaid + e.balancePaid, 0);
      const paymentReliability: EnhancedAccountProfile['paymentReliability'] =
        balanceOutstanding > 500 ? 'at_risk' : lifetimeCollected > 0 ? 'strong' : 'mixed';
      const revenueTier: EnhancedAccountProfile['revenueTier'] =
        lifetimeCollected >= 3000 || a.eventCount >= 8
          ? 'platinum'
          : lifetimeCollected >= 1500 || a.eventCount >= 4
            ? 'gold'
            : lifetimeCollected >= 600
              ? 'silver'
              : 'standard';

      return {
        id: a.id,
        client: a.name,
        eventCount: a.eventCount,
        totalValue: a.totalSpend || totalValue,
        totalCollected: lifetimeCollected,
        balanceOutstanding,
        upcomingEvent: upcoming ? `${upcoming.title} · ${upcoming.eventDateIso}` : undefined,
        lastEventType: last?.eventType ?? '—',
        isVip: a.isVip || a.eventCount >= 3,
        isDormant: a.isDormant,
        expansionNote: expansion,
        coordinator: upcoming?.owner ?? last?.owner ?? 'Coordinator',
        eventIds: a.eventIds,
        averageSpend: a.eventCount > 0 ? Math.round((a.totalSpend || totalValue) / a.eventCount) : 0,
        lastEventDate: last?.eventDateIso ?? null,
        nextEventDate: upcoming?.eventDateIso ?? null,
        healthScore: health,
        relationshipStage: stage,
        expansionOpportunity: expansion,
        primaryContactLabel: contactByAccount.get(a.name) ?? a.name,
        segmentTags: tags,
        lifetimeCollected,
        paymentReliability,
        revenueTier,
      };
    })
    .sort((x, y) => y.healthScore - x.healthScore || y.totalValue - x.totalValue);
}

export function getEnhancedAccountIntelligence(): EnhancedAccountProfile[] {
  if (!accountCache) {
    accountCache = isFullPvExportAvailable
      ? buildEnhancedAccounts()
      : [];
  }
  return accountCache;
}

export function getAccountIntelSections(): AccountIntelSections {
  const all = getEnhancedAccountIntelligence();
  const cap = (list: EnhancedAccountProfile[]) => list.slice(0, VISIBLE_ACCOUNT_CAP);

  return {
    vipRepeat: cap(all.filter(a => a.relationshipStage === 'vip_repeat').sort((a, b) => b.eventCount - a.eventCount)),
    upcoming: cap(all.filter(a => a.nextEventDate).sort((a, b) => (a.nextEventDate ?? '').localeCompare(b.nextEventDate ?? ''))),
    balanceRisk: cap(all.filter(a => a.balanceOutstanding > 0).sort((a, b) => b.balanceOutstanding - a.balanceOutstanding)),
    dormantValuable: cap(
      all.filter(a => a.isDormant && (a.totalValue >= 300 || a.eventCount >= 2)),
    ),
    recent: cap(
      all.filter(a => a.lastEventDate && daysSince(a.lastEventDate) <= 120).sort((a, b) => (b.lastEventDate ?? '').localeCompare(a.lastEventDate ?? '')),
    ),
    all,
  };
}

function classifyOpportunityBucket(
  e: ReturnType<typeof getFullPvEvents>[0],
  ageDays: number,
): OpportunityBucket {
  if (e.pvStatus === 'lost' || /archived/i.test(e.statusRaw)) return 'lost_insight';
  const fin = buildCanonicalFinancials(e);
  if (fin.proposalTotal < MIN_MEANINGFUL_VALUE) return 'pipeline';
  const dOut = e.daysOut ?? daysUntil(e.eventDateIso);
  if (fin.outstandingBalance > 0 && dOut >= 0 && dOut <= 30) return 'balance_risk';
  if (e.pvStatus === 'proposal_sent' && ageDays >= 14) return 'proposal_stale';
  if (e.pvStatus === 'proposal_sent' && !fin.hasDeposit && ageDays < 21) return 'likely_to_close';
  if ((e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due') && dOut >= 0 && dOut <= 21) {
    return fin.outstandingBalance > 0 ? 'balance_risk' : 'confirmed_prep';
  }
  if (dOut >= 0 && dOut <= 14 && e.pvStatus !== 'lead' && e.pvStatus !== 'completed') {
    return 'event_approaching';
  }
  return 'pipeline';
}

function buildEnhancedOpportunities(): EnhancedOpportunityRow[] {
  const source = isFullPvExportAvailable
    ? getFullPvEvents().filter(e => !e.isExample)
    : null;

  const events: Array<{ seed: PvSeedEvent; raw?: ReturnType<typeof getFullPvEvents>[0] }> = source
    ? source
        .filter(e => ['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due', 'lost'].includes(e.pvStatus))
        .map(raw => ({ seed: toPvSeedEvent(raw), raw }))
    : PV_PIPELINE_EVENTS.map(seed => ({ seed }));

  return events.map(({ seed, raw }) => {
    const intel = assessEventIntel(seed);
    const prop = raw ? getFullPvProposal(raw.id) : undefined;
    const ageDays = raw ? proposalAgeDays(raw.createdOn) : 0;
    const bucket = raw ? classifyOpportunityBucket(raw, ageDays) : 'pipeline';
    const dOut = raw?.daysOut ?? daysUntil(seed.eventDate);
    const fin = raw ? buildCanonicalFinancials(raw) : null;
    let paymentRisk: EnhancedOpportunityRow['paymentRisk'] = 'low';
    if (fin && fin.outstandingBalance > 0 && dOut < 21) paymentRisk = 'high';
    else if (
      (fin && fin.outstandingBalance > 0) ||
      (seed.pvStatus === 'proposal_sent' && seed.depositPaid === 0 && (fin?.proposalTotal ?? seed.value) >= MIN_MEANINGFUL_VALUE)
    ) {
      paymentRisk = 'medium';
    }

    return {
      event: seed,
      intel,
      link: opportunityDetailPath(seed.id),
      bucket,
      owner: raw?.owner ?? '—',
      lastContacted: raw?.lastContacted ?? null,
      daysOut: dOut,
      readiness: raw?.readinessScore ?? intel.closeScore,
      paymentRisk,
      valueAtRisk:
        fin && fin.outstandingBalance > 0
          ? fin.outstandingBalance
          : seed.pvStatus === 'proposal_sent'
            ? fin?.proposalTotal ?? seed.value
            : 0,
      spaceLabel: raw?.spaces?.[0] ?? raw?.space ?? seed.spaces[0] ?? 'Event Space',
      proposalTotal: raw?.proposalTotal ?? prop?.total ?? seed.value,
      depositPaid: seed.depositPaid,
      groupSize: seed.guests,
      collected: raw
        ? (FULL_PV_EVENT_FINANCIALS[raw.id]?.collectedTotal ??
          FULL_PV_EVENT_FINANCIALS[raw.id]?.collected ??
          fin?.collectedTotal ??
          seed.depositPaid)
        : seed.depositPaid,
      paymentConfidence: raw?.readinessScore ?? intel.closeScore,
    };
  });
}

export function getEnhancedOpportunityIntelligence(): EnhancedOpportunityRow[] {
  if (!opportunityCache) opportunityCache = buildEnhancedOpportunities();
  return opportunityCache;
}

export function getOpportunityIntelSections(): OpportunityIntelSections {
  const all = getEnhancedOpportunityIntelligence();
  const cap = (list: EnhancedOpportunityRow[]) => list.slice(0, VISIBLE_OPPORTUNITY_CAP);
  const active = all.filter(o => o.bucket !== 'lost_insight');

  return {
    likelyToClose: cap(active.filter(o => o.bucket === 'likely_to_close')),
    balanceRisk: cap(active.filter(o => o.bucket === 'balance_risk').sort((a, b) => b.valueAtRisk - a.valueAtRisk)),
    eventApproaching: cap(
      active
        .filter(o => o.bucket === 'event_approaching')
        .sort((a, b) => (a.daysOut ?? 99) - (b.daysOut ?? 99)),
    ),
    proposalStale: cap(active.filter(o => o.bucket === 'proposal_stale')),
    confirmedPrep: cap(
      active
        .filter(o => o.bucket === 'confirmed_prep')
        .sort((a, b) => (a.daysOut ?? 99) - (b.daysOut ?? 99)),
    ),
    pipeline: cap(active.filter(o => o.bucket === 'pipeline')),
    lostInsight: cap(
      all
        .filter(o => o.bucket === 'lost_insight')
        .slice(0, VISIBLE_LOST_CAP),
    ),
  };
}

/** @deprecated Prefer useVenueCommandState() on dashboard surfaces */
export function getDashboardDigest(pendingApprovals = 0): DashboardDigest {
  return commandStateToDashboardDigest(buildVenueCommandState({ pendingApprovals }));
}

export function getOwnerBriefingDigest(): OwnerBriefingDigest {
  if (!ownerCache) {
    const events = isFullPvExportAvailable ? getFullPvEvents().filter(e => !e.isExample) : [];
    const weekEnd = new Date(AS_OF);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);

    const eventsThisWeek = events
      .filter(
        e =>
          e.eventDateIso &&
          e.eventDateIso >= '2026-05-20' &&
          e.eventDateIso <= weekEndIso &&
          e.pvStatus !== 'lost',
      )
      .map(e => ({
        id: e.id,
        title: e.title,
        date: e.eventDateIso!,
        guests: e.guests,
        status: pvStatusDisplay(e.pvStatus),
      }));

    const balances = getOperationalPressureViews()
      .filter(v => v.financials.outstandingBalance >= MIN_MEANINGFUL_VALUE)
      .slice(0, 8)
      .map(v => ({
        client: v.event.client,
        event: `${v.event.title} · ${v.event.eventDateIso ?? 'TBD'}`,
        amount: v.financials.outstandingBalance,
        due: v.event.eventDateIso ?? 'Before event',
      }));

    const stale = getEnhancedOpportunityIntelligence()
      .filter(o => o.bucket === 'proposal_stale')
      .map(o => ({
        title: `${o.event.title} · ${o.event.client}`,
        days: proposalAgeDays(
          events.find(e => e.id === o.event.id)?.createdOn ?? null,
        ),
        value: o.proposalTotal,
      }))
      .slice(0, 8);

    const loadIn = events
      .filter(
        e =>
          (e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due') &&
          e.daysOut != null &&
          e.daysOut >= 0 &&
          e.daysOut <= 14,
      )
      .sort((a, b) => (a.daysOut ?? 99) - (b.daysOut ?? 99))
      .slice(0, 6)
      .map(e => `${e.title} · ${e.daysOut}d out · ${e.guests} guests`);

    const lostMap = new Map<string, number>();
    for (const e of events.filter(e => e.pvStatus === 'lost' && e.lostReason)) {
      const r = e.lostReason.trim() || 'Unspecified';
      lostMap.set(r, (lostMap.get(r) ?? 0) + 1);
    }
    const lostReasons = [...lostMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    const last30 = events.filter(
      e =>
        e.confirmedOn &&
        daysSince(e.confirmedOn) <= 30 &&
        (e.pvStatus === 'confirmed' || e.pvStatus === 'completed'),
    ).length;

    const repeatOpportunities = getAccountIntelSections()
      .vipRepeat.filter(a => !a.nextEventDate && a.eventCount >= 3)
      .slice(0, 5)
      .map(a => ({
        name: a.client,
        events: a.eventCount,
        spend: a.totalValue,
        note: a.expansionOpportunity ?? 'Repeat VIP — no future hold',
      }));

    const calMay = getCalendarMonthDigest(2026, 4);
    const decisions: string[] = [];
    if (balances[0]) {
      decisions.push(
        `Collect ${formatCurrency(balances[0].amount)} — ${balances[0].client} (${balances[0].event})`,
      );
    }
    if (stale[0]) {
      decisions.push(`Revive stale proposal: ${stale[0].title} (${stale[0].days}d open)`);
    }
    if (loadIn[0]) decisions.push(`Protect load-in: ${loadIn[0]}`);
    const turnover = calMay.turnoverAlerts[0];
    if (turnover && decisions.length < 3) decisions.push(`Calendar: ${turnover}`);

    const focusParts = [
      `${eventsThisWeek.length} events this week`,
      `${balances.length} open balances`,
      calMay.highStressDays[0] ? `Peak day May ${calMay.highStressDays[0].day}` : null,
    ].filter(Boolean);

    ownerCache = {
      meta: seedFullAvailable
        ? `Perfect Venue XLSX · ${FULL_PV_OPERATIONAL_INTELLIGENCE.venueSummary.extractedAt}`
        : 'Perfect Venue import',
      focus: focusParts.join(' · ') || 'Pipeline steady — review balances and June load-in',
      decisions: decisions.slice(0, 3),
      balances,
      overnight: balances.slice(0, 4).map(b => `${b.client}: ${formatCurrency(b.amount)} due ${b.due}`),
      staleProposals: stale,
      eventsThisWeek,
      loadInPressure: loadIn,
      lostReasons,
      bookingVelocity: { last30Days: last30, label: `${last30} confirmations in last 30 days` },
      repeatOpportunities,
      occupancyNotes: calMay.highStressDays.map(d => ({
        day: `May ${d.day}`,
        note: d.note,
      })),
    };
  }
  return ownerCache;
}

export function getCalendarMonthDigest(year: number, monthIndex: number): CalendarMonthDigest {
  const key = `${year}-${monthIndex}`;
  const cached = calendarCache.get(key);
  if (cached) return cached;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const byDay = new Map<number, ReturnType<typeof getFullPvEvents>>();

  if (isFullPvExportAvailable) {
    for (const e of getFullPvEvents()) {
      if (!e.eventDateIso?.startsWith(prefix) || e.isExample || e.pvStatus === 'lost') continue;
      const day = parseInt(e.eventDateIso.slice(8, 10), 10);
      const list = byDay.get(day) ?? [];
      list.push(e);
      byDay.set(day, list);
    }
  }

  const busiest = [...byDay.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([day, evs]) => ({
      day,
      count: evs.length,
      label: evs.map(e => e.title).slice(0, 2).join(', '),
    }));

  const underused: Array<{ day: number; note: string }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (!byDay.has(d) && d % 7 !== 0) underused.push({ day: d, note: 'No bookings · outreach window' });
  }

  const highStress = [...byDay.entries()]
    .filter(([, evs]) => evs.length >= 2)
    .map(([day, evs]) => ({
      day,
      note: `${evs.length} events · ${evs.map(e => e.eventType).join(' / ')}`,
    }));

  const typeMix = new Map<string, number>();
  for (const evs of byDay.values()) {
    for (const e of evs) {
      const t = e.eventType || 'Event';
      typeMix.set(t, (typeMix.get(t) ?? 0) + 1);
    }
  }

  let topRev: CalendarMonthDigest['highestRevenueEvent'] = null;
  for (const evs of byDay.values()) {
    for (const e of evs) {
      const v = e.proposalTotal || e.value;
      if (!topRev || v > topRev.value) {
        topRev = {
          title: e.title,
          date: e.eventDateIso ?? '',
          value: v,
          guests: e.guests,
        };
      }
    }
  }

  const bookedDays = byDay.size;
  const totalEvents = [...byDay.values()].reduce((s, evs) => s + evs.length, 0);
  const confirmedCount = [...byDay.values()].flat().filter(e => e.pvStatus === 'confirmed').length;
  const proposalCount = [...byDay.values()].flat().filter(e => e.pvStatus === 'proposal_sent').length;

  const turnoverAlerts: string[] = [];
  for (const [date, evs] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    if (evs.length >= 2) {
      turnoverAlerts.push(
        `${prefix.slice(5)}-${String(date).padStart(2, '0')} · ${evs.length} bookings — turnover watch`,
      );
    }
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekLoadStrip: CalendarMonthDigest['weekLoadStrip'] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(2026, 4, 20 + i);
    const dayNum = d.getDate();
    const evs = byDay.get(dayNum) ?? [];
    weekLoadStrip.push({
      id: `w-${i}`,
      label: weekDays[d.getDay()],
      sub: evs.length ? `${evs.length} event${evs.length > 1 ? 's' : ''}` : 'Open',
      stress: evs.length >= 2 ? 'high' : evs.length === 1 ? 'elevated' : 'normal',
    });
  }

  const digest: CalendarMonthDigest = {
    year,
    monthIndex,
    label: new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    occupancyPct: Math.round((bookedDays / daysInMonth) * 100) || PV_OCCUPANCY_PCT,
    bookedDays,
    daysInMonth,
    totalEvents,
    confirmedCount,
    proposalCount,
    busiestDays: busiest,
    underusedDays: underused.slice(0, 6),
    highStressDays: highStress,
    turnoverAlerts: turnoverAlerts.slice(0, 8),
    eventTypeMix: [...typeMix.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count })),
    highestRevenueEvent: topRev,
    weekLoadStrip,
  };

  calendarCache.set(key, digest);
  return digest;
}

export { VISIBLE_ACCOUNT_CAP, VISIBLE_OPPORTUNITY_CAP };
