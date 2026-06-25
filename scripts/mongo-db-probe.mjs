#!/usr/bin/env node
/**
 * Deep Mongo probe — same checks as /api/admin/hub-refresh-status database section.
 * Run from Render API shell: npm run probe:mongo
 */

import { MongoClient } from 'mongodb';
import { loadEnv, getMongoDb, parseMongoTarget } from './lib/hub-refresh-utils.mjs';

loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[probe] MONGODB_URI required');
  process.exit(1);
}

const target = parseMongoTarget(uri);
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = getMongoDb(client);
  const dealsCol = db.collection('deals');
  const paymentsCol = db.collection('hub_payments');
  const hubIn = { tenantId: { $in: ['hub-wichita', 'hub-on-lewis'] } };

  console.log('\n=== Mongo DB Probe ===\n');
  console.log('NODE_ENV:', process.env.NODE_ENV ?? '(unset)');
  console.log('DB_NAME env:', process.env.DB_NAME ?? '(unset)');
  console.log('Mongo host:', target.host);
  console.log('Connected db:', db.databaseName);

  const collections = await db.listCollections().toArray();
  console.log('\nCollections:');
  for (const c of collections) {
    const n = await db.collection(c.name).countDocuments();
    if (n > 0) console.log(`  ${c.name}: ${n}`);
  }

  console.log('\nDeals:');
  console.log('  total:', await dealsCol.countDocuments({}));
  console.log('  hub tenant scope:', await dealsCol.countDocuments(hubIn));
  console.log('  importMeta.source=perfect_venue_refresh:', await dealsCol.countDocuments({ 'importMeta.source': 'perfect_venue_refresh' }));
  console.log('  source=perfect_venue_refresh:', await dealsCol.countDocuments({ source: 'perfect_venue_refresh' }));
  console.log('  sourceSystem=perfect_venue_refresh:', await dealsCol.countDocuments({ sourceSystem: 'perfect_venue_refresh' }));
  console.log('  importedFrom=perfect_venue_refresh:', await dealsCol.countDocuments({ importedFrom: 'perfect_venue_refresh' }));

  const newest = await dealsCol.find({}).sort({ updatedAt: -1 }).limit(10).toArray();
  console.log('\nNewest 10 deals:');
  for (const d of newest) {
    console.log(
      ' ',
      JSON.stringify({
        title: d.title ?? d.name,
        tenantId: d.tenantId,
        source: d.source,
        importMetaSource: d.importMeta?.source,
        status: d.status,
        updatedAt: d.updatedAt,
      }),
    );
  }

  console.log('\nPayments:');
  console.log('  total hub_payments:', await paymentsCol.countDocuments({}));
  console.log('  hub tenant scope:', await paymentsCol.countDocuments(hubIn));
  console.log('  importBatchId hub-refresh-*:', await paymentsCol.countDocuments({ importBatchId: { $regex: '^hub-refresh-' } }));

  const paySample = await paymentsCol.find({}).sort({ updatedAt: -1 }).limit(5).toArray();
  console.log('\nSample payments:');
  for (const p of paySample) {
    console.log(
      ' ',
      JSON.stringify({
        id: p.id,
        tenantId: p.tenantId,
        importBatchId: p.importBatchId,
        amount: p.amount,
      }),
    );
  }

  console.log('\n[probe] Done.');
} finally {
  await client.close();
}
