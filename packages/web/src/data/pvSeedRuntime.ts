/**
 * Resolves live PV exports after pvDataLayer + full export are initialized.
 * Keeps perfectVenueSeedCore free of pvDataLayer imports (breaks circular init).
 */

import type { DemoCalendarDay, DemoPipelineCard, DemoWeekEvent } from './demoVenue.js';
import { PV_FULL_EXPORT_AVAILABLE } from './pvExportFlags.js';
import {
  getPipelineEventsFromExport,
  getPipelineCardsFromExport,
  getDashboardKpisFromExport,
  getLegacyVenueSummaryShape,
  getOccupancyPctFromExport,
  getWeekEventsFromExport,
  getRecentInquiriesFromExport,
  getAiAttentionFromExport,
  getOverdueFollowUpsFromExport,
  getCalendarMonthFromExport,
  buildFlagshipFromExport,
  getExecutiveAnchorsFromExport,
  getPvImportMeta,
} from './pvDataLayer.js';
import {
  PV_PIPELINE_EVENTS_LEGACY,
  PV_VENUE_SUMMARY_LEGACY,
  PV_DASHBOARD_KPIS_LEGACY,
  PV_WEEK_EVENTS_LEGACY,
  PV_RECENT_INQUIRIES_LEGACY,
  PV_AI_ATTENTION_LEGACY,
  PV_OVERDUE_FOLLOWUPS_LEGACY,
  PV_FLAGSHIP_DEAL_LEGACY,
  PV_EXECUTIVE_ANCHORS_LEGACY,
  PV_TASKS,
  PV_INBOX_MESSAGES,
  PV_RECURRING,
  pvSeedToPipelineCard,
  getPvDemoCalendarMonthLegacy,
  type PvDashboardKpis,
  type PvSeedEvent,
} from './perfectVenueSeedCore.js';

export const PV_PIPELINE_EVENTS: PvSeedEvent[] = PV_FULL_EXPORT_AVAILABLE
  ? getPipelineEventsFromExport()
  : PV_PIPELINE_EVENTS_LEGACY;

export const PV_DEMO_PIPELINE: DemoPipelineCard[] = PV_FULL_EXPORT_AVAILABLE
  ? getPipelineCardsFromExport()
  : PV_PIPELINE_EVENTS_LEGACY.map(pvSeedToPipelineCard);

export const PV_VENUE_SUMMARY = PV_FULL_EXPORT_AVAILABLE
  ? getLegacyVenueSummaryShape()
  : PV_VENUE_SUMMARY_LEGACY;

export const PV_DASHBOARD_KPIS: PvDashboardKpis = PV_FULL_EXPORT_AVAILABLE
  ? getDashboardKpisFromExport()
  : PV_DASHBOARD_KPIS_LEGACY;

export const PV_OCCUPANCY_PCT = PV_FULL_EXPORT_AVAILABLE
  ? getOccupancyPctFromExport()
  : 81;

export const PV_WEEK_EVENTS: DemoWeekEvent[] = PV_FULL_EXPORT_AVAILABLE
  ? getWeekEventsFromExport()
  : PV_WEEK_EVENTS_LEGACY;

export const PV_RECENT_INQUIRIES = PV_FULL_EXPORT_AVAILABLE
  ? getRecentInquiriesFromExport()
  : PV_RECENT_INQUIRIES_LEGACY;

export const PV_AI_ATTENTION = PV_FULL_EXPORT_AVAILABLE
  ? getAiAttentionFromExport()
  : PV_AI_ATTENTION_LEGACY;

export const PV_OVERDUE_FOLLOWUPS = PV_FULL_EXPORT_AVAILABLE
  ? getOverdueFollowUpsFromExport()
  : PV_OVERDUE_FOLLOWUPS_LEGACY;

export function getPvDemoCalendarMonth(year: number, monthIndex0: number): DemoCalendarDay[] {
  if (PV_FULL_EXPORT_AVAILABLE) return getCalendarMonthFromExport(year, monthIndex0);
  return getPvDemoCalendarMonthLegacy(year, monthIndex0);
}

function resolvePvFlagshipDeal(): typeof PV_FLAGSHIP_DEAL_LEGACY {
  if (!PV_FULL_EXPORT_AVAILABLE) return PV_FLAGSHIP_DEAL_LEGACY;
  try {
    const built = buildFlagshipFromExport();
    return (built ?? PV_FLAGSHIP_DEAL_LEGACY) as typeof PV_FLAGSHIP_DEAL_LEGACY;
  } catch (err) {
    console.warn('[pvSeedRuntime] Flagship deal fallback to legacy seed', err);
    return PV_FLAGSHIP_DEAL_LEGACY;
  }
}

export const PV_FLAGSHIP_DEAL = resolvePvFlagshipDeal();

export const PV_EXECUTIVE_ANCHORS = PV_FULL_EXPORT_AVAILABLE
  ? getExecutiveAnchorsFromExport()
  : PV_EXECUTIVE_ANCHORS_LEGACY;

export const PV_SEED_META = {
  source: PV_FULL_EXPORT_AVAILABLE ? 'perfect-venue-xlsx-full' : 'perfect-venue-export',
  sanitized: true,
  importedAt: PV_FULL_EXPORT_AVAILABLE ? getPvImportMeta().importedAt : PV_VENUE_SUMMARY_LEGACY.extractedAt,
  recordCounts: {
    pipelineEvents: PV_PIPELINE_EVENTS.length,
    tasks: PV_TASKS.length,
    inbox: PV_INBOX_MESSAGES.length,
    recurring: PV_RECURRING.length,
  },
} as const;

export { getPvImportMeta } from './pvDataLayer.js';
export { isFullPvExportAvailable } from './pvExportFlags.js';
