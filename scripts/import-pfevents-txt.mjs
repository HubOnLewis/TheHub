#!/usr/bin/env node
/**
 * Perfect Venue PFevents.txt → Hub CRM snapshot (+ optional Mongo upsert).
 *
 * Usage:
 *   npm run import:pfevents              # dry-run (default)
 *   npm run import:pfevents -- --apply   # write TS snapshot + JSON
 *   npm run import:pfevents -- --apply --mongo --tenant hub-on-lewis
 *
 * Input: data/perfect-venue-import/PFevents.txt (or --file path)
 *
 * Duplicate protection: stable sourceKey = normalized(title|contact|date|startTime)
 *
 * Year inference: dates without a year use referenceDate (default 2026-06-23).
 * Raw date text is preserved in importNotes when year is inferred.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { PV_EXPECTED_SUMMARY, PV_EXPECTED_FIELDS } from './lib/pv-expected-summary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_INPUT = resolve(ROOT, 'data/perfect-venue-import/PFevents.txt');
const OUT_JSON = resolve(ROOT, 'data/perfect-venue-processed/pfevents.parsed.json');
const OUT_TS = resolve(ROOT, 'packages/web/src/data/pfEventsSnapshotFlags.ts');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY_RUN = !APPLY;
const MONGO = args.includes('--mongo');
const fileArgIdx = args.indexOf('--file');
const INPUT = fileArgIdx >= 0 ? resolve(args[fileArgIdx + 1]) : DEFAULT_INPUT;
const tenantIdx = args.indexOf('--tenant');
const TENANT = tenantIdx >= 0 ? args[tenantIdx + 1] : 'hub-on-lewis';
const refIdx = args.indexOf('--reference-date');
const REFERENCE_DATE = refIdx >= 0 ? args[refIdx + 1] : '2026-06-23';

const EXPECTED = PV_EXPECTED_SUMMARY;

const STATUS_LINES = new Set([
  'Lead',
  'Qualified',
  'Proposal Sent',
  'Confirmed',
  'Balance Due',
  'Completed',
  'Completed YTD',
  'Lost',
  'Archived',
]);

const SUMMARY_LABELS = [
  ['activeEvents', 'Active Events'],
  ['lead', 'Lead'],
  ['qualified', 'Qualified'],
  ['proposalSent', 'Proposal Sent'],
  ['confirmed', 'Confirmed'],
  ['balanceDue', 'Balance Due'],
  ['completedYtd', 'Completed YTD'],
];

function parseMoney(s) {
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function mapStatus(raw) {
  const s = String(raw).trim();
  if (s === 'Lead') return 'lead';
  if (s === 'Qualified') return 'qualified';
  if (s === 'Proposal Sent') return 'proposal_sent';
  if (s === 'Confirmed') return 'confirmed';
  if (/balance/i.test(s)) return 'balance_due';
  if (/completed/i.test(s)) return 'completed';
  if (/lost|archived/i.test(s)) return 'lost';
  return 'qualified';
}

function slugId(prefix, raw) {
  const h = createHash('sha256').update(raw).digest('hex').slice(0, 12);
  return `${prefix}-${h}`;
}

function normalizeKey(title, contact, dateIso, startTime) {
  const raw = [title, contact, dateIso ?? '', startTime ?? '']
    .map(s => String(s).trim().toLowerCase())
    .join('|');
  return createHash('sha256').update(raw).digest('hex');
}

function parseSummary(lines) {
  const summary = {
    activeEvents: 0,
    activeEventsDollars: 0,
    lead: 0,
    leadDollars: 0,
    qualified: 0,
    qualifiedDollars: 0,
    proposalSent: 0,
    proposalSentDollars: 0,
    confirmed: 0,
    confirmedDollars: 0,
    balanceDue: 0,
    balanceDueDollars: 0,
    completedYtd: 0,
    completedYtdDollars: 0,
  };

  const labelToKey = Object.fromEntries(SUMMARY_LABELS.map(([key, label]) => [label, key]));

  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\d+$/.test(lines[i])) continue;
    const count = parseInt(lines[i], 10);
    const label = lines[i + 1];
    const key = labelToKey[label];
    if (!key) continue;
    summary[key] = count;
    const maybeDollar = lines[i + 2];
    if (maybeDollar?.startsWith('$')) {
      summary[`${key}Dollars`] = parseMoney(maybeDollar);
    }
  }
  return summary;
}

function isDateLine(line) {
  return /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/i.test(line);
}

function isTimeLine(line) {
  return /\d{1,2}:\d{2}\s*(am|pm)/i.test(line);
}

function isMoneyLine(line) {
  return /^\$[\d,]+(\.\d{2})?$/.test(line.trim());
}

function isGuestLine(line) {
  return /^\d{1,4}$/.test(line.trim());
}

function inferYear(monthIndex, day, ref) {
  const refD = new Date(`${ref}T12:00:00`);
  const y = refD.getFullYear();
  const candidate = new Date(y, monthIndex, day, 12);
  if (candidate < refD) return y + 1;
  return y;
}

function parseDateLine(line, ref) {
  const raw = line.trim();
  const withYear = raw.match(
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i,
  );
  if (withYear) {
    const d = new Date(`${withYear[2]} ${withYear[3]}, ${withYear[4]} 12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return { iso: d.toISOString().slice(0, 10), display: raw, inferred: false };
    }
  }
  const noYear = raw.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+([A-Za-z]+)\s+(\d{1,2})$/i);
  if (noYear) {
    const monthIndex = new Date(`${noYear[2]} 1, 2000`).getMonth();
    const day = parseInt(noYear[3], 10);
    const year = inferYear(monthIndex, day, ref);
    const d = new Date(year, monthIndex, day, 12);
    return {
      iso: d.toISOString().slice(0, 10),
      display: raw,
      inferred: true,
      note: `Year ${year} inferred from reference date ${ref}`,
    };
  }
  const short = raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (short) {
    const year = short[3] ? parseInt(short[3], 10) : inferYear(new Date(`${short[1]} 1, 2000`).getMonth(), parseInt(short[2], 10), ref);
    const d = new Date(`${short[1]} ${short[2]}, ${year} 12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return {
        iso: d.toISOString().slice(0, 10),
        display: raw,
        inferred: !short[3],
        note: short[3] ? undefined : `Year ${year} inferred from reference date ${ref}`,
      };
    }
  }
  return { iso: null, display: raw, inferred: false };
}

function parseStartTime(timeRange) {
  const m = String(timeRange).match(/^(\d{1,2}:\d{2}\s*(?:am|pm))/i);
  return m ? m[1].trim() : '';
}

function parseEvents(lines, ref) {
  let start = -1;
  for (let idx = lines.length - 1; idx >= 0; idx--) {
    if (lines[idx] === 'Active Events') {
      start = idx + 1;
      break;
    }
  }
  if (start < 0) start = 0;

  const events = [];
  let i = start;
  while (i < lines.length) {
    while (i < lines.length && (!lines[i] || STATUS_LINES.has(lines[i]))) i++;
    if (i >= lines.length) break;

    const title = lines[i];
    if (!title || STATUS_LINES.has(title) || ['Logo', 'Home', 'Inbox', 'Calendar', 'Tasks', 'Express Book', 'Reports', 'Settings'].includes(title)) {
      i++;
      continue;
    }
    if (i + 1 >= lines.length) break;
    const contact = lines[i + 1];
    if (!contact || STATUS_LINES.has(contact) || isDateLine(contact)) {
      i++;
      continue;
    }

    let j = i + 2;
    while (j < lines.length && !lines[j]) j++;
    if (j >= lines.length || !STATUS_LINES.has(lines[j])) {
      i++;
      continue;
    }

    const statusRaw = lines[j++];
    while (j < lines.length && !lines[j]) j++;
    if (j >= lines.length || !isDateLine(lines[j])) {
      i++;
      continue;
    }
    const dateParsed = parseDateLine(lines[j++], ref);
    while (j < lines.length && !lines[j]) j++;
    if (j >= lines.length || !isTimeLine(lines[j])) {
      i++;
      continue;
    }
    const timeRange = lines[j++];
    const startTime = parseStartTime(timeRange);

    let guests = 0;
    let space = '';
    let value = 0;
    let lastContactedDisplay = '';
    let createdDisplay = '';
    const notes = [];
    if (dateParsed.inferred && dateParsed.note) notes.push(dateParsed.note);

    while (j < lines.length) {
      while (j < lines.length && !lines[j]) j++;
      if (j >= lines.length) break;
      const line = lines[j];

      if (STATUS_LINES.has(line)) break;
      if (isDateLine(line)) break;

      if (isGuestLine(line) && guests === 0) {
        guests = parseInt(line, 10);
        j++;
        continue;
      }
      if (isMoneyLine(line)) {
        value = parseMoney(line);
        j++;
        if (lines[j] === 'Grand Total') j++;
        continue;
      }
      if (line === 'Grand Total') {
        j++;
        continue;
      }
      if (guests > 0 && !space && !isMoneyLine(line) && !/ago$/i.test(line) && !/^[A-Za-z]{3}\s+\d/.test(line) && !isGuestLine(line)) {
        space = line;
        j++;
        continue;
      }
      if (/ago$/i.test(line)) {
        if (!createdDisplay) lastContactedDisplay = line;
        else createdDisplay = createdDisplay ? `${createdDisplay} · ${line}` : line;
        j++;
        continue;
      }
      if (/^[A-Za-z]{3}\s+\d{1,2}/.test(line)) {
        const chunk = line;
        j++;
        const rel = lines[j] && /ago$/i.test(lines[j]) ? lines[j++] : '';
        const display = rel ? `${chunk} · ${rel}` : chunk;
        if (!lastContactedDisplay) lastContactedDisplay = display;
        else createdDisplay = display;
        continue;
      }
      j++;
    }

    const sourceKey = normalizeKey(title, contact, dateParsed.iso, startTime);
    const importNotes = notes.length ? notes.join('; ') : undefined;

    events.push({
      id: slugId('pfe', sourceKey),
      sourceKey,
      title: title.trim(),
      contact: contact.trim(),
      pvStatus: mapStatus(statusRaw),
      eventDateIso: dateParsed.iso,
      eventDateDisplay: dateParsed.display,
      timeRange,
      guests,
      space,
      value,
      lastContactedIso: null,
      lastContactedDisplay,
      createdIso: null,
      createdDisplay,
      owner: '',
      importNotes,
    });

    i = j;
  }
  return events;
}

function computeParsedSummary(events) {
  const activeStatuses = new Set(['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due']);
  const active = events.filter(e => activeStatuses.has(e.pvStatus));
  const sum = (arr) => arr.reduce((s, e) => s + (e.value || 0), 0);
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

function validateSummary(fileSummary, parsedSummary, eventCount) {
  const mismatches = [];

  for (const [countKey, dollarKey, label] of PV_EXPECTED_FIELDS) {
    const expectedCount = EXPECTED[countKey];
    const expectedDollars = EXPECTED[dollarKey];
    const fileCount = fileSummary[countKey];
    const fileDollars = fileSummary[dollarKey];
    const parsedCount = parsedSummary[countKey];
    const parsedDollars = parsedSummary[dollarKey];

    if (fileCount !== expectedCount) {
      mismatches.push({
        field: countKey,
        label,
        expected: expectedCount,
        fileSummary: fileCount,
        parsed: parsedCount,
        reason: 'File summary block differs from Perfect Venue reference totals',
      });
    }
    if (fileDollars !== expectedDollars) {
      mismatches.push({
        field: dollarKey,
        label,
        expected: expectedDollars,
        fileSummary: fileDollars,
        parsed: parsedDollars,
        reason: 'File summary dollars differ from Perfect Venue reference totals',
      });
    }
    if (parsedCount !== fileCount) {
      mismatches.push({
        field: countKey,
        label,
        expected: fileCount,
        parsed: parsedCount,
        reason: `Only ${eventCount} event row(s) parsed from text — export likely truncated (scroll full list in Perfect Venue)`,
      });
    }
    if (parsedDollars !== fileDollars && fileDollars > 0) {
      mismatches.push({
        field: dollarKey,
        label,
        expected: fileDollars,
        parsed: parsedDollars,
        reason: 'Parsed event dollar totals do not match file summary (partial row export)',
      });
    }
  }
  return mismatches;
}

function computeImportStatus(events, fileSummary, parsedSummary) {
  const expected = fileSummary.activeEvents || 0;
  const parsed = events.length;
  const parsedActive = parsedSummary.activeEvents;

  if (parsed === 0) {
    return {
      completeness: 'FAILED',
      authoritative: false,
      parsedRowCount: 0,
      expectedActiveEvents: expected,
      mismatchSummary: 'PFevents.txt parsed zero event rows',
      safeToUseAsAuthoritative: false,
    };
  }

  const rowsMatchSummary =
    parsed >= expected * 0.95 &&
    parsedActive === expected &&
    parsedSummary.lead === fileSummary.lead &&
    parsedSummary.proposalSent === fileSummary.proposalSent;

  if (rowsMatchSummary) {
    return {
      completeness: 'COMPLETE',
      authoritative: true,
      parsedRowCount: parsed,
      expectedActiveEvents: expected,
      mismatchSummary: null,
      safeToUseAsAuthoritative: true,
    };
  }

  return {
    completeness: 'PARTIAL',
    authoritative: false,
    parsedRowCount: parsed,
    expectedActiveEvents: expected,
    mismatchSummary: `PFevents.txt partial: ${parsed} parsed row(s) vs ${expected} expected active events`,
    safeToUseAsAuthoritative: false,
  };
}

function mapPvToDealStatus(pvStatus) {
  switch (pvStatus) {
    case 'lead':
      return 'Draft';
    case 'qualified':
      return 'Pending Approval';
    case 'proposal_sent':
      return 'Approved';
    case 'confirmed':
    case 'balance_due':
      return 'Won';
    case 'completed':
      return 'Delivered';
    default:
      return 'Approved';
  }
}

async function upsertMongo(events, stats) {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error('[pfevents] .env not found — cannot run --mongo');
    process.exit(1);
  }
  const envVars = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
  const uri = envVars.MONGODB_URI;
  const dbName = envVars.DB_NAME ?? 'hub_crm';
  if (!uri) {
    console.error('[pfevents] MONGODB_URI missing');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('deals');

  for (const e of events) {
    const externalKey = `pfevents:${e.sourceKey}`;
    const existing = await col.findOne({ tenantId: TENANT, 'importMeta.sourceKey': e.sourceKey });
    const doc = {
      tenantId: TENANT,
      title: e.title,
      company: e.contact,
      contact: e.contact,
      amount: e.value,
      status: mapPvToDealStatus(e.pvStatus),
      notes: [e.importNotes, `Imported from PFevents.txt · ${externalKey}`].filter(Boolean).join('\n'),
      importMeta: {
        source: 'pfevents.txt',
        sourceKey: e.sourceKey,
        eventDateIso: e.eventDateIso,
        timeRange: e.timeRange,
        guests: e.guests,
        space: e.space,
        pvStatus: e.pvStatus,
      },
      updatedAt: new Date(),
    };
    try {
      if (existing) {
        if (DRY_RUN) {
          stats.updated++;
          console.log(`  [update] ${e.title} (matched sourceKey)`);
        } else {
          await col.updateOne({ _id: existing._id, tenantId: TENANT }, { $set: doc });
          stats.updated++;
          console.log(`  [updated] ${e.title}`);
        }
      } else {
        if (DRY_RUN) {
          stats.created++;
          console.log(`  [create] ${e.title}`);
        } else {
          await col.insertOne({ ...doc, createdAt: new Date() });
          stats.created++;
          console.log(`  [created] ${e.title}`);
        }
      }
    } catch (err) {
      stats.failed++;
      console.error(`  [failed] ${e.title}: ${err.message}`);
    }
  }
  await client.close();
}

function writeTs(snapshot) {
  const ts = `/**
 * AUTO-GENERATED by scripts/import-pfevents-txt.mjs — do not edit by hand.
 * Re-run: npm run import:pfevents -- --apply
 */
import type { PfEventsSnapshot } from './pfEventsTypes.js';

export const PF_EVENTS_SNAPSHOT_AVAILABLE = true;

export const PF_EVENTS_SNAPSHOT: PfEventsSnapshot = ${JSON.stringify(snapshot, null, 2)};
`;
  writeFileSync(OUT_TS, ts, 'utf8');
}

async function main() {
  console.log(`\n[pfevents] Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`[pfevents] Input: ${INPUT}`);
  if (!existsSync(INPUT)) {
    console.error('[pfevents] Input file not found');
    process.exit(1);
  }

  const text = readFileSync(INPUT, 'utf8');
  const lines = text.split(/\r?\n/).map(l => l.trim());

  const fileSummary = parseSummary(lines);
  const events = parseEvents(lines, REFERENCE_DATE);
  const parsedSummary = computeParsedSummary(events);
  const mismatches = validateSummary(fileSummary, parsedSummary, events.length);
  const importStatus = computeImportStatus(events, fileSummary, parsedSummary);

  const snapshot = {
    importedAt: new Date().toISOString(),
    sourceFile: INPUT.replace(ROOT + '\\', '').replace(ROOT + '/', ''),
    referenceDate: REFERENCE_DATE,
    summary: fileSummary,
    events,
    importStatus,
  };

  console.log('\n[pfevents] Parsed events:', events.length);
  console.log('[pfevents] Import status:', importStatus.completeness);
  console.log('[pfevents] Authoritative:', importStatus.authoritative ? 'YES' : 'NO');
  console.log('[pfevents] Safe for UI as single source:', importStatus.safeToUseAsAuthoritative ? 'YES' : 'NO');
  console.log('[pfevents] File summary:', JSON.stringify(fileSummary, null, 2));
  console.log('[pfevents] Parsed summary:', JSON.stringify(parsedSummary, null, 2));

  if (mismatches.length) {
    console.log('\n[pfevents] VALIDATION MISMATCHES:');
    for (const m of mismatches) {
      console.log(`  ✗ ${m.field}: expected ${m.expected}, got parsed=${m.parsed ?? 'n/a'}, file=${m.fileSummary ?? 'n/a'}`);
      console.log(`    → ${m.reason}`);
    }
  } else {
    console.log('\n[pfevents] Validation: all counts and dollars match.');
  }

  const mongoStats = { created: 0, updated: 0, skipped: 0, failed: 0 };

  if (MONGO) {
    console.log(`\n[pfevents] Mongo upsert tenant=${TENANT} (${DRY_RUN ? 'dry-run' : 'apply'})…`);
    try {
      await upsertMongo(events, mongoStats);
    } catch (err) {
      console.error('[pfevents] Mongo failed:', err.message);
      mongoStats.failed = events.length;
    }
    console.log('[pfevents] Mongo:', mongoStats);
  }

  if (DRY_RUN) {
    console.log('\n[pfevents] Dry-run complete — no files written. Use --apply to commit snapshot.');
    return;
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify({ snapshot, parsedSummary, mismatches, importStatus, mongoStats }, null, 2),
  );
  writeTs(snapshot);
  console.log('\n[pfevents] Wrote:', OUT_TS);
  console.log('[pfevents] Wrote:', OUT_JSON);
}

main().catch(err => {
  console.error('[pfevents] Failed:', err);
  process.exit(1);
});
