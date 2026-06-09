/**
 * Venue Command State — SINGLE source of truth for dashboard operational KPIs.
 *
 * KPI CONSTITUTION (do not duplicate formulas elsewhere):
 *
 * OCCUPANCY (operational)
 *   Distinct calendar days in the reference month with ≥1 financially-relevant event
 *   (confirmed | balance_due | completed on that date), excluding lost/archived/test/office.
 *   Formula: round(bookedDays / daysInMonth * 100), cap 0–100.
 *   confirmed: same month, only confirmed | balance_due future from AS_OF.
 *   projected: adds proposal_sent days not already counted.
 *
 * FINANCIALS
 *   collected: FULL_PV_FINANCIAL_SNAPSHOT.paymentsCollected (payment ledger).
 *   outstandingOperational: sum outstandingBalance on operationally-relevant upcoming views.
 *   outstandingRaw: import meta eventOutstandingRaw when present.
 *   proposalValue: sum proposalTotal on active pipeline (financially relevant).
 *
 * PRESSURE
 *   totalSignals: events with pressureScore ≥ 15 (eligible for ops attention).
 *   critical: bucket immediate_attention.
 *   revenueAtRisk / operationalPrep / relationship: matching pressure buckets.
 *   displayScore: 0–100 average of top-20 pressure scores (for compact UI meters).
 *   Excludes: lost, archived, office, test, <$75, completed past with $0 due.
 *
 * READINESS
 *   Average over confirmed+balance_due upcoming: deposit coverage 35%, balance cleared 35%,
 *   timeline window 30% (closer events lower until inside 21d prep window).
 *
 * AI OUTLOOK
 *   100 − pressure density − outstanding exposure penalty − pending approval penalty.
 *   Clamped 55–94. Explainable factor strings returned.
 */

import { formatCurrency } from '@hub-crm/shared';
import { isFullPvExportAvailable, getFullPvAccounts } from './pvDataLayer.js';
import {
  getActivePipelineViews,
  getCanonicalEventViews,
  getOperationalPressureViews,
  getVenueFinancialTotals,
  groupRecurringSeries,
  daysUntil,
  type CanonicalEventView,
  type PressureBucket,
} from './pvEventModel.js';
import { PV_VENUE_SUMMARY, pvStatusDisplay } from './perfectVenueSeed.js';
import { PV_FULL_IMPORT_META } from './perfectVenueFullExport.js';
import { opportunityDetailPath } from '../config/paths.js';

const AS_OF = new Date('2026-05-20T12:00:00.000Z');
const AS_OF_ISO = '2026-05-20';
const REF_YEAR = 2026;
const REF_MONTH_INDEX = 4; // May
const MIN_PRESSURE_SCORE = 15;

export interface VenueCommandExternal {
  pendingApprovals: number;
}

export interface KpiDiagnostic {
  metric: string;
  value: string;
  source: string;
  formula: string;
}

export interface VenueCommandState {
  asOf: string;
  occupancy: {
    operational: number;
    confirmed: number;
    projected: number;
    bookedDays: number;
    daysInMonth: number;
  };
  financials: {
    collected: number;
    outstandingOperational: number;
    outstandingRaw: number;
    proposalValue: number;
    mtdCollected: number;
    proposalExposure: number;
  };
  pressure: {
    totalSignals: number;
    critical: number;
    revenueAtRisk: number;
    operationalPrep: number;
    relationship: number;
    staleProposals: number;
    displayScore: number;
  };
  approvals: {
    pending: number;
  };
  operationalReadiness: {
    score: number;
    factors: string[];
  };
  aiOutlook: {
    score: number;
    explanation: string[];
  };
  pipeline: {
    activeProposals: number;
    confirmedUpcoming: number;
    activePipelineCount: number;
    atRiskRevenue: number;
    leads: number;
    qualified: number;
    lostExcluded: number;
    completed: number;
  };
  attentionItems: Array<{ id: string; text: string; severity: 'high' | 'medium' | 'low' }>;
  topPressureRows: Array<{
    id: string;
    title: string;
    client: string;
    status: string;
    date: string;
    daysOut: number;
    outstanding: number;
    proposalTotal: number;
    collected: number;
    pressureBucket: PressureBucket;
    pressureScore: number;
  }>;
  staleProposals: Array<{ title: string; days: number; value: number }>;
  topAccounts: Array<{ id: string; client: string; eventCount: number; totalValue: number }>;
  recurringSeries: ReturnType<typeof groupRecurringSeries>;
  diagnostics: KpiDiagnostic[];
}

let stateCache: VenueCommandState | null = null;
let cacheKey = '';

function monthOccupancy(views: CanonicalEventView[]) {
  const daysInMonth = new Date(REF_YEAR, REF_MONTH_INDEX + 1, 0).getDate();
  const operationalDays = new Set<number>();
  const confirmedDays = new Set<number>();
  const projectedDays = new Set<number>();

  for (const v of views) {
    if (!v.event.eventDateIso?.startsWith(`${REF_YEAR}-05`)) continue;
    if (v.flags.isLost || v.flags.isTestOrExample || v.flags.isOfficeRental) continue;
    const day = Number(v.event.eventDateIso.slice(8, 10));
    if (Number.isNaN(day)) continue;

    const isConfirmed =
      v.event.pvStatus === 'confirmed' || v.event.pvStatus === 'balance_due';
    const isCompleted = v.event.pvStatus === 'completed';
    const isProposal = v.event.pvStatus === 'proposal_sent';

    if (v.flags.isFinanciallyRelevant && (isConfirmed || isCompleted || isProposal)) {
      operationalDays.add(day);
    }
    if (isConfirmed && v.flags.isUpcoming) confirmedDays.add(day);
    if (isProposal) projectedDays.add(day);
    if (isConfirmed) projectedDays.add(day);
  }

  const pct = (days: Set<number>) =>
    Math.min(100, Math.max(0, Math.round((days.size / daysInMonth) * 100)));

  return {
    operational: pct(operationalDays),
    confirmed: pct(confirmedDays),
    projected: pct(projectedDays),
    bookedDays: operationalDays.size,
    daysInMonth,
  };
}

function computeReadiness(views: CanonicalEventView[]): { score: number; factors: string[] } {
  const confirmed = views.filter(v => v.flags.isConfirmedOperational);
  if (!confirmed.length) {
    return { score: 70, factors: ['No confirmed upcoming events in export window'] };
  }

  const scores = confirmed.map(v => {
    const dep = v.financials.depositCoverageRatio * 100;
    const bal = v.financials.outstandingBalance > 0 ? 45 : 100;
    const prox = v.daysUntil;
    const time = prox <= 7 ? 35 : prox <= 21 ? 65 : prox <= 45 ? 85 : 95;
    return dep * 0.35 + bal * 0.35 + time * 0.3;
  });

  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const thinDeposit = confirmed.filter(v => !v.financials.hasDeposit).length;
  const factors: string[] = [
    `${confirmed.length} confirmed upcoming events`,
    thinDeposit > 0 ? `${thinDeposit} missing deposit` : 'Deposits on track',
  ];
  return { score, factors };
}

function computeAiOutlook(
  pressureTotal: number,
  outstanding: number,
  pendingApprovals: number,
  readiness: number,
): { score: number; explanation: string[] } {
  let score = 100;
  score -= Math.min(28, Math.round(pressureTotal * 0.55));
  score -= Math.min(22, Math.round(outstanding / 1200));
  score -= pendingApprovals * 4;
  score += Math.round((readiness - 70) * 0.15);
  score = Math.min(94, Math.max(55, Math.round(score)));

  return {
    score,
    explanation: [
      `${pressureTotal} items in the attention queue`,
      `${formatCurrency(outstanding)} outstanding on active events`,
      pendingApprovals > 0
        ? `${pendingApprovals} approval${pendingApprovals === 1 ? '' : 's'} awaiting send`
        : 'Outbound queue clear',
      `Prep readiness ${readiness}%`,
    ],
  };
}

function proposalAgeDays(createdOn: string | null): number {
  if (!createdOn) return 0;
  const t = new Date(createdOn).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((AS_OF.getTime() - t) / 86400000);
}

export function clearVenueCommandStateCache() {
  stateCache = null;
  cacheKey = '';
}

export function buildVenueCommandState(external: VenueCommandExternal): VenueCommandState {
  const key = `${AS_OF_ISO}|${external.pendingApprovals}`;
  if (stateCache && cacheKey === key) return stateCache;

  const s = PV_VENUE_SUMMARY;
  const finImport = PV_FULL_IMPORT_META.financial;

  if (!isFullPvExportAvailable) {
    const fallback: VenueCommandState = {
      asOf: AS_OF_ISO,
      occupancy: { operational: 81, confirmed: 81, projected: 81, bookedDays: 25, daysInMonth: 31 },
      financials: {
        collected: 0,
        outstandingOperational: s.balanceDueDollars,
        outstandingRaw: s.balanceDueDollars,
        proposalValue: s.activePipelineDollars,
        mtdCollected: 0,
        proposalExposure: 0,
      },
      pressure: {
        totalSignals: 0,
        critical: 0,
        revenueAtRisk: 0,
        operationalPrep: 0,
        relationship: 0,
        staleProposals: 0,
        displayScore: 0,
      },
      approvals: { pending: external.pendingApprovals },
      operationalReadiness: { score: 70, factors: ['Seed data only'] },
      aiOutlook: { score: 82, explanation: ['Legacy seed mode'] },
      pipeline: {
        activeProposals: s.proposalSent,
        confirmedUpcoming: s.confirmed,
        activePipelineCount: s.activeEvents,
        atRiskRevenue: 0,
        leads: s.lead,
        qualified: s.qualified,
        lostExcluded: 0,
        completed: s.completedYtd,
      },
      attentionItems: [],
      topPressureRows: [],
      staleProposals: [],
      topAccounts: [],
      recurringSeries: [],
      diagnostics: [],
    };
    stateCache = fallback;
    cacheKey = key;
    return fallback;
  }

  const views = getCanonicalEventViews();
  const venueFin = getVenueFinancialTotals();
  const pipelineViews = getActivePipelineViews();
  const pressureDisplay = getOperationalPressureViews();
  const pressureEligible = views.filter(v => v.pressureScore >= MIN_PRESSURE_SCORE);
  const occupancy = monthOccupancy(views);
  const readiness = computeReadiness(views);
  const recurring = groupRecurringSeries(views);
  const recurringIds = new Set(
    recurring.filter(r => r.count >= 3).flatMap(r => r.eventIds.slice(0, -1)),
  );

  const stale = views
    .filter(
      v =>
        v.event.pvStatus === 'proposal_sent' &&
        v.flags.isFinanciallyRelevant &&
        proposalAgeDays(v.event.createdOn) >= 14,
    )
    .map(v => ({
      title: `${v.event.title} · ${v.event.client}`,
      days: proposalAgeDays(v.event.createdOn),
      value: v.financials.proposalTotal,
    }))
    .slice(0, 5);

  const attentionFromPressure = pressureDisplay
    .filter(v => !recurringIds.has(v.event.id))
    .slice(0, 5)
    .map(v => ({
      id: v.event.id,
      text: `${v.event.title} — ${v.event.client}: ${formatCurrency(v.financials.outstandingBalance)} outstanding · ${daysUntil(v.event.eventDateIso)}d out · ${pvStatusDisplay(v.event.pvStatus)}`,
      severity: (v.pressureBucket === 'immediate_attention' ? 'high' : 'medium') as 'high' | 'medium',
    }));

  const attentionFromSeries = recurring
    .filter(r => r.totalOutstanding >= 75)
    .slice(0, 2)
    .map(r => ({
      id: r.id,
      text: `${r.title} (${r.count}×) — ${formatCurrency(r.totalOutstanding)} series balance · next ${r.nextEventDate ?? 'TBD'}`,
      severity: 'medium' as const,
    }));

  const topScores = [...pressureEligible].sort((a, b) => b.pressureScore - a.pressureScore).slice(0, 20);
  const displayScore = topScores.length
    ? Math.min(100, Math.round(topScores.reduce((sum, v) => sum + v.pressureScore, 0) / topScores.length))
    : 0;

  const atRiskRevenue = pressureEligible.reduce((sum, v) => sum + v.financials.outstandingBalance, 0);

  const aiOutlook = computeAiOutlook(
    pressureEligible.length,
    venueFin.outstandingExposure,
    external.pendingApprovals,
    readiness.score,
  );

  const state: VenueCommandState = {
    asOf: AS_OF_ISO,
    occupancy,
    financials: {
      collected: venueFin.paymentsCollected,
      outstandingOperational: venueFin.outstandingExposure,
      outstandingRaw: finImport?.eventOutstandingRaw ?? finImport?.eventOutstanding ?? venueFin.outstandingExposure,
      proposalValue: pipelineViews.reduce((sum, v) => sum + v.financials.proposalTotal, 0),
      mtdCollected: venueFin.mtdCollected,
      proposalExposure: venueFin.proposalExposure,
    },
    pressure: {
      totalSignals: pressureEligible.length,
      critical: views.filter(v => v.pressureBucket === 'immediate_attention').length,
      revenueAtRisk: views.filter(v => v.pressureBucket === 'revenue_at_risk').length,
      operationalPrep: views.filter(v => v.pressureBucket === 'operational_prep').length,
      relationship: views.filter(v => v.pressureBucket === 'relationship_opportunity').length,
      staleProposals: stale.length,
      displayScore,
    },
    approvals: { pending: external.pendingApprovals },
    operationalReadiness: readiness,
    aiOutlook,
    pipeline: {
      activeProposals: venueFin.proposalSentCount ?? s.proposalSent,
      confirmedUpcoming: venueFin.confirmedFutureCount ?? s.confirmed,
      activePipelineCount: venueFin.activePipelineCount ?? pipelineViews.length,
      atRiskRevenue,
      leads: s.lead,
      qualified: s.qualified,
      lostExcluded: venueFin.lostCount ?? 0,
      completed: venueFin.completedCount ?? s.completedYtd,
    },
    attentionItems: [...attentionFromPressure, ...attentionFromSeries].slice(0, 5),
    topPressureRows: pressureDisplay.slice(0, 5).map(v => ({
      id: v.event.id,
      title: v.event.title,
      client: v.event.client,
      status: pvStatusDisplay(v.event.pvStatus),
      date: v.event.eventDateIso ?? 'TBD',
      daysOut: v.daysUntil,
      outstanding: v.financials.outstandingBalance,
      proposalTotal: v.financials.proposalTotal,
      collected: v.financials.collectedTotal,
      pressureBucket: v.pressureBucket,
      pressureScore: v.pressureScore,
    })),
    staleProposals: stale,
    topAccounts: getFullPvAccounts()
      .filter(a => a.eventCount > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend || b.eventCount - a.eventCount)
      .slice(0, 8)
      .map(a => ({
        id: a.id,
        client: a.name,
        eventCount: a.eventCount,
        totalValue: a.totalSpend,
      })),
    recurringSeries: recurring.slice(0, 5),
    diagnostics: [
      {
        metric: 'Occupancy (operational)',
        value: `${occupancy.operational}%`,
        source: 'buildVenueCommandState().occupancy.operational',
        formula: `May ${REF_YEAR} booked days (${occupancy.bookedDays}) / ${occupancy.daysInMonth}, excl. lost/office/test`,
      },
      {
        metric: 'Collected',
        value: formatCurrency(venueFin.paymentsCollected),
        source: 'FULL_PV_FINANCIAL_SNAPSHOT.paymentsCollected',
        formula: 'Sum of paid rows in payment ledger',
      },
      {
        metric: 'Outstanding (operational)',
        value: formatCurrency(venueFin.outstandingExposure),
        source: 'getVenueFinancialTotals().outstandingExposure',
        formula: 'Sum outstandingBalance on upcoming ops-relevant views; lost=$0',
      },
      {
        metric: 'Pressure signals',
        value: String(pressureEligible.length),
        source: 'buildVenueCommandState().pressure.totalSignals',
        formula: `Canonical events with pressureScore ≥ ${MIN_PRESSURE_SCORE}`,
      },
      {
        metric: 'Pressure display score',
        value: String(displayScore),
        source: 'buildVenueCommandState().pressure.displayScore',
        formula: 'Average of top-20 pressure scores (0–100 meter)',
      },
      {
        metric: 'Readiness',
        value: `${readiness.score}%`,
        source: 'buildVenueCommandState().operationalReadiness.score',
        formula: 'Confirmed upcoming: deposit 35% + balance 35% + timeline 30%',
      },
      {
        metric: 'AI outlook',
        value: `${aiOutlook.score}%`,
        source: 'buildVenueCommandState().aiOutlook.score',
        formula: '100 − pressure density − outstanding/1200 − approvals×4 + readiness adj',
      },
      {
        metric: 'Approvals pending',
        value: String(external.pendingApprovals),
        source: 'demoOpsStore approvals',
        formula: 'Count pending | edited in Autopilot queue',
      },
    ],
  };

  stateCache = state;
  cacheKey = key;
  return state;
}

/** Map command state → legacy digest for gradual migration */
export function commandStateToDashboardDigest(state: VenueCommandState): import('./pvUiIntelligence.js').DashboardDigest {
  return {
    activeEvents: state.pipeline.activePipelineCount,
    confirmed: state.pipeline.confirmedUpcoming,
    proposalSent: state.pipeline.activeProposals,
    leads: state.pipeline.leads,
    qualified: state.pipeline.qualified,
    lost: state.pipeline.lostExcluded,
    completed: state.pipeline.completed,
    outstandingBalance: state.financials.outstandingOperational,
    pipelineDollars: state.financials.proposalValue,
    occupancyPct: state.occupancy.operational,
    collectedTotal: state.financials.collected,
    mtdCollected: state.financials.mtdCollected,
    conversionRatePct: 0,
    avgBookingValue: 0,
    proposalExposure: state.financials.proposalExposure,
    upcomingEvents: state.topPressureRows.map(r => ({
      id: r.id,
      title: r.title,
      client: r.client,
      date: r.date,
      status: r.status,
      balance: r.outstanding,
    })),
    topAccounts: state.topAccounts.slice(0, 5) as import('./pvUiIntelligence.js').DashboardDigest['topAccounts'],
    staleProposals: state.staleProposals,
    followUpPressure: state.pressure.totalSignals,
    attentionItems: state.attentionItems,
  };
}

export function pressureRowHref(id: string) {
  return id.startsWith('series-') ? '/opportunities' : opportunityDetailPath(id);
}
