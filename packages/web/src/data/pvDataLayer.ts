/**
 * Unified Perfect Venue data layer — full XLSX export primary, legacy seed fallback.
 */

import type { DemoCalendarDay, DemoPipelineCard, DemoPipelineStage, DemoTask, DemoWeekEvent } from './demoVenue.js';
import {
  mapPvStatusToHubStage,
  pvStatusDisplay,
  type PvDashboardKpis,
  type PvEventStatus,
  type PvSeedEvent,
} from './perfectVenueSeedCore.js';

/** Sync access — full export is static import after build */
import { PV_FULL_EXPORT_AVAILABLE } from './pvExportFlags.js';
import {
  PV_FULL_IMPORT_META,
  FULL_PV_EVENTS,
  FULL_PV_PROPOSALS,
  FULL_PV_CONTACTS,
  FULL_PV_ACCOUNTS,
  FULL_PV_RELATIONSHIPS,
  FULL_PV_OPERATIONAL_INTELLIGENCE,
  FULL_PV_PAYMENTS,
  FULL_PV_EVENT_FINANCIALS,
  FULL_PV_SALES_DAYS,
  FULL_PV_VENUE_SALES_TOTALS,
  FULL_PV_FINANCIAL_SNAPSHOT,
  FULL_PV_ACCOUNT_FINANCIALS,
} from './perfectVenueFullExport.js';
import { pickFlagshipEventId, buildCanonicalFinancials } from './pvEventModel.js';

export {
  FULL_PV_PAYMENTS,
  FULL_PV_EVENT_FINANCIALS,
  FULL_PV_SALES_DAYS,
  FULL_PV_VENUE_SALES_TOTALS,
  FULL_PV_FINANCIAL_SNAPSHOT,
  FULL_PV_ACCOUNT_FINANCIALS,
};

export { isFullPvExportAvailable, PV_FULL_EXPORT_AVAILABLE } from './pvExportFlags.js';

export function getPvImportMeta() {
  return PV_FULL_IMPORT_META;
}

export function getFullPvEvents() {
  return FULL_PV_EVENTS;
}

export function getFullPvEventById(id: string) {
  return FULL_PV_EVENTS.find(e => e.id === id);
}

export function getFullPvProposal(eventId: string) {
  return FULL_PV_PROPOSALS[eventId];
}

export function getFullPvContacts() {
  return FULL_PV_CONTACTS;
}

export function getFullPvAccounts() {
  return FULL_PV_ACCOUNTS;
}

export function getFullPvRelationships() {
  return FULL_PV_RELATIONSHIPS;
}

export function getVenueSummaryFromExport() {
  return FULL_PV_OPERATIONAL_INTELLIGENCE.venueSummary;
}

export function getOccupancyPctFromExport() {
  return FULL_PV_OPERATIONAL_INTELLIGENCE.occupancyPct;
}

/** Map full event → legacy PvSeedEvent (no private fields) */
export function toPvSeedEvent(e: (typeof FULL_PV_EVENTS)[0]): PvSeedEvent {
  return {
    id: e.id,
    title: e.title,
    client: e.client,
    pvStatus: e.pvStatus,
    eventDate: e.eventDateIso ?? 'TBD',
    eventTime: e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : e.startTime || undefined,
    guests: e.guests,
    value: e.value,
    depositPaid: e.depositPaid,
    balanceDue: e.balanceDue,
    spaces: e.spaces.length ? e.spaces : e.space ? [e.space] : [],
    eventType: e.eventType,
    accent: e.accent,
  };
}

export function getPipelineEventsFromExport(): PvSeedEvent[] {
  const active = new Set<PvEventStatus>(['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due']);
  return FULL_PV_EVENTS.filter(e => active.has(e.pvStatus)).map(toPvSeedEvent);
}

export function getPipelineCardsFromExport(): DemoPipelineCard[] {
  return getPipelineEventsFromExport().map(e => ({
    id: e.id,
    title: e.title,
    client: e.client,
    eventDate: e.eventDate,
    stage: mapPvStatusToHubStage(e.pvStatus) as DemoPipelineStage,
    value: e.value,
    depositPaid: e.depositPaid,
    balanceDue: e.balanceDue,
    spaces: e.spaces,
    guests: e.guests,
    accent: e.accent,
    eventType: e.eventType,
  }));
}

export function getDashboardKpisFromExport(): PvDashboardKpis {
  const s = FULL_PV_OPERATIONAL_INTELLIGENCE.venueSummary;
  return {
    activeBookings: s.activeEvents,
    newLeads: s.lead,
    qualifiedOpportunities: s.qualified,
    proposalSent: s.proposalSent,
    confirmedEvents: s.confirmed,
    outstandingBalances: s.balanceDueDollars,
    completedYtd: s.completedYtd,
    monthlyRevenue: s.confirmed,
    aiForecastConfidence: 82,
  };
}

export function getWeekEventsFromExport(limit = 12): DemoWeekEvent[] {
  const now = '2026-05-20';
  return FULL_PV_EVENTS.filter(
    e => e.eventDateIso && e.eventDateIso >= now && ['confirmed', 'proposal_sent', 'qualified'].includes(e.pvStatus),
  )
    .sort((a, b) => (a.eventDateIso ?? '').localeCompare(b.eventDateIso ?? ''))
    .slice(0, limit)
    .map(e => ({
      id: e.id,
      title: e.title,
      when: e.eventDateIso ?? 'TBD',
      venue: e.spaces[0] ?? e.space ?? 'Event Space',
      status: pvStatusDisplay(e.pvStatus),
      chip: e.balanceDue > 0 ? 'Balance due' : undefined,
    }));
}

export function getRecentInquiriesFromExport(limit = 12) {
  return FULL_PV_EVENTS.filter(e => ['lead', 'qualified', 'proposal_sent'].includes(e.pvStatus))
    .sort((a, b) => (b.lastContacted ?? b.createdOn ?? '').localeCompare(a.lastContacted ?? a.createdOn ?? ''))
    .slice(0, limit)
    .map(e => ({
      id: e.id,
      source: e.source || e.origin || 'Perfect Venue',
      who: e.client,
      org: e.title,
      what: `${pvStatusDisplay(e.pvStatus)} · ${e.eventType}`,
      when: e.lastContacted ?? e.createdOn ?? 'Recent',
      sla: e.pvStatus === 'lead' ? '4h' : 'Met',
    }));
}

export function getOverdueFollowUpsFromExport(limit = 12) {
  return FULL_PV_EVENTS.filter(
    e =>
      (e.balanceDue > 0 && e.pvStatus === 'confirmed') ||
      (e.pvStatus === 'proposal_sent' && e.depositPaid === 0) ||
      (e.daysOut != null && e.daysOut < 0),
  )
    .slice(0, limit)
    .map((e, i) => ({
      id: `fu-${e.id}`,
      what:
        e.balanceDue > 0
          ? `Balance follow-up · ${e.title}`
          : `Proposal follow-up · ${e.title}`,
      who: e.owner || 'Coordinator',
      due: e.eventDateIso ?? 'Soon',
      amt: e.balanceDue > 0 ? `$${e.balanceDue} balance` : `$${e.value} proposal`,
    }));
}

export function getAiAttentionFromExport(limit = 6) {
  const items = FULL_PV_EVENTS.filter(
    e => e.balanceDue > 0 || (e.pvStatus === 'proposal_sent' && e.depositPaid === 0),
  )
    .sort((a, b) => b.balanceDue - a.balanceDue)
    .slice(0, limit);
  return items.map((e, i) => ({
    id: `pv-a${i}`,
    text: `${e.title} — ${e.client}: ${e.balanceDue > 0 ? `$${e.balanceDue} balance due` : 'deposit path open'} (${pvStatusDisplay(e.pvStatus)})`,
    severity: (e.balanceDue >= 300 || e.pvStatus === 'proposal_sent' ? 'high' : 'medium') as 'high' | 'medium' | 'low',
  }));
}

export function getCalendarMonthFromExport(year: number, monthIndex0: number): DemoCalendarDay[] {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
  const byDay: Record<number, DemoCalendarDay['items']> = {};

  for (const e of FULL_PV_EVENTS) {
    if (!e.eventDateIso?.startsWith(prefix)) continue;
    const day = parseInt(e.eventDateIso.slice(8, 10), 10);
    const type =
      e.pvStatus === 'confirmed' || e.pvStatus === 'completed'
        ? 'confirmed'
        : e.pvStatus === 'proposal_sent'
          ? 'proposal'
          : 'site_visit';
    byDay[day] = byDay[day] ?? [];
    byDay[day].push({
      type: type as DemoCalendarDay['items'][0]['type'],
      label: e.title.length > 22 ? `${e.title.slice(0, 20)}…` : e.title,
      time: e.startTime || undefined,
    });
  }

  const out: DemoCalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push({ day: d, items: byDay[d] ?? [] });
  }
  return out;
}

export function buildFlagshipFromExport() {
  // Prefer import-time id — avoids calling pickFlagshipEventId during module init cycles.
  const id =
    FULL_PV_OPERATIONAL_INTELLIGENCE.flagshipEventId || pickFlagshipEventId();
  const e = FULL_PV_EVENTS.find(x => x.id === id) ?? FULL_PV_EVENTS.find(x => x.pvStatus === 'confirmed');
  if (!e) return null;
  const prop = FULL_PV_PROPOSALS[e.id];
  const fin = buildCanonicalFinancials(e);
  const lines = prop?.lines ?? [];
  return {
    id: e.id,
    title: e.title,
    client: e.client,
    accountId: FULL_PV_RELATIONSHIPS.eventToAccount[e.id] ?? `acct_${e.id}`,
    eventStart: e.eventDateIso ? `${e.eventDateIso}T20:00:00.000Z` : '2026-06-07T20:00:00.000Z',
    eventEnd: e.eventDateIso ? `${e.eventDateIso}T23:00:00.000Z` : '2026-06-07T23:00:00.000Z',
    guestCount: e.guests || 30,
    spacesBooked: e.spaces.length ? e.spaces : ['Event Space'],
    revenue: fin.proposalTotal,
    collected: fin.collectedTotal,
    proposalStatus: prop?.primaryPackage ?? 'Confirmed package',
    contractStatus: fin.hasDeposit ? 'Signed · deposit received' : 'Agreement pending',
    aiClosePct: e.readinessScore,
    aiUpsells: prop?.upsellOpportunities?.map(u => `Add ${u}`) ?? [],
    nextAction:
      fin.outstandingBalance > 0
        ? `Collect remaining $${fin.outstandingBalance} before event day`
        : 'Confirm day-of logistics and access',
    notesInternal: `PV export event ${e.pvId} · ${pvStatusDisplay(e.pvStatus)}`,
    guestPreferences: [`${e.guests} guests · ${e.eventType}`],
    selectedPackages: lines.slice(0, 4).map(l => ({
      code: l.itemName.slice(0, 12),
      name: l.itemName,
      qty: `${l.quantity} ${l.unit}`,
      lineTotal: l.total,
    })),
    paymentMilestones: [
      {
        label: 'Deposit',
        amount: fin.depositPaid,
        status: (fin.hasDeposit ? 'paid' : 'due') as 'paid' | 'due',
      },
      {
        label: 'Final balance',
        amount: fin.outstandingBalance,
        status: (fin.outstandingBalance > 0 ? 'due' : 'paid') as 'paid' | 'due',
        dueDate: e.eventDateIso ?? undefined,
      },
    ],
    contractSteps: [
      { label: 'Proposal issued', complete: true, detail: e.createdOn ?? '—' },
      {
        label: 'Agreement signed',
        complete: e.pvStatus === 'confirmed' || e.pvStatus === 'completed',
        detail: e.confirmedOn ?? '—',
      },
      {
        label: 'Deposit received',
        complete: e.depositPaid > 0,
        detail: e.depositPaid > 0 ? `$${e.depositPaid}` : 'Pending',
      },
      { label: 'Final balance', complete: e.balanceDue === 0, detail: e.eventDateIso ?? '—' },
    ],
    communications: [
      {
        title: 'Event confirmed',
        channel: 'Perfect Venue',
        actor: e.owner || 'HuB team',
        at: e.confirmedOn ?? e.createdOn ?? '—',
      },
    ],
    aiPlaybook: {
      headline:
        e.balanceDue > 0
          ? `On track — $${e.balanceDue} balance remains before ${e.eventDateIso ?? 'event day'}`
          : 'Strong booking — logistics and guest count confirmation remain',
      drivers: [
        `${pvStatusDisplay(e.pvStatus)}`,
        e.depositPaid > 0 ? 'Deposit on file' : 'Deposit pending',
        `${e.guests} guests expected`,
      ],
      risks: prop?.missingDepositRisk ? ['Deposit path incomplete'] : [],
      suggestedCalls: prop?.addonCandidates?.slice(0, 2) ?? [],
    },
  };
}

/** Stale proposals from export */
export function getStaleProposalsFromExport() {
  return FULL_PV_EVENTS.filter(e => e.pvStatus === 'proposal_sent')
    .sort((a, b) => (a.createdOn ?? '').localeCompare(b.createdOn ?? ''))
    .slice(0, 8)
    .map(e => {
      const created = e.createdOn ? new Date(e.createdOn) : new Date();
      const days = Math.floor((Date.now() - created.getTime()) / 86400000);
      return { title: `${e.title} · ${e.client}`, days, value: e.value };
    });
}

export function getBalancesAttentionFromExport() {
  return FULL_PV_EVENTS.filter(e => e.balanceDue > 0)
    .slice(0, 6)
    .map((e, i) => ({
      client: e.client,
      event: `${e.title} · ${e.eventDateIso ?? 'TBD'}`,
      amount: e.balanceDue,
      due: e.eventDateIso ?? 'On sign',
      id: `bb-${i}`,
    }));
}

export function getLegacyVenueSummaryShape() {
  const s = FULL_PV_OPERATIONAL_INTELLIGENCE.venueSummary;
  return {
    activeEvents: s.activeEvents,
    activePipelineDollars: s.activePipelineDollars,
    lead: s.lead,
    leadDollars: 0,
    qualified: s.qualified,
    qualifiedDollars: 0,
    proposalSent: s.proposalSent,
    proposalSentDollars: 0,
    confirmed: s.confirmed,
    confirmedDollars: 0,
    balanceDue: s.balanceDue,
    balanceDueDollars: s.balanceDueDollars,
    completedYtd: s.completedYtd,
    completedYtdDollars: s.completedYtdDollars,
    extractedAt: s.extractedAt,
    venue: s.venue,
  };
}

export function getExecutiveAnchorsFromExport() {
  const balances = getBalancesAttentionFromExport();
  const stale = getStaleProposalsFromExport();
  const topBalance = FULL_PV_EVENTS.filter(e => e.balanceDue > 0)
    .sort((a, b) => b.balanceDue - a.balanceDue)
    .slice(0, 3);
  return {
    focusHeadline: `${FULL_PV_OPERATIONAL_INTELLIGENCE.venueSummary.confirmed} confirmed · ${FULL_PV_OPERATIONAL_INTELLIGENCE.venueSummary.balanceDue} balances open — June load-in from PV export`,
    overnightSamples: topBalance.map(
      e => `${e.title} — $${e.balanceDue} balance · ${e.eventDateIso ?? 'TBD'}`,
    ),
    revenueLeads: stale.slice(0, 3).map(s => ({
      event: s.title.split(' · ')[0] ?? s.title,
      note: `${s.days}d in proposal`,
      est: s.value,
    })),
    staleProposals: stale,
    balances: balances.map(b => ({
      client: b.client,
      event: b.event,
      amount: b.amount,
      due: b.due,
    })),
  };
}

export type PvFlagshipDeal = NonNullable<ReturnType<typeof buildFlagshipFromExport>>;
