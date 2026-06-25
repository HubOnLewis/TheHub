#!/usr/bin/env node
/**
 * Validates the CRM event dataset the UI would use (imported mode, no live API).
 * Mirrors packages/web/src/lib/crmEventSource.ts resolution order.
 *
 * Usage: node scripts/validate-crm-event-source.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PV_EXPECTED_SUMMARY, PV_EXPECTED_FIELDS } from './lib/pv-expected-summary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PF_JSON = resolve(ROOT, 'data/perfect-venue-processed/pfevents.parsed.json');
const PF_TS = resolve(ROOT, 'packages/web/src/data/pfEventsSnapshotFlags.ts');
const XLSX_META = resolve(ROOT, 'data/perfect-venue-processed/import-summary.json');

const ACTIVE = new Set(['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due']);

function computeSummary(events) {
  const active = events.filter(e => ACTIVE.has(e.pvStatus));
  const sum = arr => arr.reduce((s, e) => s + (e.value || 0), 0);
  return {
    activeEvents: active.length,
    activeEventsDollars: Math.round(sum(active)),
    lead: events.filter(e => e.pvStatus === 'lead').length,
    leadDollars: Math.round(sum(events.filter(e => e.pvStatus === 'lead'))),
    qualified: events.filter(e => e.pvStatus === 'qualified').length,
    qualifiedDollars: Math.round(sum(events.filter(e => e.pvStatus === 'qualified'))),
    proposalSent: events.filter(e => e.pvStatus === 'proposal_sent').length,
    proposalSentDollars: Math.round(sum(events.filter(e => e.pvStatus === 'proposal_sent'))),
    confirmed: events.filter(e => e.pvStatus === 'confirmed').length,
    confirmedDollars: Math.round(sum(events.filter(e => e.pvStatus === 'confirmed'))),
    balanceDue: events.filter(e => e.pvStatus === 'balance_due').length,
    balanceDueDollars: Math.round(sum(events.filter(e => e.pvStatus === 'balance_due'))),
    completedYtd: events.filter(e => e.pvStatus === 'completed').length,
    completedYtdDollars: Math.round(sum(events.filter(e => e.pvStatus === 'completed'))),
  };
}

function validateActual(actual, sourceName) {
  const mismatches = [];
  for (const [countKey, dollarKey, label] of PV_EXPECTED_FIELDS) {
    const ec = PV_EXPECTED_SUMMARY[countKey];
    const ed = PV_EXPECTED_SUMMARY[dollarKey];
    const ac = actual[countKey];
    const ad = actual[dollarKey];
    if (ac !== ec) {
      mismatches.push({ field: countKey, label, kind: 'count', expected: ec, actual: ac, delta: ac - ec, source: sourceName });
    }
    if (ad !== ed) {
      mismatches.push({ field: dollarKey, label, kind: 'dollars', expected: ed, actual: ad, delta: ad - ed, source: sourceName });
    }
  }
  return mismatches;
}

function loadPfSnapshot() {
  if (existsSync(PF_JSON)) {
    const data = JSON.parse(readFileSync(PF_JSON, 'utf8'));
    return data.snapshot ?? data;
  }
  return null;
}

function loadXlsxSummary() {
  if (!existsSync(XLSX_META)) return null;
  const data = JSON.parse(readFileSync(XLSX_META, 'utf8'));
  return data;
}

function loadXlsxEvents() {
  const path = resolve(ROOT, 'data/perfect-venue-processed/events.normalized.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8'));
}

function resolveUiSource() {
  const pf = loadPfSnapshot();
  const xlsxEvents = loadXlsxEvents();

  if (pf?.importStatus?.completeness === 'COMPLETE' && pf.events?.length) {
    return {
      sourceId: 'pfevents-txt',
      sourceLabel: 'Perfect Venue PFevents.txt import',
      completeness: 'COMPLETE',
      rows: pf.events,
      importedAt: pf.importedAt,
      warning: null,
    };
  }

  if (xlsxEvents.length > 0) {
    const pfPartial = pf?.importStatus?.completeness === 'PARTIAL';
    return {
      sourceId: 'xlsx-full-export',
      sourceLabel: 'Perfect Venue XLSX full export',
      completeness: pfPartial ? 'FALLBACK' : 'COMPLETE',
      rows: xlsxEvents.filter(e => e.pvStatus !== 'lost' && !e.isTest),
      importedAt: loadXlsxSummary()?.importedAt ?? null,
      warning: pfPartial
        ? `PFevents.txt partial (${pf.importStatus.parsedRowCount}/${pf.importStatus.expectedActiveEvents} rows). UI uses XLSX fallback.`
        : null,
    };
  }

  if (pf?.events?.length) {
    return {
      sourceId: 'pfevents-txt',
      sourceLabel: 'Perfect Venue PFevents.txt import (partial)',
      completeness: 'PARTIAL',
      rows: pf.events,
      importedAt: pf.importedAt,
      warning: pf.importStatus?.mismatchSummary,
    };
  }

  return {
    sourceId: 'none',
    sourceLabel: 'No import',
    completeness: 'FAILED',
    rows: [],
    importedAt: null,
    warning: 'No event data found',
  };
}

function main() {
  console.log('\n[validate-crm-event-source] CRM UI dataset validation (imported mode)\n');

  const resolved = resolveUiSource();
  const actual = computeSummary(resolved.rows);
  const mismatches = validateActual(actual, resolved.sourceLabel);

  console.log('Source name:      ', resolved.sourceLabel);
  console.log('Source id:        ', resolved.sourceId);
  console.log('Completeness:     ', resolved.completeness);
  console.log('Row count:        ', resolved.rows.length);
  console.log('Authoritative:    ', resolved.completeness === 'COMPLETE' || resolved.completeness === 'FALLBACK');
  console.log('Safe vs PV ref:   ', mismatches.length === 0 ? 'YES' : 'NO');
  if (resolved.importedAt) console.log('Last import:      ', resolved.importedAt);
  if (resolved.warning) console.log('Warning:          ', resolved.warning);

  console.log('\nActual status counts:');
  console.log(JSON.stringify(actual, null, 2));

  console.log('\nExpected Perfect Venue summary:');
  console.log(JSON.stringify(PV_EXPECTED_SUMMARY, null, 2));

  if (mismatches.length) {
    console.log('\nMISMATCHES:');
    for (const m of mismatches) {
      const exp = m.kind === 'dollars' ? `$${m.expected.toLocaleString()}` : m.expected;
      const act = m.kind === 'dollars' ? `$${m.actual.toLocaleString()}` : m.actual;
      console.log(`  ✗ ${m.label} (${m.kind}): expected ${exp}, actual ${act}, delta ${m.delta > 0 ? '+' : ''}${m.delta}`);
    }
    process.exitCode = 1;
  } else {
    console.log('\n✓ Dataset matches Perfect Venue reference totals.');
  }

  console.log('\nPowers /dashboard and /opportunities when live API is empty.');
  console.log('Metric + table source:', resolved.sourceId, '(same source, no mixing)\n');
}

main();
