#!/usr/bin/env node
/**
 * Audit / quarantine cloned MTTE truck records in Mongo for HuB venue tenants.
 *
 * Usage:
 *   npm run audit:hub-contamination
 *   node scripts/hub-contamination.mjs --tenant hub-wichita
 *   node scripts/hub-contamination.mjs --dry-run
 *   node scripts/hub-contamination.mjs --apply
 *
 * Env: MONGODB_URI (required), HUB_TENANT_ID (default hub-wichita)
 */

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveHubTenantIds, defaultHubTenantId } from './lib/hub-tenant-resolve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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

loadEnv();

const STRONG_PHRASES = [
  'mtte', 'wki', 'kenworth', 'pacleas', 'pac lease', 't880', 't380', 'mk0243',
  "myles' water truck", 'myles water truck', 'beran dump', 'platte county',
  'water truck', 'dump truck', 'mechanics truck', 'mechanic truck', 'snow truck',
  'service truck', 'day cab tractor', '4x2 snow', '14k crane', "14' body", 'paclease return',
];

function reasons(doc) {
  const h = [doc.title, doc.company, doc.contact, doc.notes, doc.make, doc.model, doc.stockNumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const out = [];
  if (doc.unitId || (doc.unitIds?.length ?? 0) > 0) out.push('linked equipment unit');
  for (const p of STRONG_PHRASES) if (h.includes(p)) out.push(`matched "${p}"`);
  if (/\btruck\b/.test(h) && !/food truck/.test(h)) out.push('matched "truck"');
  return out;
}

function contaminated(doc) {
  return reasons(doc).length > 0;
}

function parseTenant(argv) {
  const idx = argv.indexOf('--tenant');
  const arg = idx >= 0 ? argv[idx + 1] : process.env.HUB_TENANT_ID || defaultHubTenantId();
  return resolveHubTenantIds(arg);
}

const tenantIds = parseTenant(process.argv.slice(2));
const uri = process.env.MONGODB_URI;
const apply = process.argv.includes('--apply');
const dryRun = process.argv.includes('--dry-run') || !apply;

if (!uri) {
  console.error('[hub-contamination] MONGODB_URI is required');
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();
  const dealsCol = db.collection('deals');
  const unitsCol = db.collection('units');

  const deals = await dealsCol.find({ tenantId: { $in: tenantIds } }).toArray();
  const units = await unitsCol.find({ tenantId: { $in: tenantIds } }).toArray();

  const badDeals = deals.filter(contaminated);
  const badUnits = units.filter(contaminated);

  console.log(`[hub-contamination] Tenant scope: ${tenantIds.join(', ')}`);
  console.log(`[hub-contamination] Deals scanned: ${deals.length} · contaminated: ${badDeals.length}`);
  console.log(`[hub-contamination] Units scanned: ${units.length} · contaminated: ${badUnits.length}`);

  for (const d of badDeals) {
    console.log('—');
    console.log(`DEAL ${d._id}`);
    console.log(`  title:   ${d.title}`);
    console.log(`  company: ${d.company ?? ''}`);
    console.log(`  status:  ${d.status}`);
    console.log(`  amount:  ${d.amount}`);
    console.log(`  created: ${d.createdAt ? new Date(d.createdAt).toISOString() : '—'}`);
    console.log(`  unitId:  ${d.unitId ?? '—'}`);
    console.log(`  why:     ${reasons(d).join('; ')}`);
  }

  for (const u of badUnits) {
    console.log('—');
    console.log(`UNIT ${u._id}`);
    console.log(`  stock: ${u.stockNumber ?? '—'}`);
    console.log(`  make:  ${u.make ?? ''} ${u.model ?? ''}`);
    console.log(`  why:   ${reasons(u).join('; ')}`);
  }

  if (badDeals.length === 0 && badUnits.length === 0) {
    console.log('\n[hub-contamination] ✓ Zero contaminated records in scoped tenant(s).');
  }

  if (dryRun) {
    console.log('\n[hub-contamination] Dry run only — no records changed.');
    if (badDeals.length > 0 || badUnits.length > 0) {
      console.log('Re-run with --apply to quarantine (status → Lost, notes tagged).');
    }
    process.exit(badDeals.length + badUnits.length > 0 ? 1 : 0);
  }

  const now = new Date();
  let quarantined = 0;

  for (const d of badDeals) {
    const tag = '[quarantined-hub-contamination]';
    const notes = String(d.notes ?? '');
    if (d.status === 'Lost' && notes.includes(tag)) continue;
    await dealsCol.updateOne(
      { _id: d._id instanceof ObjectId ? d._id : new ObjectId(String(d._id)) },
      {
        $set: {
          status: 'Lost',
          notes: notes.includes(tag) ? notes : `${tag} ${notes}`.trim(),
          updatedAt: now,
        },
      },
    );
    quarantined += 1;
  }

  for (const u of badUnits) {
    await unitsCol.updateOne(
      { _id: u._id instanceof ObjectId ? u._id : new ObjectId(String(u._id)) },
      {
        $set: {
          status: 'Archived',
          updatedAt: now,
        },
      },
    );
  }

  console.log(`\n[hub-contamination] Applied quarantine to ${quarantined} deal(s) and ${badUnits.length} unit(s).`);
} finally {
  await client.close();
}
