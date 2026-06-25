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

function getDb(client, name) {
  return name ? client.db(name) : client.db();
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

  const now = new Date();
  let dealsWritten = 0;
  let paymentsWritten = 0;
  const dealsCol = targetDb.collection('deals');
  const paymentsCol = targetDb.collection('hub_payments');

  for (const d of deals) {
    const sourceKey = d.importMeta?.sourceKey;
    const filter =
      sourceKey != null
        ? { tenantId: targetTenant, 'importMeta.sourceKey': sourceKey }
        : { tenantId: targetTenant, title: d.title, 'importMeta.pvEventId': d.importMeta?.pvEventId };

    const { _id, ...rest } = d;
    await dealsCol.updateOne(
      filter,
      {
        $set: { ...rest, tenantId: targetTenant, updatedAt: now },
        $setOnInsert: { createdAt: d.createdAt ?? now },
      },
      { upsert: true },
    );
    dealsWritten += 1;
  }

  for (const p of payments) {
    const payId = p.id ?? String(p._id);
    await paymentsCol.updateOne(
      { tenantId: targetTenant, id: payId },
      {
        $set: { ...p, tenantId: targetTenant, updatedAt: now },
        $setOnInsert: { createdAt: p.createdAt ?? now },
      },
      { upsert: true },
    );
    paymentsWritten += 1;
  }

  const afterDeals = await dealsCol.countDocuments({
    tenantId: targetTenant,
    ...REFRESH_FILTER,
  });
  const afterPayments = await paymentsCol.countDocuments({
    tenantId: targetTenant,
    ...PAYMENT_FILTER,
  });

  console.log(`\n[copy] Applied:`);
  console.log(`  Deals upserted:    ${dealsWritten}`);
  console.log(`  Payments upserted: ${paymentsWritten}`);
  console.log(`  Target refresh deals now: ${afterDeals}`);
  console.log(`  Target refresh payments now: ${afterPayments}`);
} finally {
  await sourceClient.close();
  await targetClient.close();
}
