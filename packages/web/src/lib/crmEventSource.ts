/**
 * Authoritative CRM event source resolver.
 * Metrics and table rows always come from the same resolved source.
 */

import { isProductionCRM } from '../config/productionData.js';
import { PV_FULL_EXPORT_AVAILABLE } from '../data/pvExportFlags.js';
import { PF_EVENTS_SNAPSHOT, PF_EVENTS_SNAPSHOT_AVAILABLE } from '../data/pfEventsSnapshotFlags.js';
import { getFullPvEvents } from '../data/pvDataLayer.js';
import { PV_PIPELINE_EVENTS } from '../data/perfectVenueSeed.js';
import { PV_FULL_IMPORT_META } from '../data/perfectVenueFullExport.js';
import {
  computeCrmMetrics,
  type CrmEventRow,
  type CrmMetricCard,
} from './crmEvents.js';
import {
  mapDemoSeedToRow,
  mapFullPvToRow,
  mapHubRefreshToRow,
  mapPfParsedToRow,
} from './crmEventRowMappers.js';
import { HUB_REFRESH_AVAILABLE, HUB_REFRESH_MANIFEST } from '../data/hubRefreshManifest.js';
import { getHubRefreshEvents } from '../data/hubRefreshDataLayer.js';
import {
  PV_EXPECTED_SUMMARY,
  PV_EXPECTED_SUMMARY_FIELDS,
  type PvExpectedSummary,
} from './pvExpectedSummary.js';
import type { PfImportStatus } from '../data/pfEventsTypes.js';

export type CrmEventSourceId =
  | 'live-api'
  | 'hub-refresh'
  | 'pfevents-txt'
  | 'xlsx-full-export'
  | 'demo-seed'
  | 'none';

export type CrmImportCompleteness = 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'FALLBACK';

export interface CrmValidationMismatch {
  field: string;
  label: string;
  kind: 'count' | 'dollars';
  expected: number;
  actual: number;
  delta: number;
  reason: string;
}

export interface CrmEventSourceManifest {
  sourceId: CrmEventSourceId;
  sourceLabel: string;
  completeness: CrmImportCompleteness;
  /** True when metrics + table are from the same source and row-backed. */
  authoritative: boolean;
  /** True when status/dollar totals match PV_EXPECTED_SUMMARY closely. */
  matchesPvExpectedSummary: boolean;
  tableSourceId: CrmEventSourceId;
  metricSourceId: CrmEventSourceId;
  mixedSources: boolean;
  warningMessage: string | null;
  rowCount: number;
  importedAt: string | null;
  rows: CrmEventRow[];
  metrics: CrmMetricCard[];
  validation: {
    expected: PvExpectedSummary;
    mismatches: CrmValidationMismatch[];
  };
  pfTextStatus: PfImportStatus | null;
  skippedFallbackFrom: CrmEventSourceId | null;
}

const SOURCE_LABELS: Record<CrmEventSourceId, string> = {
  'live-api': 'Live CRM database (Mongo)',
  'hub-refresh': 'Perfect Venue refresh import (HuB on Lewis)',
  'pfevents-txt': 'Perfect Venue PFevents.txt import',
  'xlsx-full-export': 'Perfect Venue XLSX full export',
  'demo-seed': 'Demo seed data',
  none: 'No event source',
};

function rowsFromHubRefresh(): CrmEventRow[] {
  return getHubRefreshEvents()
    .filter(e => e.pvStatus !== 'lost')
    .map(mapHubRefreshToRow);
}

function rowsFromFullExport(): CrmEventRow[] {
  return getFullPvEvents()
    .filter(e => e.pvStatus !== 'lost' && !e.isTest)
    .map(mapFullPvToRow);
}

function rowsFromPfSnapshot(): CrmEventRow[] {
  return PF_EVENTS_SNAPSHOT.events.map(mapPfParsedToRow);
}

function rowsFromDemoSeed(): CrmEventRow[] {
  return PV_PIPELINE_EVENTS.map(mapDemoSeedToRow);
}

function assessPfTextImport(): PfImportStatus & { rows: CrmEventRow[] } {
  if (!PF_EVENTS_SNAPSHOT_AVAILABLE) {
    return {
      completeness: 'FAILED',
      authoritative: false,
      parsedRowCount: 0,
      expectedActiveEvents: 0,
      mismatchSummary: 'PFevents.txt snapshot not imported',
      rows: [],
    };
  }

  const rows = rowsFromPfSnapshot();
  const stored = PF_EVENTS_SNAPSHOT.importStatus;
  if (stored) {
    return { ...stored, rows };
  }

  const expected = PF_EVENTS_SNAPSHOT.summary.activeEvents;
  const parsed = rows.length;
  const metrics = computeCrmMetrics(rows);
  const parsedActive = metrics.find(m => m.id === 'active')?.count ?? 0;

  const summaryAligned =
    parsed > 0 &&
    parsedActive === expected &&
    metrics.find(m => m.id === 'lead')?.count === PF_EVENTS_SNAPSHOT.summary.lead &&
    metrics.find(m => m.id === 'proposal_sent')?.count === PF_EVENTS_SNAPSHOT.summary.proposalSent;

  if (parsed === 0) {
    return {
      completeness: 'FAILED',
      authoritative: false,
      parsedRowCount: 0,
      expectedActiveEvents: expected,
      mismatchSummary: 'PFevents.txt parsed zero event rows',
      rows: [],
    };
  }

  if (parsed >= expected * 0.95 && summaryAligned) {
    return {
      completeness: 'COMPLETE',
      authoritative: true,
      parsedRowCount: parsed,
      expectedActiveEvents: expected,
      mismatchSummary: null,
      rows,
    };
  }

  return {
    completeness: 'PARTIAL',
    authoritative: false,
    parsedRowCount: parsed,
    expectedActiveEvents: expected,
    mismatchSummary: `PFevents.txt partial: ${parsed} parsed row(s) vs ${expected} expected active events`,
    rows,
  };
}

function validateAgainstExpected(rows: CrmEventRow[]): {
  mismatches: CrmValidationMismatch[];
  matches: boolean;
} {
  const metrics = computeCrmMetrics(rows);
  const metricMap = Object.fromEntries(metrics.map(m => [m.id, m])) as Record<string, CrmMetricCard>;
  const mismatches: CrmValidationMismatch[] = [];

  for (const { countKey, dollarKey, label } of PV_EXPECTED_SUMMARY_FIELDS) {
    const metricId =
      countKey === 'activeEvents'
        ? 'active'
        : countKey === 'proposalSent'
          ? 'proposal_sent'
          : countKey === 'completedYtd'
            ? 'completed_ytd'
            : countKey === 'balanceDue'
              ? 'balance_due'
              : countKey;

    const card = metricMap[metricId];
    const expectedCount = PV_EXPECTED_SUMMARY[countKey] as number;
    const expectedDollars = PV_EXPECTED_SUMMARY[dollarKey] as number;
    const actualCount = card?.count ?? 0;
    const actualDollars = card?.dollars ?? 0;

    if (actualCount !== expectedCount) {
      mismatches.push({
        field: countKey,
        label,
        kind: 'count',
        expected: expectedCount,
        actual: actualCount,
        delta: actualCount - expectedCount,
        reason: `Count differs from Perfect Venue reference (${expectedCount})`,
      });
    }
    if (actualDollars !== expectedDollars) {
      mismatches.push({
        field: dollarKey,
        label,
        kind: 'dollars',
        expected: expectedDollars,
        actual: actualDollars,
        delta: actualDollars - expectedDollars,
        reason: `Dollar total differs from Perfect Venue reference ($${expectedDollars.toLocaleString()})`,
      });
    }
  }

  return { mismatches, matches: mismatches.length === 0 };
}

function buildManifest(
  sourceId: CrmEventSourceId,
  rows: CrmEventRow[],
  opts: {
    completeness: CrmImportCompleteness;
    authoritative: boolean;
    importedAt: string | null;
    warningMessage: string | null;
    pfTextStatus: PfImportStatus | null;
    skippedFallbackFrom: CrmEventSourceId | null;
  },
): CrmEventSourceManifest {
  const metrics = computeCrmMetrics(rows);
  const skipPvExpected = sourceId === 'hub-refresh';
  const { mismatches, matches } = skipPvExpected
    ? { mismatches: [], matches: true }
    : validateAgainstExpected(rows);

  return {
    sourceId,
    sourceLabel: SOURCE_LABELS[sourceId],
    completeness: opts.completeness,
    authoritative: opts.authoritative,
    matchesPvExpectedSummary: matches,
    tableSourceId: sourceId,
    metricSourceId: sourceId,
    mixedSources: false,
    warningMessage: opts.warningMessage,
    rowCount: rows.length,
    importedAt: opts.importedAt,
    rows,
    metrics,
    validation: {
      expected: PV_EXPECTED_SUMMARY,
      mismatches,
    },
    pfTextStatus: opts.pfTextStatus,
    skippedFallbackFrom: opts.skippedFallbackFrom,
  };
}

function resolveImportedSource(): CrmEventSourceManifest {
  const staticRefreshRows = rowsFromHubRefresh();
  if (HUB_REFRESH_AVAILABLE && staticRefreshRows.length > 0) {
    return buildManifest('hub-refresh', staticRefreshRows, {
      completeness: 'COMPLETE',
      authoritative: true,
      importedAt: HUB_REFRESH_MANIFEST?.importedAt ?? null,
      warningMessage: null,
      pfTextStatus: null,
      skippedFallbackFrom: null,
    });
  }

  const pf = assessPfTextImport();

  if (pf.completeness === 'COMPLETE') {
    return buildManifest('pfevents-txt', pf.rows, {
      completeness: 'COMPLETE',
      authoritative: true,
      importedAt: PF_EVENTS_SNAPSHOT.importedAt,
      warningMessage: null,
      pfTextStatus: pf,
      skippedFallbackFrom: null,
    });
  }

  const xlsxRows = PV_FULL_EXPORT_AVAILABLE ? rowsFromFullExport() : [];
  if (xlsxRows.length > 0) {
    const pfWarning =
      pf.completeness === 'PARTIAL'
        ? `Perfect Venue text snapshot is incomplete (${pf.parsedRowCount} parsed rows vs ${pf.expectedActiveEvents} expected active events). Showing fallback event data from Perfect Venue XLSX full export (${xlsxRows.length} rows).`
        : null;

    return buildManifest('xlsx-full-export', xlsxRows, {
      completeness: pf.completeness === 'PARTIAL' ? 'FALLBACK' : 'COMPLETE',
      authoritative: true,
      importedAt: PV_FULL_IMPORT_META.importedAt,
      warningMessage: pfWarning,
      pfTextStatus: pf.completeness !== 'FAILED' ? pf : null,
      skippedFallbackFrom: pf.completeness === 'PARTIAL' ? 'pfevents-txt' : null,
    });
  }

  if (pf.rows.length > 0) {
    return buildManifest('pfevents-txt', pf.rows, {
      completeness: 'PARTIAL',
      authoritative: true,
      importedAt: PF_EVENTS_SNAPSHOT.importedAt,
      warningMessage: pf.mismatchSummary,
      pfTextStatus: pf,
      skippedFallbackFrom: null,
    });
  }

  if (!isProductionCRM()) {
    const hasVenueImport = PV_FULL_EXPORT_AVAILABLE || PF_EVENTS_SNAPSHOT_AVAILABLE;
    if (hasVenueImport) {
      const demoRows = rowsFromDemoSeed();
      if (demoRows.length > 0) {
        return buildManifest('demo-seed', demoRows, {
          completeness: 'FALLBACK',
          authoritative: true,
          importedAt: null,
          warningMessage: 'No complete Perfect Venue import available. Using demo seed data.',
          pfTextStatus: pf.completeness !== 'FAILED' ? pf : null,
          skippedFallbackFrom: 'pfevents-txt',
        });
      }
    }
  }

  return buildManifest('none', [], {
    completeness: 'FAILED',
    authoritative: false,
    importedAt: null,
    warningMessage: 'No event data available.',
    pfTextStatus: pf,
    skippedFallbackFrom: null,
  });
}

export interface ResolveCrmEventSourceInput {
  apiRows: CrmEventRow[];
  useApi: boolean;
  /** True when GET /deals failed. */
  apiError?: boolean;
  /** True when GET /deals succeeded but returned zero visible rows. */
  apiEmpty?: boolean;
}

export function resolveCrmEventSource(input: ResolveCrmEventSourceInput): CrmEventSourceManifest {
  if (input.useApi && input.apiRows.length > 0) {
    return buildManifest('live-api', input.apiRows, {
      completeness: 'COMPLETE',
      authoritative: true,
      importedAt: null,
      warningMessage: null,
      pfTextStatus: null,
      skippedFallbackFrom: null,
    });
  }

  if (input.apiEmpty && isProductionCRM()) {
    return buildManifest('none', [], {
      completeness: 'FAILED',
      authoritative: true,
      importedAt: null,
      warningMessage: null,
      pfTextStatus: null,
      skippedFallbackFrom: null,
    });
  }

  if (input.apiError) {
    const imported = resolveImportedSource();
    if (imported.rowCount > 0) {
      return {
        ...imported,
        warningMessage:
          imported.warningMessage ??
          'Live data is temporarily unavailable — showing imported reference events.',
      };
    }
    return buildManifest('none', [], {
      completeness: 'FAILED',
      authoritative: false,
      importedAt: null,
      warningMessage: 'Could not load events from the server.',
      pfTextStatus: null,
      skippedFallbackFrom: null,
    });
  }

  return resolveImportedSource();
}

export function logCrmEventSourceDiagnostics(manifest: CrmEventSourceManifest): void {
  if (!import.meta.env.DEV) return;

  console.group('[CRM Event Source]');
  console.info('Source:', manifest.sourceLabel, `(${manifest.sourceId})`);
  console.info('Completeness:', manifest.completeness);
  console.info('Authoritative:', manifest.authoritative);
  console.info('Matches PV expected summary:', manifest.matchesPvExpectedSummary);
  console.info('Rows:', manifest.rowCount);
  console.info('Metrics/table same source:', !manifest.mixedSources);
  if (manifest.importedAt) console.info('Last import:', manifest.importedAt);
  if (manifest.warningMessage) console.warn('Warning:', manifest.warningMessage);
  if (manifest.validation.mismatches.length) {
    console.table(manifest.validation.mismatches);
  }
  console.groupEnd();
}

export function getCrmEventSourceSummaryLine(manifest: CrmEventSourceManifest): string {
  return `${manifest.sourceLabel} · ${manifest.rowCount} row(s) · ${manifest.completeness}`;
}
