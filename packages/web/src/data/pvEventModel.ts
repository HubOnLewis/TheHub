/**
 * Canonical interpretation of Perfect Venue full export — single source for UI intelligence.
 * No fabricated data; transforms only.
 */

import {
  FULL_PV_EVENTS,
  FULL_PV_PROPOSALS,
  FULL_PV_EVENT_FINANCIALS,
  FULL_PV_FINANCIAL_SNAPSHOT,
} from './perfectVenueFullExport.js';
import type { PvFullEvent } from './pvFullTypes.js';
import type { PvEventStatus } from './perfectVenueSeedCore.js';

const AS_OF = new Date('2026-05-20T12:00:00.000Z');
const MIN_MEANINGFUL_VALUE = 75;

export type PressureBucket =
  | 'immediate_attention'
  | 'revenue_at_risk'
  | 'operational_prep'
  | 'relationship_opportunity'
  | 'historical_completed'
  | 'excluded_low_signal';

export type CollectionStatus =
  | 'paid_in_full'
  | 'balance_due'
  | 'deposit_due'
  | 'partial'
  | 'no_proposal'
  | 'not_applicable';

export interface CanonicalEventFinancials {
  proposalTotal: number;
  collectedTotal: number;
  depositPaid: number;
  balancePaid: number;
  otherPaid: number;
  balanceDue: number;
  outstandingBalance: number;
  refundedAmount: number;
  netRevenue: number;
  isPaidInFull: boolean;
  hasDeposit: boolean;
  depositCoverageRatio: number;
  collectionStatus: CollectionStatus;
}

export interface CanonicalEventFlags {
  isActivePipeline: boolean;
  isConfirmedOperational: boolean;
  isCompleted: boolean;
  isLost: boolean;
  isOfficeRental: boolean;
  isTestOrExample: boolean;
  isFinanciallyRelevant: boolean;
  isOperationallyRelevant: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  isArchived: boolean;
}

export interface CanonicalEventView {
  event: PvFullEvent;
  financials: CanonicalEventFinancials;
  flags: CanonicalEventFlags;
  daysUntil: number;
  daysSinceContact: number;
  pressureBucket: PressureBucket;
  pressureScore: number;
}

export interface RecurringEventSeries {
  id: string;
  account: string;
  title: string;
  eventIds: string[];
  count: number;
  totalProposal: number;
  totalOutstanding: number;
  nextEventDate: string | null;
  nextEventId: string | null;
  pvStatus: PvEventStatus;
}

const viewsCacheHolder: { views: CanonicalEventView[] | null } = { views: null };

export function clearPvEventModelCache() {
  viewsCacheHolder.views = null;
}

export function daysUntil(iso: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.ceil((t - AS_OF.getTime()) / 86400000);
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.floor((AS_OF.getTime() - t) / 86400000);
}

function isOfficeRental(e: PvFullEvent): boolean {
  const t = `${e.title} ${e.eventType}`.toLowerCase();
  return (
    /office\s*rental|office rental|completed office/i.test(t) ||
    (e.pvStatus === 'completed' && e.proposalTotal === 0 && e.value < MIN_MEANINGFUL_VALUE)
  );
}

function isLostOrArchived(e: PvFullEvent): boolean {
  return e.pvStatus === 'lost' || /archived/i.test(e.statusRaw);
}

export function buildCanonicalFinancials(e: PvFullEvent): CanonicalEventFinancials {
  const prop = FULL_PV_PROPOSALS[e.id];
  const proposalTotal =
    e.proposalTotal > 0 ? e.proposalTotal : prop?.total > 0 ? prop.total : e.value;
  const collectedTotal = e.totalPaid > 0 ? e.totalPaid : e.depositPaid + e.balancePaid;
  const depositPaid = e.depositPaid;
  const balancePaid = e.balancePaid;
  const otherPaid = Math.max(0, collectedTotal - depositPaid - balancePaid);
  const importedFin = FULL_PV_EVENT_FINANCIALS[e.id];
  const refundedAmount = importedFin?.refundedAmount ?? importedFin?.refunded ?? 0;

  let outstandingBalance =
    importedFin?.outstandingBalance != null
      ? importedFin.outstandingBalance
      : e.balanceDue > 0
        ? e.balanceDue
        : Math.max(0, proposalTotal - collectedTotal);
  if (isLostOrArchived(e)) outstandingBalance = 0;

  const isPaidInFull = proposalTotal > 0 && collectedTotal >= proposalTotal - 1;
  const hasDeposit = depositPaid > 0;
  const depositCoverageRatio =
    proposalTotal > 0 ? Math.min(1, depositPaid / proposalTotal) : 0;

  let collectionStatus: CollectionStatus = 'not_applicable';
  if (proposalTotal <= 0 && collectedTotal <= 0) collectionStatus = 'no_proposal';
  else if (isPaidInFull) collectionStatus = 'paid_in_full';
  else if (outstandingBalance > 0) collectionStatus = 'balance_due';
  else if (e.pvStatus === 'proposal_sent' && !hasDeposit) collectionStatus = 'deposit_due';
  else if (collectedTotal > 0) collectionStatus = 'partial';

  return {
    proposalTotal,
    collectedTotal,
    depositPaid,
    balancePaid,
    otherPaid,
    balanceDue: e.balanceDue,
    outstandingBalance,
    refundedAmount,
    netRevenue: Math.max(0, collectedTotal - refundedAmount),
    isPaidInFull,
    hasDeposit,
    depositCoverageRatio,
    collectionStatus,
  };
}

export function buildCanonicalFlags(e: PvFullEvent, fin: CanonicalEventFinancials): CanonicalEventFlags {
  const du = daysUntil(e.eventDateIso);
  const isLost = isLostOrArchived(e);
  const isCompleted = e.pvStatus === 'completed';
  const isOffice = isOfficeRental(e);
  const isTestOrExample = e.isExample || e.isTest;
  const isUpcoming = du >= 0 && du < 120;
  const isPast = du < 0;

  const isActivePipeline =
    !isLost &&
    !isTestOrExample &&
    ['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due'].includes(e.pvStatus) &&
    (!isPast || e.pvStatus === 'proposal_sent' || e.pvStatus === 'qualified');

  const isConfirmedOperational =
    (e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due') && !isLost && !isPast;

  const isFinanciallyRelevant =
    !isLost &&
    !isTestOrExample &&
    !isOffice &&
    fin.proposalTotal >= MIN_MEANINGFUL_VALUE;

  const isOperationallyRelevant =
    isFinanciallyRelevant &&
    (isActivePipeline || (isCompleted && fin.netRevenue > 0)) &&
    !(isCompleted && isPast && fin.outstandingBalance === 0);

  return {
    isActivePipeline,
    isConfirmedOperational,
    isCompleted,
    isLost,
    isOfficeRental: isOffice,
    isTestOrExample,
    isFinanciallyRelevant,
    isOperationallyRelevant,
    isUpcoming,
    isPast,
    isArchived: isLost,
  };
}

function classifyPressure(
  e: PvFullEvent,
  fin: CanonicalEventFinancials,
  flags: CanonicalEventFlags,
): { bucket: PressureBucket; score: number } {
  if (flags.isTestOrExample || flags.isOfficeRental) {
    return { bucket: 'excluded_low_signal', score: 0 };
  }
  if (flags.isLost) return { bucket: 'excluded_low_signal', score: 0 };
  if (flags.isCompleted && flags.isPast) {
    return { bucket: 'historical_completed', score: 5 };
  }
  if (!flags.isFinanciallyRelevant) {
    return { bucket: 'excluded_low_signal', score: 0 };
  }

  const du = daysUntil(e.eventDateIso);
  const staleContact = daysSince(e.lastContacted) > 21 && e.pvStatus === 'proposal_sent';
  let score = 0;

  if (fin.outstandingBalance >= MIN_MEANINGFUL_VALUE && flags.isUpcoming && du <= 30) {
    score += 40 + Math.min(30, fin.outstandingBalance / 50);
  }
  if (e.pvStatus === 'proposal_sent' && !fin.hasDeposit && fin.proposalTotal >= MIN_MEANINGFUL_VALUE) {
    score += 35;
  }
  if (flags.isConfirmedOperational && du <= 14 && fin.outstandingBalance > 0) {
    score += 30;
  }
  if (staleContact) score += 20;
  if (du <= 7 && flags.isConfirmedOperational) score += 15;

  if (score >= 50 && fin.outstandingBalance >= 200 && du <= 21) {
    return { bucket: 'immediate_attention', score };
  }
  if (fin.outstandingBalance >= MIN_MEANINGFUL_VALUE && flags.isUpcoming) {
    return { bucket: 'revenue_at_risk', score };
  }
  if (flags.isConfirmedOperational && du <= 21) {
    return { bucket: 'operational_prep', score };
  }
  if (e.pvStatus === 'proposal_sent' || e.pvStatus === 'qualified') {
    return { bucket: 'relationship_opportunity', score: Math.max(score, 15) };
  }
  if (flags.isCompleted) return { bucket: 'historical_completed', score: 5 };
  return { bucket: 'excluded_low_signal', score: 0 };
}

export function getCanonicalEventViews(): CanonicalEventView[] {
  if (!viewsCacheHolder.views) {
    viewsCacheHolder.views = FULL_PV_EVENTS.map(event => {
      const financials = buildCanonicalFinancials(event);
      const flags = buildCanonicalFlags(event, financials);
      const { bucket, score } = classifyPressure(event, financials, flags);
      return {
        event,
        financials,
        flags,
        daysUntil: daysUntil(event.eventDateIso),
        daysSinceContact: daysSince(event.lastContacted),
        pressureBucket: bucket,
        pressureScore: score,
      };
    });
  }
  return viewsCacheHolder.views;
}

export function getActivePipelineViews(): CanonicalEventView[] {
  return getCanonicalEventViews().filter(v => v.flags.isActivePipeline && v.flags.isFinanciallyRelevant);
}

export function getOperationalPressureViews(): CanonicalEventView[] {
  return getCanonicalEventViews()
    .filter(
      v =>
        v.pressureBucket === 'immediate_attention' ||
        v.pressureBucket === 'revenue_at_risk' ||
        v.pressureBucket === 'operational_prep',
    )
    .sort((a, b) => b.pressureScore - a.pressureScore);
}

export function getVenueFinancialTotals() {
  const views = getCanonicalEventViews();
  const active = views.filter(v => v.flags.isOperationallyRelevant && v.flags.isUpcoming);
  const pipeline = views.filter(v => v.flags.isActivePipeline && v.flags.isFinanciallyRelevant);

  const outstandingExposure = active.reduce((s, v) => s + v.financials.outstandingBalance, 0);
  const collectedTotal = views
    .filter(v => !v.flags.isLost && v.financials.collectedTotal > 0)
    .reduce((s, v) => s + v.financials.collectedTotal, 0);

  const confirmedFuture = views.filter(
    v => v.flags.isConfirmedOperational && v.flags.isUpcoming,
  ).length;

  return {
    ...FULL_PV_FINANCIAL_SNAPSHOT,
    outstandingExposure: Math.round(outstandingExposure * 100) / 100,
    paymentsCollected: FULL_PV_FINANCIAL_SNAPSHOT.paymentsCollected,
    mtdCollected: FULL_PV_FINANCIAL_SNAPSHOT.mtdCollected,
    activePipelineCount: pipeline.length,
    confirmedFutureCount: confirmedFuture,
    proposalSentCount: views.filter(v => v.event.pvStatus === 'proposal_sent' && v.flags.isFinanciallyRelevant).length,
    lostCount: views.filter(v => v.flags.isLost).length,
    completedCount: views.filter(v => v.flags.isCompleted).length,
    excludedLowSignal: views.filter(v => v.pressureBucket === 'excluded_low_signal').length,
    pressureEligible: views.filter(v => v.pressureScore > 0).length,
  };
}

export function groupRecurringSeries(views: CanonicalEventView[]): RecurringEventSeries[] {
  const map = new Map<string, CanonicalEventView[]>();
  for (const v of views) {
    if (v.flags.isLost || v.flags.isTestOrExample) continue;
    const key = `${v.event.account}|${v.event.title.trim().toLowerCase()}`;
    const list = map.get(key) ?? [];
    list.push(v);
    map.set(key, list);
  }

  return [...map.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) =>
        (a.event.eventDateIso ?? '').localeCompare(b.event.eventDateIso ?? ''),
      );
      const upcoming = sorted.filter(v => v.flags.isUpcoming);
      const next = upcoming[0] ?? sorted[sorted.length - 1];
      return {
        id: `series-${key.slice(0, 40)}`,
        account: next.event.account,
        title: next.event.title,
        eventIds: list.map(v => v.event.id),
        count: list.length,
        totalProposal: list.reduce((s, v) => s + v.financials.proposalTotal, 0),
        totalOutstanding: list.reduce((s, v) => s + v.financials.outstandingBalance, 0),
        nextEventDate: next.event.eventDateIso,
        nextEventId: next.event.id,
        pvStatus: next.event.pvStatus,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function pickFlagshipEventId(): string {
  const candidates = getCanonicalEventViews().filter(
    v =>
      v.flags.isConfirmedOperational &&
      v.flags.isUpcoming &&
      v.financials.proposalTotal >= MIN_MEANINGFUL_VALUE &&
      FULL_PV_PROPOSALS[v.event.id]?.lines?.length,
  );
  const miller = candidates.find(v => v.event.title.includes('Miller/Harris'));
  if (miller) return miller.event.id;
  const best = [...candidates].sort((a, b) => {
    const aScore =
      (a.financials.hasDeposit ? 2 : 0) +
      (FULL_PV_PROPOSALS[a.event.id]?.lineCount ?? 0) +
      a.financials.depositCoverageRatio;
    const bScore =
      (b.financials.hasDeposit ? 2 : 0) +
      (FULL_PV_PROPOSALS[b.event.id]?.lineCount ?? 0) +
      b.financials.depositCoverageRatio;
    return bScore - aScore;
  })[0];
  return best?.event.id ?? FULL_PV_EVENTS.find(e => e.pvStatus === 'confirmed')?.id ?? '';
}

export function getDataQualityStats() {
  const views = getCanonicalEventViews();
  return {
    zeroDollar: views.filter(v => v.financials.proposalTotal < MIN_MEANINGFUL_VALUE && !v.flags.isOfficeRental).length,
    lostArchived: views.filter(v => v.flags.isLost).length,
    completed: views.filter(v => v.flags.isCompleted).length,
    activePipeline: views.filter(v => v.flags.isActivePipeline).length,
    confirmedFuture: views.filter(v => v.flags.isConfirmedOperational && v.flags.isUpcoming).length,
    excludedFromPressure: views.filter(v => v.pressureBucket === 'excluded_low_signal').length,
    missingTotals: views.filter(v => v.financials.proposalTotal === 0 && !v.flags.isOfficeRental).length,
    pressureEligible: views.filter(v => v.pressureScore >= 15).length,
  };
}
