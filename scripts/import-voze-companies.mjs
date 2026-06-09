// scripts/import-voze-companies.mjs
// Legacy CRM import: companies.csv → `companies` collection (historically VOZE export).
//
// Usage:
//   node scripts/import-voze-companies.mjs --tenant <tenantId>
//
// Options:
//   --tenant <tenantId>   Required. e.g. hub-wichita
//   --dry-run             Preview without writing to the database
//
// Idempotent — safe to run multiple times. Matches on (source, sourceId).

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
  console.error('[import-companies] --tenant <tenantId> is required');
  console.error('  Example: node scripts/import-voze-companies.mjs --tenant hub-wichita');
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
const DB_NAME     = envVars['DB_NAME'] ?? 'hub_crm';

if (!MONGODB_URI) {
  console.error('[import-companies] MONGODB_URI not found in .env');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Lowercases, strips punctuation/extra whitespace.
 * Used only for dedup matching — display name is never mutated.
 */
function normalizeCompanyName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Derive a stable sourceId from the row.
 * Prefers the VOZE Account Id when present; falls back to a name-derived slug
 * so companies without Account Ids still deduplicate correctly across re-runs.
 */
function buildSourceId(row) {
  const accountId = row['Account Id']?.trim();
  if (accountId) return `acct:${accountId}`;
  return `name:${normalizeCompanyName(row['Company Name'])}`;
}

/** Return value only if it is a non-empty string; otherwise undefined. */
function str(v) {
  const s = v?.trim();
  return s || undefined;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const csvPath = resolve(__dirname, '../voze data/companies.csv');
  const raw     = readFileSync(csvPath, 'utf8');
  const rows    = parse(raw, {
    columns:           true,
    skip_empty_lines:  true,
    trim:              true,
    relax_column_count: true,
  });

  console.log(`[import-companies] Parsed ${rows.length} rows`);
  console.log(`[import-companies] Tenant: ${TENANT_ID}${isDryRun ? ' [DRY RUN]' : ''}`);

  let client;
  let companies;

  if (!isDryRun) {
    client    = new MongoClient(MONGODB_URI);
    await client.connect();
    const db  = client.db(DB_NAME);
    companies = db.collection('companies');

    // Indexes — idempotent, no-op if they already exist
    await companies.createIndex(
      { tenantId: 1, source: 1, sourceId: 1 },
      { unique: true, name: 'companies_source_unique' },
    );
    await companies.createIndex(
      { tenantId: 1, nameNormalized: 1 },
      { name: 'companies_name_normalized' },
    );
  }

  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const row of rows) {
    const name = row['Company Name']?.trim();
    if (!name) { skipped++; continue; }

    const sourceId       = buildSourceId(row);
    const nameNormalized = normalizeCompanyName(name);

    const daysSinceRaw  = row['Days Since Last Contact']?.trim();
    const daysSinceLast = daysSinceRaw ? parseInt(daysSinceRaw, 10) : undefined;

    const createdRaw = row['Created']?.trim();

    const doc = {
      tenantId:      TENANT_ID,
      name,
      nameNormalized,
      address: {
        street:     str(row['Address']),
        city:       str(row['City']),
        state:      str(row['State / Province / Region']),
        postalCode: str(row['ZIP / Postal Code']),
      },
      phone:       str(row['Company Phone']),
      source:      'voze',
      sourceId,
      isStub:      false,
      importMeta:  { ...row },
      createdAt:   createdRaw ? new Date(createdRaw) : new Date(),
      updatedAt:   new Date(),
      ...(Number.isFinite(daysSinceLast) ? { daysSinceLastContact: daysSinceLast } : {}),
    };

    if (isDryRun) {
      console.log('[dry-run]', JSON.stringify({ sourceId, name, nameNormalized }));
      inserted++;
      continue;
    }

    try {
      // Atomic upsert — matches on the unique (tenantId, source, sourceId) index.
      // createdAt is only set on first insert to preserve the VOZE origin date.
      const { createdAt, ...rest } = doc;
      const result = await companies.updateOne(
        { tenantId: TENANT_ID, source: 'voze', sourceId },
        {
          $set:         { ...rest },
          $setOnInsert: { createdAt },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) inserted++;
      else                          updated++;
    } catch (err) {
      console.error(`[import-companies] Error on "${name}" (sourceId: ${sourceId}):`, err.message);
      errors++;
    }
  }

  console.log(
    `[import-companies] Complete — inserted: ${inserted}, updated: ${updated}, ` +
    `skipped: ${skipped}, errors: ${errors}`,
  );

  await client?.close();
}

main().catch(err => { console.error('[import-companies] Fatal:', err); process.exit(1); });
