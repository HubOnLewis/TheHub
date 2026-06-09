/**
 * Financial intelligence — derived ONLY from imported PV payments + sales + events.
 */

import { formatCurrency } from '@hub-crm/shared';
import {
  FULL_PV_PAYMENTS,
  FULL_PV_EVENT_FINANCIALS,
  FULL_PV_SALES_DAYS,
  FULL_PV_VENUE_SALES_TOTALS,
  FULL_PV_FINANCIAL_SNAPSHOT,
  FULL_PV_ACCOUNT_FINANCIALS,
  FULL_PV_EVENTS,
  PV_FULL_IMPORT_META,
} from './perfectVenueFullExport.js';
import { isFullPvExportAvailable } from './pvDataLayer.js';
import { opportunityDetailPath } from '../config/paths.js';
import {
  buildCanonicalFinancials,
  getOperationalPressureViews,
  getVenueFinancialTotals,
  groupRecurringSeries,
  getCanonicalEventViews,
} from './pvEventModel.js';

export type FinancialRailSection = {
  id: string;
  title: string;
  tone?: 'warn' | 'gold' | 'neutral' | 'live';
  live?: boolean;
  spark?: number[];
  items: { id: string; label: string; meta?: string; href?: string; progress?: number }[];
};

const AS_OF = new Date('2026-05-20T12:00:00.000Z');
const MIN_VALUE = 75;

let cache: Record<string, unknown> | null = null;

function snap() {
  return isFullPvExportAvailable ? getVenueFinancialTotals() : FULL_PV_FINANCIAL_SNAPSHOT;
}

function daysUntil(iso: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  return Math.ceil((t - AS_OF.getTime()) / 86400000);
}

export function getRevenueIntelligence() {
  const sales = FULL_PV_VENUE_SALES_TOTALS;
  const s = snap();
  return {
    source: 'Perfect Venue sales report + event export',
    mtdGrandTotal: sales?.grandTotal ?? s.mtdGrandTotal,
    mtdPaymentsTotal: sales?.paymentsTotal ?? 0,
    subtotal: sales?.subtotal ?? 0,
    collected: s.paymentsCollected,
    outstanding: s.outstandingExposure,
    avgBookingValue: s.avgBookingValue,
    conversionRatePct: s.conversionRatePct,
    dailyPacing: FULL_PV_SALES_DAYS.filter(d => d.date.startsWith('2026-05')).map(d => ({
      date: d.date,
      grandTotal: d.grandTotal,
      paymentsTotal: d.paymentsTotal,
    })),
  };
}

export function getPaymentPressure() {
  const seriesIds = new Set(
    groupRecurringSeries(getCanonicalEventViews())
      .filter(s => s.count >= 3)
      .flatMap(s => s.eventIds.slice(0, -1)),
  );

  return getOperationalPressureViews()
    .filter(v => v.financials.outstandingBalance >= MIN_VALUE && !seriesIds.has(v.event.id))
    .slice(0, 12)
    .map(v => ({
      eventId: v.event.id,
      title: v.event.title,
      client: v.event.client,
      balanceDue: v.financials.outstandingBalance,
      eventDate: v.event.eventDateIso,
      daysOut: v.daysUntil,
      fin: FULL_PV_EVENT_FINANCIALS[v.event.id],
    }));
}

export function getDepositRisk() {
  return FULL_PV_EVENTS.filter(e => {
    if (e.pvStatus !== 'proposal_sent') return false;
    const fin = buildCanonicalFinancials(e);
    return fin.proposalTotal >= MIN_VALUE && !fin.hasDeposit;
  })
    .map(e => ({
      eventId: e.id,
      title: e.title,
      client: e.client,
      value: buildCanonicalFinancials(e).proposalTotal,
      createdOn: e.createdOn,
    }))
    .slice(0, 8);
}

export function getCashFlowForecast() {
  const upcoming = getOperationalPressureViews().filter(
    v => v.flags.isUpcoming && v.financials.outstandingBalance > 0,
  );
  const byWeek = new Map<string, number>();
  for (const v of upcoming) {
    const w = v.event.eventDateIso?.slice(0, 7) ?? 'unknown';
    byWeek.set(w, (byWeek.get(w) ?? 0) + v.financials.outstandingBalance);
  }
  return [...byWeek.entries()].map(([week, amount]) => ({ week, amount }));
}

export function getEventValueMomentum() {
  return getCanonicalEventViews()
    .filter(v => v.flags.isFinanciallyRelevant && !v.flags.isLost)
    .sort((a, b) => b.financials.proposalTotal - a.financials.proposalTotal)
    .slice(0, 8)
    .map(v => ({
      id: v.event.id,
      title: v.event.title,
      value: v.financials.proposalTotal,
      collected: v.financials.collectedTotal,
      balanceDue: v.financials.outstandingBalance,
      pvStatus: v.event.pvStatus,
    }));
}

export function getAccountLifetimeValue() {
  return [...FULL_PV_ACCOUNT_FINANCIALS]
    .sort((a, b) => b.lifetimeCollected - a.lifetimeCollected)
    .slice(0, 20);
}

export function getBalanceExposure() {
  const s = snap();
  return {
    total: s.outstandingExposure,
    overdue: s.overdueExposure,
    eventCount: getPaymentPressure().length,
    top: getPaymentPressure().slice(0, 5),
  };
}

export function getCollectionsQueue() {
  return FULL_PV_PAYMENTS.filter(p => p.status === 'Paid')
    .sort((a, b) => (b.paidOnIso ?? '').localeCompare(a.paidOnIso ?? ''))
    .slice(0, 12)
    .map(p => ({
      id: p.id,
      eventName: p.eventName,
      amount: p.amount,
      type: p.paymentType,
      paidOn: p.paidOnIso,
      method: p.method,
    }));
}

export function getProposalConversionAnalytics() {
  const s = snap();
  const sent = FULL_PV_EVENTS.filter(
    e => e.pvStatus === 'proposal_sent' && buildCanonicalFinancials(e).proposalTotal >= MIN_VALUE,
  ).length;
  const confirmed = FULL_PV_EVENTS.filter(e => e.pvStatus === 'confirmed').length;
  return {
    proposalSent: sent,
    confirmed,
    conversionRatePct: s.conversionRatePct,
    proposalExposure: s.proposalExposure,
    stale: FULL_PV_EVENTS.filter(e => e.pvStatus === 'proposal_sent' && e.createdOn)
      .filter(e => {
        const d = new Date(e.createdOn!).getTime();
        return (AS_OF.getTime() - d) / 86400000 >= 14;
      })
      .length,
  };
}

export function getVenueRevenuePacing() {
  const days = FULL_PV_SALES_DAYS.filter(d => d.grandTotal > 0 || d.paymentsTotal > 0);
  const spark = days.slice(-14).map(d => d.paymentsTotal || d.grandTotal);
  return {
    totals: FULL_PV_VENUE_SALES_TOTALS,
    activeDays: days.length,
    spark,
    busiestDay: [...days].sort((a, b) => b.grandTotal - a.grandTotal)[0],
  };
}

export function getUpcomingRevenueWindows() {
  return getActivePipelineFromViews()
    .filter(v => v.daysUntil >= 0 && v.daysUntil <= 30)
    .slice(0, 8)
    .map(v => ({
      id: v.event.id,
      title: v.event.title,
      date: v.event.eventDateIso,
      value: v.financials.proposalTotal,
      balanceDue: v.financials.outstandingBalance,
    }));
}

function getActivePipelineFromViews() {
  return getCanonicalEventViews().filter(v => v.flags.isActivePipeline && v.flags.isFinanciallyRelevant);
}

export function getPaymentsForEvent(eventId: string) {
  return FULL_PV_PAYMENTS.filter(p => p.eventId === eventId && p.status === 'Paid').sort((a, b) =>
    (a.paidOnIso ?? '').localeCompare(b.paidOnIso ?? ''),
  );
}

export function getExecutiveFinancialRailSections(): FinancialRailSection[] {
  if (!isFullPvExportAvailable) return [];
  const s = snap();
  const pacing = getVenueRevenuePacing();
  const pressure = getPaymentPressure().slice(0, 4);
  const deposits = getDepositRisk().slice(0, 3);
  const highValue = getEventValueMomentum().slice(0, 3);
  const series = groupRecurringSeries(getCanonicalEventViews())
    .filter(r => r.totalOutstanding >= MIN_VALUE)
    .slice(0, 2);

  const sections: FinancialRailSection[] = [
    {
      id: 'fin-collected',
      title: 'Financial command',
      tone: 'gold',
      live: true,
      spark: pacing.spark.length ? pacing.spark : [s.mtdCollected, s.outstandingExposure],
      items: [
        {
          id: 'collected',
          label: `Collected · ${formatCurrency(s.paymentsCollected)}`,
          meta: `MTD payments ${formatCurrency(s.mtdCollected)}`,
        },
        {
          id: 'outstanding',
          label: `Outstanding · ${formatCurrency(s.outstandingExposure)}`,
          meta: `${s.depositDueCount} deposits pending · ops-relevant only`,
          progress: Math.min(
            100,
            Math.round((s.mtdCollected / (s.mtdCollected + s.outstandingExposure + 1)) * 100),
          ),
        },
      ],
    },
    {
      id: 'fin-pressure',
      title: 'Balance pressure',
      tone: 'warn',
      items: pressure.map(p => ({
        id: p.eventId,
        label: `${p.title} · ${formatCurrency(p.balanceDue)}`,
        meta: `${p.client} · ${p.eventDate ?? 'TBD'}`,
        href: opportunityDetailPath(p.eventId),
      })),
    },
  ];

  if (series.length) {
    sections.push({
      id: 'fin-series',
      title: 'Recurring series',
      tone: 'neutral',
      items: series.map(r => ({
        id: r.id,
        label: `${r.title} · ${r.count}×`,
        meta: `${formatCurrency(r.totalOutstanding)} outstanding · next ${r.nextEventDate ?? '—'}`,
        href: r.nextEventId ? opportunityDetailPath(r.nextEventId) : undefined,
      })),
    });
  }

  sections.push(
    {
      id: 'fin-deposits',
      title: 'Deposit deadlines',
      tone: 'neutral',
      items: deposits.map(d => ({
        id: d.eventId,
        label: d.title,
        meta: `${formatCurrency(d.value)} proposal · ${d.client}`,
        href: opportunityDetailPath(d.eventId),
      })),
    },
    {
      id: 'fin-vip',
      title: 'High-value events',
      tone: 'live',
      items: highValue.map(e => ({
        id: e.id,
        label: e.title,
        meta: `${formatCurrency(e.value)} · ${formatCurrency(e.balanceDue)} due`,
        href: opportunityDetailPath(e.id),
      })),
    },
  );

  return sections;
}

export function getFinancialImportSummary() {
  return PV_FULL_IMPORT_META.financial ?? null;
}

export function clearPvFinancialCache() {
  cache = null;
}
