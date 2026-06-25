#!/usr/bin/env node
/**
 * Repair tenantId on perfect_venue_refresh imports (e.g. hub-on-lewis → hub-wichita).
 *
 * Usage:
 *   npm run repair:hub-refresh-tenant:dry-run
 *   npm run repair:hub-refresh-tenant:apply
 *   node scripts/repair-hub-refresh-tenant.mjs --apply --target hub-wichita
 *
 * Env: MONGODB_URI (required), DB_NAME
 */

import { MongoClient } from 'mongodb';
import { loadEnv, getMongoDb, parseMongoTarget } from './lib/hub-refresh-utils.mjs';
import {
  defaultHubTenantId,
  resolvePrimaryHubTenant,
  hubVenueTenantScope,
} from './lib/hub-tenant-resolve.mjs';

loadEnv();

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const targetIdx = argv.indexOf('--target');
const targetTenant = resolvePrimaryHubTenant(
  targetIdx >= 0 ? argv[targetIdx + 1] : defaultHubTenantId(),
);

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[repair] MONGODB_URI is required');
  process.exit(1);
}

const mongoTarget = parseMongoTarget(uri);
const hubScope = hubVenueTenantScope(targetTenant) ?? [targetTenant];
const sourceTenants = hubScope.filter(t => t !== targetTenant);

const REFRESH_FILTER = {
  $or: [{ source: 'perfect_venue_refresh' }, { 'importMeta.source': 'perfect_venue_refresh' }],
};

function sampleDeal(d) {
  return {
    id: String(d._id),
    title: d.title ?? '',
    tenantId: d.tenantId,
    source: d.source ?? d.importMeta?.source,
    status: d.status,
  };
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = getMongoDb(client);
  const dealsCol = db.collection('deals');
  const paymentsCol = db.collection('hub_payments');

  console.log('\n=== HuB Refresh Tenant Repair ===\n');
  console.log(`Mode:           ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Mongo:          host=${mongoTarget.host} db=${mongoTarget.dbName}`);
  console.log(`Target tenant:  ${targetTenant}`);
  console.log(`Source tenants: ${sourceTenants.length ? sourceTenants.join(', ') : '(none — already canonical)'}`);

  if (sourceTenants.length === 0) {
    console.log('\n[repair] Nothing to repair — target is the only venue tenant in scope.');
    process.exit(0);
  }

  const dealFilter = {
    tenantId: { $in: sourceTenants },
    ...REFRESH_FILTER,
  };
  const paymentFilter = {
    tenantId: { $in: sourceTenants },
    ...REFRESH_FILTER,
  };

  const dealCount = await dealsCol.countDocuments(dealFilter);
  const paymentCount = await paymentsCol.countDocuments(paymentFilter);
  const dealSamples = await dealsCol.find(dealFilter).limit(10).toArray();
  const paymentSamples = await paymentsCol.find(paymentFilter).limit(10).toArray();

  console.log(`\nDeals to move:     ${dealCount}`);
  console.log(`Payments to move:  ${paymentCount}`);

  if (dealSamples.length) {
    console.log('\nSample deals:');
    for (const d of dealSamples) console.log(' ', JSON.stringify(sampleDeal(d)));
  }
  if (paymentSamples.length) {
    console.log('\nSample payments:');
    for (const p of paymentSamples) {
      console.log(
        ' ',
        JSON.stringify({
          id: p.id ?? String(p._id),
          tenantId: p.tenantId,
          importBatchId: p.importBatchId ?? null,
        }),
      );
    }
  }

  if (dealCount === 0 && paymentCount === 0) {
    console.log('\n[repair] No refresh records under non-canonical tenant — nothing to do.');
    process.exit(0);
  }

  if (!apply) {
    console.log('\n[repair] Dry-run only. Re-run with --apply to update tenantId fields.');
    process.exit(0);
  }

  const now = new Date();
  const dealResult = await dealsCol.updateMany(dealFilter, {
    $set: { tenantId: targetTenant, updatedAt: now },
  });
  const paymentResult = await paymentsCol.updateMany(paymentFilter, {
    $set: { tenantId: targetTenant, updatedAt: now },
  });

  console.log(`\n[repair] Applied:`);
  console.log(`  Deals modified:    ${dealResult.modifiedCount}`);
  console.log(`  Payments modified: ${paymentResult.modifiedCount}`);
  console.log(`  Target tenant:     ${targetTenant}`);
} finally {
  await client.close();
}
