#!/usr/bin/env node
/**
 * Production HuB data audit — deal/payment counts by tenant and refresh import source.
 *
 * Usage:
 *   npm run audit:hub-prod-data
 *   node scripts/audit-hub-prod-data.mjs --tenant hub-wichita
 *
 * Env: MONGODB_URI (required), DB_NAME (default from URI; production API uses hub_crm)
 */

import { MongoClient } from 'mongodb';
import { loadEnv, getMongoDb, parseMongoTarget } from './lib/hub-refresh-utils.mjs';
import {
  defaultHubTenantId,
  resolveHubTenantIds,
  resolvePrimaryHubTenant,
} from './lib/hub-tenant-resolve.mjs';

loadEnv();

const argv = process.argv.slice(2);
const tenantArg =
  argv.includes('--tenant') ? argv[argv.indexOf('--tenant') + 1] : defaultHubTenantId();
const productionTenant = resolvePrimaryHubTenant(tenantArg);
const hubScope = resolveHubTenantIds(productionTenant);

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[audit] MONGODB_URI is required');
  process.exit(1);
}

const mongoTarget = parseMongoTarget(uri);

const REFRESH_OR = [
  { source: 'perfect_venue_refresh' },
  { 'importMeta.source': 'perfect_venue_refresh' },
];

const ACTIVE_STATUSES = new Set(['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build']);

function refreshMatch() {
  return { $or: REFRESH_OR };
}

function sampleDeal(d) {
  return {
    id: String(d._id),
    title: d.title ?? d.name ?? '',
    tenantId: d.tenantId,
    source: d.source ?? d.importMeta?.source ?? '',
    status: d.status,
    eventDate: d.eventDate ?? d.importMeta?.eventDate ?? null,
    grandTotal: d.amount ?? d.grandTotal ?? null,
  };
}

function samplePayment(p) {
  return {
    id: p.id ?? String(p._id),
    tenantId: p.tenantId,
    source: p.source ?? p.importMeta?.source ?? '',
    importBatchId: p.importBatchId ?? p.importMeta?.importBatchId ?? null,
    amount: p.amount ?? null,
    eventId: p.eventId ?? p.pvEventId ?? null,
  };
}

async function countByField(col, field, match = {}) {
  const pipeline = [
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];
  const rows = await col.aggregate(pipeline).toArray();
  return Object.fromEntries(rows.map(r => [String(r._id ?? '(null)'), r.count]));
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = getMongoDb(client);
  const dealsCol = db.collection('deals');
  const paymentsCol = db.collection('hub_payments');
  const usersCol = db.collection('users');

  console.log('\n=== HuB Production Data Audit ===\n');
  console.log('Environment:');
  console.log(`  NODE_ENV:          ${process.env.NODE_ENV ?? '(unset)'}`);
  console.log(`  Mongo host:        ${mongoTarget.host}`);
  console.log(`  Mongo database:    ${mongoTarget.dbName}`);
  console.log(`  TENANT_ID:         ${process.env.TENANT_ID ?? '(unset)'}`);
  console.log(`  HUB_TENANT_ID:     ${process.env.HUB_TENANT_ID ?? '(unset)'}`);
  console.log(`  DEFAULT_TENANT_ID: ${process.env.DEFAULT_TENANT_ID ?? '(unset)'}`);
  console.log(`  Audit scope:       ${hubScope.join(', ')} (canonical: ${productionTenant})`);

  if (mongoTarget.dbName !== 'hub_crm') {
    console.warn(
      `\n  ⚠ Production Render API uses DB_NAME=hub_crm — current audit DB is "${mongoTarget.dbName}".`,
    );
    console.warn('    Refresh import must target hub_crm to appear on production dashboard.\n');
  }

  const jason = await usersCol.findOne({ email: 'jason@hubonlewis.com' });
  const mike = await usersCol.findOne({ email: 'mike@wki.com' });

  console.log('\nSeeded / known users:');
  if (jason) {
    console.log(
      `  Jason Lavender (${jason.email}): tenantId=${jason.tenantId}, role=${jason.role}, location=${jason.location}`,
    );
  } else {
    console.log('  Jason Lavender (jason@hubonlewis.com): not found');
  }
  if (mike) {
    console.log(
      `  Mike (${mike.email}): tenantId=${mike.tenantId}, role=${mike.role}, location=${mike.location}`,
    );
  } else {
    console.log('  Mike (mike@wki.com): not found');
  }

  console.log('\n--- Deals ---');
  const dealsByTenant = await countByField(dealsCol, 'tenantId');
  console.log('Total deals by tenantId:', dealsByTenant);

  const refreshDealsByTenant = await countByField(dealsCol, 'tenantId', refreshMatch());
  console.log('Refresh-import deals by tenantId (perfect_venue_refresh):', refreshDealsByTenant);

  for (const tid of hubScope) {
    const statusCounts = await countByField(dealsCol, 'status', {
      tenantId: tid,
      ...refreshMatch(),
    });
    const activePipeline = await dealsCol.countDocuments({
      tenantId: tid,
      status: { $in: [...ACTIVE_STATUSES] },
      ...refreshMatch(),
    });
    console.log(`\nTenant ${tid} — refresh status counts:`, statusCounts);
    console.log(`Tenant ${tid} — active pipeline (refresh): ${activePipeline}`);
  }

  const refreshSamples = await dealsCol
    .find(refreshMatch())
    .sort({ updatedAt: -1 })
    .limit(10)
    .toArray();
  console.log('\nSample refresh deals (up to 10):');
  for (const d of refreshSamples) {
    console.log(' ', JSON.stringify(sampleDeal(d)));
  }

  console.log('\n--- Payments ---');
  const paymentsByTenant = await countByField(paymentsCol, 'tenantId');
  console.log('Total payments by tenantId:', paymentsByTenant);

  const refreshPaymentsByTenant = await countByField(paymentsCol, 'tenantId', refreshMatch());
  console.log('Refresh payments by tenantId:', refreshPaymentsByTenant);

  const paymentsByBatch = await countByField(paymentsCol, 'importBatchId', refreshMatch());
  console.log('Refresh payments by importBatchId:', paymentsByBatch);

  const paymentCount = await paymentsCol.countDocuments({
    tenantId: { $in: hubScope },
    $or: [
      { importBatchId: { $regex: '^hub-refresh-' } },
      { source: 'perfect_venue_refresh' },
      { 'importMeta.source': 'perfect_venue_refresh' },
    ],
  });
  console.log(`Refresh payments (batch or source): ${paymentCount}`);

  const paymentSamples = await paymentsCol
    .find({
      tenantId: { $in: hubScope },
      $or: [
        { importBatchId: { $regex: '^hub-refresh-' } },
        { source: 'perfect_venue_refresh' },
        { 'importMeta.source': 'perfect_venue_refresh' },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(10)
    .toArray();
  console.log('\nSample refresh payments (up to 10):');
  for (const p of paymentSamples) {
    console.log(' ', JSON.stringify(samplePayment(p)));
  }

  const collections = await db.listCollections().toArray();
  console.log('\n--- Collections (non-zero) ---');
  for (const c of collections) {
    const n = await db.collection(c.name).countDocuments();
    if (n > 0) console.log(`  ${c.name}: ${n}`);
  }

  const totalRefresh = Object.values(refreshDealsByTenant).reduce((a, b) => a + b, 0);
  const prodRefresh =
    (refreshDealsByTenant[productionTenant] ?? 0) +
    (refreshDealsByTenant['hub-on-lewis'] ?? 0);

  console.log('\n--- Summary ---');
  console.log(`  Refresh deals in audit DB: ${totalRefresh}`);
  console.log(`  Refresh deals in HuB scope (${hubScope.join('/')}): ${prodRefresh}`);

  if (totalRefresh === 0) {
    console.log('\n  ✗ No perfect_venue_refresh deals in this database.');
    console.log('    Production import likely never ran against hub_crm.');
    console.log('    Run (with production MONGODB_URI + DB_NAME=hub_crm):');
    console.log('      $env:DB_NAME="hub_crm"; npm run import:hub-refresh:apply');
    process.exit(1);
  }

  const wrongTenant = Object.entries(refreshDealsByTenant).filter(
    ([tid]) => tid !== productionTenant && hubScope.includes(tid),
  );
  if (wrongTenant.some(([tid]) => tid !== productionTenant)) {
    const onLewis = refreshDealsByTenant['hub-on-lewis'] ?? 0;
    const wichita = refreshDealsByTenant['hub-wichita'] ?? 0;
    if (onLewis > 0 && wichita === 0) {
      console.log(
        `\n  ⚠ Refresh deals under hub-on-lewis (${onLewis}) but not hub-wichita — run repair:hub-refresh-tenant`,
      );
    }
  }

  console.log('\n[audit] Complete.');
} finally {
  await client.close();
}
