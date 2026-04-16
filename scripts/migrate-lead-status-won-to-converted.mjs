// scripts/migrate-lead-status-won-to-converted.mjs
// ONE-TIME migration: renames the defunct lead status 'Won' → 'Converted'
// introduced in Phase 2A workflow alignment.
//
// Safe to run multiple times — the filter only matches status === 'Won',
// so a re-run on an already-migrated collection will match 0 documents.
//
// Run: node scripts/migrate-lead-status-won-to-converted.mjs

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env (same pattern as seed-admin.mjs) ────────────────────
const envPath = resolve(__dirname, '../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const MONGODB_URI = envVars['MONGODB_URI'];
const DB_NAME     = envVars['DB_NAME'] ?? 'mtte_core';

if (!MONGODB_URI) {
  console.error('[migrate] MONGODB_URI not found in .env');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db    = client.db(DB_NAME);
    const leads = db.collection('leads');

    // Dry-run count first so the log is informative
    const matched = await leads.countDocuments({ status: 'Won' });
    console.log(`[migrate] leads with status 'Won': ${matched}`);

    if (matched === 0) {
      console.log('[migrate] Nothing to do. Exiting.');
      return;
    }

    const result = await leads.updateMany(
      { status: 'Won' },
      { $set: { status: 'Converted', updatedAt: new Date() } },
    );

    console.log(`[migrate] Matched:  ${result.matchedCount}`);
    console.log(`[migrate] Modified: ${result.modifiedCount}`);
    console.log('[migrate] Done.');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
