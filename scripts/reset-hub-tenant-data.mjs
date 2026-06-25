#!/usr/bin/env node
/**
 * Controlled HuB on Lewis tenant data reset — backup, audit, optional apply.
 *
 * Usage:
 *   npm run reset:hub-data:audit
 *   npm run reset:hub-data:dry-run
 *   npm run reset:hub-data:apply
 *   node scripts/reset-hub-tenant-data.mjs --tenant hub-wichita --dry-run
 *   node scripts/reset-hub-tenant-data.mjs --tenant hub-on-lewis --apply
 *
 * Never deletes users/auth without --include-users (not implemented).
 */

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveHubTenantIds, defaultHubTenantId } from './lib/hub-tenant-resolve.mjs';
import { backupArtifactFiles, writeEmptyImportArtifacts } from './lib/hub-reset-artifacts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PROTECTED_COLLECTIONS = new Set(['users']);

const PURGE_COLLECTIONS = [
  'deals',
  'leads',
  'companies',
  'units',
  'builds',
  'build_versions',
  'change_orders',
  'production_jobs',
  'production_tasks',
  'delivery_records',
  'delivery_packets',
  'post_delivery_follow_ups',
  'closeout_checklists',
  'interactions',
  'activities',
  'account_plans',
  'weekly_cadence_reviews',
  'karmak_sync',
];

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const tenantIdx = argv.indexOf('--tenant');
  const tenant = tenantIdx >= 0 ? argv[tenantIdx + 1] : defaultHubTenantId();
  const apply = argv.includes('--apply');
  const audit = argv.includes('--audit') || (!apply && !argv.includes('--dry-run'));
  const dryRun = !apply;
  return { tenant, apply, audit, dryRun };
}

function summarizeDoc(doc) {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId ?? null,
    title: doc.title ?? doc.name ?? doc.subject ?? null,
    company: doc.company ?? null,
    status: doc.status ?? null,
    amount: doc.amount ?? null,
    unitId: doc.unitId ?? null,
    importMeta: doc.importMeta ?? null,
    source: doc.source ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

loadEnv();

const { tenant, apply, dryRun } = parseArgs(process.argv.slice(2));
const tenantIds = resolveHubTenantIds(tenant);
const uri = process.env.MONGODB_URI;
const resetAt = new Date().toISOString();
const stamp = resetAt.replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(ROOT, 'data/backups', `${tenantIds[0]}-reset-${stamp}`);

console.log('\n[hub-reset] HuB tenant controlled data reset');
console.log(`[hub-reset] Mode: ${apply ? 'APPLY (destructive)' : 'AUDIT / DRY-RUN'}`);
console.log(`[hub-reset] Tenant scope: ${tenantIds.join(', ')}`);

const report = {
  resetAt,
  mode: apply ? 'apply' : 'dry-run',
  tenantIds,
  mongo: { collections: {}, manualReview: [], backupPath: null, deleted: {} },
  artifacts: null,
};

// ── Mongo audit/backup/purge ───────────────────────────────────────
if (!uri) {
  console.warn('[hub-reset] MONGODB_URI not set — skipping Mongo purge (frontend artifacts only).');
} else {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const backupPayload = { resetAt, tenantIds, collections: {} };
    let backupOk = true;

    for (const name of PURGE_COLLECTIONS) {
      if (PROTECTED_COLLECTIONS.has(name)) continue;
      const col = db.collection(name);
      const cursor = col.find({ tenantId: { $in: tenantIds } });
      const docs = await cursor.toArray();
      report.mongo.collections[name] = docs.length;
      backupPayload.collections[name] = docs.map(d => ({ summary: summarizeDoc(d), raw: d }));

      const untagged = await col.countDocuments({
        tenantId: { $exists: false },
      });
      if (untagged > 0) {
        report.mongo.manualReview.push({
          collection: name,
          count: untagged,
          reason: 'records without tenantId — not deleted',
        });
      }

      console.log(`[hub-reset] ${name}: ${docs.length} tenant-scoped record(s)`);
    }

    mkdirSync(backupDir, { recursive: true });
    const backupFile = resolve(backupDir, 'mongo-tenant-records.json');
    try {
      writeFileSync(backupFile, JSON.stringify(backupPayload, null, 2));
      report.mongo.backupPath = backupFile;
      console.log(`[hub-reset] Mongo backup: ${backupFile}`);
    } catch (err) {
      backupOk = false;
      console.error('[hub-reset] Mongo backup FAILED:', err.message);
    }

    if (apply) {
      if (!backupOk) {
        console.error('[hub-reset] Aborting Mongo purge — backup failed.');
        process.exit(1);
      }
      for (const name of PURGE_COLLECTIONS) {
        const col = db.collection(name);
        const result = await col.deleteMany({ tenantId: { $in: tenantIds } });
        report.mongo.deleted[name] = result.deletedCount ?? 0;
        console.log(`[hub-reset] Deleted ${report.mongo.deleted[name]} from ${name}`);
      }
    }
  } finally {
    await client.close();
  }
}

// ── Frontend artifact backup + clear ─────────────────────────────────
mkdirSync(backupDir, { recursive: true });
try {
  const artifactBackup = backupArtifactFiles(backupDir);
  console.log(`[hub-reset] Artifact files backed up: ${artifactBackup.length}`);
  report.artifacts = { backedUp: artifactBackup.length };

  if (apply) {
    const cleared = writeEmptyImportArtifacts({ resetAt, tenantIds });
    report.artifacts = { ...report.artifacts, ...cleared };
    console.log('[hub-reset] Cleared generated PV import artifacts (empty import state).');
    console.log(`[hub-reset] Reset manifest: ${cleared.manifestPath}`);
  } else {
    console.log('[hub-reset] Dry-run — generated import files NOT cleared.');
  }
} catch (err) {
  console.error('[hub-reset] Artifact step failed:', err.message);
  if (apply) process.exit(1);
}

writeFileSync(resolve(backupDir, 'reset-report.json'), JSON.stringify(report, null, 2));
console.log(`\n[hub-reset] Report: ${resolve(backupDir, 'reset-report.json')}`);

if (dryRun) {
  console.log('\n[hub-reset] Dry-run complete. Re-run with --apply to purge tenant data.');
  console.log('  npm run reset:hub-data:apply');
} else {
  console.log('\n[hub-reset] APPLY complete.');
  console.log('[hub-reset] Next: drop fresh Perfect Venue XLSX/PFevents files → npm run import:perfect-venue');
  console.log('[hub-reset] Browser: Settings → Demo Controls → Reset local demo/cache data');
}
