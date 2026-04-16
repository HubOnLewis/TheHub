// scripts/import-voze-activities.mjs
// Imports VOZE activities.csv into the `activities` collection.
//
// Usage:
//   node scripts/import-voze-activities.mjs --tenant <tenantId>
//
// Options:
//   --tenant <tenantId>   Required. e.g. wki-wichita
//   --dry-run             Preview without writing to the database
//
// Run AFTER import-voze-companies.mjs.
// Idempotent — safe to run multiple times. Matches on (source, sourceId).
// Creates stub company records when an activity references an unknown company.

import { MongoClient } from 'mongodb';
import { parse }       from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const tenantIdx = args.indexOf('--tenant');
const isDryRun  = args.includes('--dry-run');

if (tenantIdx === -1 || !args[tenantIdx + 1]) {
  console.error('[import-activities] --tenant <tenantId> is required');
  console.error('  Example: node scripts/import-voze-activities.mjs --tenant wki-wichita');
  process.exit(1);
}

const TENANT_ID = args[tenantIdx + 1];

// ── Load .env ─────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const MONGODB_URI = envVars['MONGODB_URI'];
const DB_NAME     = envVars['DB_NAME'] ?? 'mtte_core';

if (!MONGODB_URI) {
  console.error('[import-activities] MONGODB_URI not found in .env');
  process.exit(1);
}

// ── Activity type normalization ───────────────────────────────────
// Internal enum: call_out | call_in | email_out | email_in |
//                text_out | text_in | visit | event | other

const TYPE_MAP = {
  'outgoing call':         'call_out',
  'outgoing phone call':   'call_out',
  'incoming call':         'call_in',
  'incoming phone call':   'call_in',
  'outgoing email':        'email_out',
  'incoming email':        'email_in',
  'outgoing text message': 'text_out',
  'outgoing text':         'text_out',
  'incoming text message': 'text_in',
  'incoming text':         'text_in',
  'client visit':          'visit',
  'visit':                 'visit',
  'event':                 'event',
  'meeting':               'event',
};

function normalizeActivityType(raw) {
  return TYPE_MAP[raw.toLowerCase().trim()] ?? 'other';
}

// ── Company name normalization ────────────────────────────────────
function normalizeCompanyName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Tag key normalization ─────────────────────────────────────────
// Converts raw VOZE flag labels to camelCase internal keys.
// Examples:
//   "Follow-up"           -> "followUp"
//   "Fuel / Lube"         -> "fuelLube"
//   "Service / Crane Truck" -> "serviceCraneTruck"
//   "Customer Support"    -> "customerSupport"
//   "Quote"               -> "quote"

function normalizeTagKey(raw) {
  return raw
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) =>
      i === 0
        ? word.charAt(0).toLowerCase() + word.slice(1).toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

// ── Note field parser ─────────────────────────────────────────────
//
// VOZE Note format:
//   "Narrative: <text> | Flag One: Yes | Flag Two: Yes"
//
// Returns:
//   { body: string, tags: Record<string, boolean> }
//
// Tag keys are normalized to camelCase before storage.
// Duplicate keys (after normalization) are reduced to a single entry.

function parseNote(note) {
  if (!note || !note.trim()) return { body: '', tags: {} };

  const parts = note.split('|').map(p => p.trim()).filter(Boolean);
  let body = '';
  /** @type {Record<string, boolean>} */
  const tags = {};

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) {
      if (!body) body = part;
      continue;
    }

    const key   = part.slice(0, colonIdx).trim();
    const value = part.slice(colonIdx + 1).trim();

    if (key.toLowerCase() === 'narrative') {
      body = value;
    } else {
      const lval      = value.toLowerCase();
      const normalKey = normalizeTagKey(key);
      tags[normalKey] = lval === 'yes' || lval === 'true';
    }
  }

  return { body, tags };
}

/** Return value only if it is a non-empty string; otherwise undefined. */
function str(v) {
  const s = v?.trim();
  return s || undefined;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const csvPath = resolve(__dirname, '../voze data/activities.csv');
  const raw     = readFileSync(csvPath, 'utf8');
  const rows    = parse(raw, {
    columns:            true,
    skip_empty_lines:   true,
    trim:               true,
    relax_column_count: true,
    relax_quotes:       true,
    quote:              '"',
  });

  console.log(`[import-activities] Parsed ${rows.length} rows`);
  console.log(`[import-activities] Tenant: ${TENANT_ID}${isDryRun ? ' [DRY RUN]' : ''}`);

  let client;
  let activities;
  let companies;

  /** @type {Map<string, string>} normalized name → _id string */
  const companyMap = new Map();

  if (!isDryRun) {
    client     = new MongoClient(MONGODB_URI);
    await client.connect();
    const db   = client.db(DB_NAME);
    activities = db.collection('activities');
    companies  = db.collection('companies');

    // Indexes — idempotent, no-op if already exist
    await activities.createIndex(
      { tenantId: 1, source: 1, sourceId: 1 },
      { unique: true, name: 'activities_source_unique' },
    );
    await activities.createIndex(
      { tenantId: 1, companyId: 1 },
      { name: 'activities_by_company' },
    );
    await activities.createIndex(
      { tenantId: 1, createdAt: -1 },
      { name: 'activities_by_date' },
    );
    await companies.createIndex(
      { tenantId: 1, nameNormalized: 1 },
      { name: 'companies_name_normalized' },
    );

    // Pre-load all companies for this tenant into memory for O(1) lookup
    const allCompanies = await companies.find({ tenantId: TENANT_ID }).toArray();
    for (const c of allCompanies) {
      companyMap.set(c.nameNormalized, c._id.toString());
    }
    console.log(`[import-activities] Loaded ${companyMap.size} companies for name resolution`);
  }

  let inserted = 0;
  let updated  = 0;
  let stubbed  = 0;
  let skipped  = 0;
  let errors   = 0;
  const now    = new Date();

  for (const row of rows) {
    const sourceId       = row['ID']?.trim();
    const companyNameRaw = row['Company']?.trim() ?? '';

    if (!sourceId) { skipped++; continue; }

    // ── Resolve companyId ───────────────────────────────────────
    let companyId;
    const normalized = normalizeCompanyName(companyNameRaw);

    if (normalized) {
      companyId = companyMap.get(normalized);

      // Create a stub company when no match — keeps activities linkable
      if (!companyId && companyNameRaw && !isDryRun) {
        const stubSourceId = `name:${normalized}`;
        const stubBase = {
          tenantId:       TENANT_ID,
          name:           companyNameRaw,
          nameNormalized: normalized,
          source:         'voze',
          sourceId:       stubSourceId,
          isStub:         true,
          importMeta:     {},
          updatedAt:      now,
        };

        try {
          const stubResult = await companies.updateOne(
            { tenantId: TENANT_ID, source: 'voze', sourceId: stubSourceId },
            {
              $set:         stubBase,
              $setOnInsert: { createdAt: now },
            },
            { upsert: true },
          );

          if (stubResult.upsertedId) {
            companyId = stubResult.upsertedId.toString();
            companyMap.set(normalized, companyId);
            stubbed++;
          } else {
            // Was updated (already existed) — fetch its _id
            const existing = await companies.findOne(
              { tenantId: TENANT_ID, source: 'voze', sourceId: stubSourceId },
            );
            if (existing) {
              companyId = existing._id.toString();
              companyMap.set(normalized, companyId);
            }
          }
        } catch (stubErr) {
          console.error(
            `[import-activities] Failed stub for "${companyNameRaw}":`,
            stubErr.message,
          );
        }
      }
    }

    // ── Parse note ──────────────────────────────────────────────
    const rawNote        = row['Note']?.trim() ?? '';
    const { body, tags } = parseNote(rawNote);

    // ── Parse miles ─────────────────────────────────────────────
    const milesRaw       = row['Miles From Company']?.trim();
    const miles          = milesRaw && milesRaw !== '--'
      ? parseFloat(milesRaw)
      : undefined;

    // ── Parse dates ─────────────────────────────────────────────
    const createdDateRaw = row['Created Date']?.trim();
    const createdAt      = createdDateRaw ? new Date(createdDateRaw) : now;

    const activityTypeRaw = row['Type']?.trim() ?? '';

    const doc = {
      tenantId:        TENANT_ID,
      source:          'voze',
      sourceId,
      companyNameRaw,
      activityTypeRaw,
      activityType:    normalizeActivityType(activityTypeRaw),
      createdByName:   str(row['Created By']) ?? '',
      body,
      tags,
      importMeta:      { ...row },
      updatedAt:       now,
      // optional fields — only include when present
      ...(companyId              ? { companyId }                        : {}),
      ...(str(row['Contacts'])   ? { contactNameRaw: str(row['Contacts']) } : {}),
      ...(Number.isFinite(miles) ? { milesFromCompany: miles }          : {}),
    };

    if (isDryRun) {
      console.log('[dry-run]', JSON.stringify({
        sourceId,
        companyNameRaw,
        companyId: companyId ?? '(unresolved)',
        activityType: doc.activityType,
        body: body.slice(0, 60) + (body.length > 60 ? '…' : ''),
        tags,
      }));
      inserted++;
      continue;
    }

    try {
      const result = await activities.updateOne(
        { tenantId: TENANT_ID, source: 'voze', sourceId },
        {
          $set:         { ...doc },
          $setOnInsert: { createdAt },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) inserted++;
      else                          updated++;
    } catch (err) {
      console.error(`[import-activities] Error on row ID ${sourceId}:`, err.message);
      errors++;
    }
  }

  console.log(
    `[import-activities] Complete — inserted: ${inserted}, updated: ${updated}, ` +
    `stubs created: ${stubbed}, skipped: ${skipped}, errors: ${errors}`,
  );

  await client?.close();
}

main().catch(err => { console.error('[import-activities] Fatal:', err); process.exit(1); });
