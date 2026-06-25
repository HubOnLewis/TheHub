#!/usr/bin/env node
/**
 * Validate HuB Perfect Venue refresh import artifacts.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { contaminationHit } from './lib/hub-refresh-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'data/perfect-venue-processed/hub-refresh');

function loadJson(name) {
  const p = resolve(OUT_DIR, name);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

const summary = loadJson('import-summary.json');
const events = loadJson('events.normalized.json') ?? [];
const payments = loadJson('payments.normalized.json') ?? [];
const unmatched = loadJson('unmatched-records.json') ?? [];
const warnings = loadJson('warnings.json') ?? [];

if (!summary) {
  console.error('[validate:hub-refresh] No import artifacts — run npm run import:hub-refresh:dry-run first');
  process.exit(1);
}

const errors = [];
const reportWarnings = [];
const pvIdCounts = new Map();
for (const e of events) {
  if (e.pvId) pvIdCounts.set(e.pvId, (pvIdCounts.get(e.pvId) ?? 0) + 1);
  if (!e.eventDateIso && e.pvStatus !== 'lost' && e.pvStatus !== 'completed') {
    reportWarnings.push(`Missing date: ${e.title} (${e.pvId})`);
  }
  if (!e.contact) {
    reportWarnings.push(`Missing contact: ${e.title} (${e.pvId})`);
  }
  const finDelta = Math.abs((e.grandTotal ?? 0) - (e.amountPaid ?? 0) - (e.balanceDue ?? 0));
  if (e.grandTotal > 0 && finDelta > 0.05) {
    errors.push(`Financial mismatch: ${e.title} total=${e.grandTotal} paid=${e.amountPaid} due=${e.balanceDue}`);
  }
  const text = [e.title, e.company, e.contact].join(' ');
  const hit = contaminationHit(text);
  if (hit) errors.push(`Contamination (${hit}): ${e.title}`);
}

for (const p of payments) {
  const hit = contaminationHit([p.eventName, p.payer].join(' '));
  if (hit) errors.push(`Contamination in payment (${hit}): ${p.eventName}`);
}

const dupPvIds = [...pvIdCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id);

console.log('\n[validate:hub-refresh] HuB refresh import validation');
console.log(`  Events:           ${events.length}`);
console.log(`  Unique PV IDs:    ${summary.uniquePvIds}`);
console.log(`  Duplicate PV IDs: ${dupPvIds.length}`);
console.log(`  Payments:         ${payments.length}`);
console.log(`  Unmatched:        ${unmatched.length}`);
console.log(`  Warnings:         ${warnings.length}`);
console.log(`  By status:`, summary.byStatus);
console.log(`  Financial totals:`, summary.financialTotals);
console.log(`  Contamination:    ${summary.contaminationCount === 0 ? 'PASS' : 'FAIL'}`);

if (dupPvIds.length) {
  console.warn(`  Duplicate PV IDs: ${dupPvIds.join(', ')}`);
}

const byMonth = {};
for (const e of events) {
  if (!e.eventDateIso) continue;
  const m = e.eventDateIso.slice(0, 7);
  byMonth[m] = (byMonth[m] ?? 0) + 1;
}
console.log('  Count by month:', byMonth);

if (errors.length) {
  console.error(`\n[validate:hub-refresh] ${errors.length} blocking issue(s):`);
  for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
  process.exit(1);
}

if (reportWarnings.length) {
  console.warn(`\n[validate:hub-refresh] ${reportWarnings.length} warning(s) (non-blocking):`);
  for (const w of reportWarnings.slice(0, 15)) console.warn(`  - ${w}`);
}

console.log('\n[validate:hub-refresh] ✓ Validation passed.');
process.exit(0);
