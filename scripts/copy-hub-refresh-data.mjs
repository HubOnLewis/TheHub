#!/usr/bin/env node
/**
 * Copy HuB refresh import data from SOURCE Mongo to TARGET Mongo.
 * Use when local import landed on the wrong cluster/URI vs production Render.
 *
 * Usage:
 *   # Source = .env MONGODB_URI + DB_NAME (has refresh data)
 *   $env:TARGET_MONGODB_URI="mongodb+srv://...production..."
 *   $env:TARGET_DB_NAME="hub_crm"
 *   npm run copy:hub-refresh-data:dry-run
 *   npm run copy:hub-refresh-data:apply
 */

import { MongoClient } from 'mongodb';
import { loadEnv, getMongoDb, parseMongoTarget } from './lib/hub-refresh-utils.mjs';
import { resolvePrimaryHubTenant } from './lib/hub-tenant-resolve.mjs';

loadEnv();

const apply = process.argv.includes('--apply');
const sourceUri = process.env.MONGODB_URI;
const targetUri = process.env.TARGET_MONGODB_URI;
const sourceDbName = process.env.DB_NAME?.trim();
const targetDbName = (process.env.TARGET_DB_NAME || process.env.DB_NAME || 'hub_crm').trim();
const targetTenant = resolvePrimaryHubTenant(
  process.argv.includes('--tenant') ? process.argv[process.argv.indexOf('--tenant') + 1] : undefined,
);

if (!sourceUri || !targetUri) {
  console.error('[copy] MONGODB_URI (source) and TARGET_MONGODB_URI (target) are required');
  process.exit(1);
}

const sourceTarget = parseMongoTarget(sourceUri);
const destTarget = { ...parseMongoTarget(targetUri), dbName: targetDbName };

const REFRESH_FILTER = {
  $or: [{ source: 'perfect_venue_refresh' }, { 'importMeta.source': 'perfect_venue_refresh' }],
};
const PAYMENT_FILTER = {
  $or: [
    { importBatchId: { $regex: '^hub-refresh-' } },
    { source: 'perfect_venue_refresh' },
    { 'importMeta.source': 'perfect_venue_refresh' },
  ],
};

const TARGET_REFRESH_DEAL_COUNT = {
  tenantId: targetTenant,
  ...REFRESH_FILTER,
};
const TARGET_REFRESH_PAYMENT_COUNT = {
  tenantId: targetTenant,
  ...PAYMENT_FILTER,
};

function getDb(client, name) {
  return name ? client.db(name) : client.db();
}

function toDate(val, fallback) {
  if (val == null) return fallback;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Strip fields that must not appear in $set during upsert. */
function buildSafeUpsertDoc(sourceDoc, extraSet = {}) {
  const { _id, createdAt, updatedAt, ...rest } = sourceDoc;
  const now = new Date();
  return {
    update: {
      $set: {
        ...rest,
        ...extraSet,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: toDate(createdAt, now),
      },
    },
  };
}

function buildDealFilter(deal, tenantId) {
  const sourceKey = deal.importMeta?.sourceKey;
  if (sourceKey != null && String(sourceKey).trim() !== '') {
    return { tenantId, 'importMeta.sourceKey': String(sourceKey) };
  }
  const pvEventId = deal.importMeta?.pvEventId;
  if (pvEventId != null && String(pvEventId).trim() !== '') {
    return { tenantId, 'importMeta.pvEventId': String(pvEventId) };
  }
  const payPvId = deal.importMeta?.pvId;
  if (payPvId != null && String(payPvId).trim() !== '') {
    return { tenantId, 'importMeta.pvId': String(payPvId) };
  }
  return { tenantId, title: deal.title, source: 'perfect_venue_refresh' };
}

function buildPaymentFilter(payment, tenantId) {
  const payId = payment.id ?? payment.pvPaymentId;
  if (payId != null && String(payId).trim() !== '') {
    return { tenantId, id: String(payId) };
  }
  const pvPaymentId = payment.pvPaymentId;
  if (pvPaymentId != null) {
    return { tenantId, pvPaymentId: String(pvPaymentId) };
  }
  return {
    tenantId,
    eventId: payment.eventId ?? null,
    paymentDate: payment.paymentDate ?? null,
    amount: payment.amount ?? null,
  };
}

function accumulateWriteStats(stats, result) {
  stats.matched += result.matchedCount;
  stats.modified += result.modifiedCount;
  stats.upserted += result.upsertedCount;
  stats.processed += 1;
}

const sourceClient = new MongoClient(sourceUri);
const targetClient = new MongoClient(targetUri);

try {
  await sourceClient.connect();
  await targetClient.connect();

  const sourceDb = getDb(sourceClient, sourceDbName);
  const targetDb = getDb(targetClient, targetDbName);

  console.log('\n=== Copy HuB Refresh Data ===\n');
  console.log(`Mode:   ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Source: host=${sourceTarget.host} db=${sourceDb.databaseName}`);
  console.log(`Target: host=${destTarget.host} db=${targetDb.databaseName}`);
  console.log(`Tenant: rewrite tenantId → ${targetTenant}`);

  const deals = await sourceDb.collection('deals').find(REFRESH_FILTER).toArray();
  const payments = await sourceDb.collection('hub_payments').find(PAYMENT_FILTER).toArray();

  console.log(`\nDeals to copy:     ${deals.length}`);
  console.log(`Payments to copy:  ${payments.length}`);

  if (deals.length === 0) {
    console.error('[copy] No refresh deals in source — check SOURCE MONGODB_URI / DB_NAME');
    process.exit(1);
  }

  const targetDealCount = await targetDb.collection('deals').countDocuments(REFRESH_FILTER);
  console.log(`Target refresh deals now: ${targetDealCount}`);

  if (!apply) {
    console.log('\n[copy] Dry-run only. Re-run with --apply to upsert into target.');
    process.exit(0);
  }

  const dealsCol = targetDb.collection('deals');
  const paymentsCol = targetDb.collection('hub_payments');

  const dealStats = { processed: 0, matched: 0, modified: 0, upserted: 0 };
  const paymentStats = { processed: 0, matched: 0, modified: 0, upserted: 0 };

  for (const d of deals) {
    const filter = buildDealFilter(d, targetTenant);
    const { update } = buildSafeUpsertDoc(d, { tenantId: targetTenant });
    const result = await dealsCol.updateOne(filter, update, { upsert: true });
    accumulateWriteStats(dealStats, result);
  }

  for (const p of payments) {
    const filter = buildPaymentFilter(p, targetTenant);
    const { update } = buildSafeUpsertDoc(p, { tenantId: targetTenant });
    const result = await paymentsCol.updateOne(filter, update, { upsert: true });
    accumulateWriteStats(paymentStats, result);
  }

  const afterDeals = await dealsCol.countDocuments(TARGET_REFRESH_DEAL_COUNT);
  const afterPayments = await paymentsCol.countDocuments(TARGET_REFRESH_PAYMENT_COUNT);

  console.log(`\n[copy] Applied:`);
  console.log(`  Deals processed:   ${dealStats.processed}`);
  console.log(`  Deals matched:     ${dealStats.matched}`);
  console.log(`  Deals modified:    ${dealStats.modified}`);
  console.log(`  Deals upserted:    ${dealStats.upserted}`);
  console.log(`  Payments processed: ${paymentStats.processed}`);
  console.log(`  Payments matched:   ${paymentStats.matched}`);
  console.log(`  Payments modified:  ${paymentStats.modified}`);
  console.log(`  Payments upserted:  ${paymentStats.upserted}`);
  console.log(`  Target refresh deals now:    ${afterDeals}`);
  console.log(`  Target refresh payments now: ${afterPayments}`);
} finally {
  await sourceClient.close();
  await targetClient.close();
}
