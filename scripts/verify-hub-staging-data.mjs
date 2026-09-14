import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const env = {};
for (const line of fs.readFileSync('.env.staging.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db(env.DB_NAME);
  const tenant = env.HUB_TENANT_ID;
  const scope = { tenantId: tenant };
  const names = ['deals', 'companies', 'contacts', 'proposals', 'hub_payments'];
  const counts = Object.fromEntries(await Promise.all(names.map(async name => [name, await db.collection(name).countDocuments(scope)])));
  const [contactsWithCompany, dealsWithContact, proposalsWithLines, paymentsWithDeal, provenance] = await Promise.all([
    db.collection('contacts').countDocuments({ ...scope, companyId: { $exists: true, $nin: ['', null] } }),
    db.collection('deals').countDocuments({ ...scope, contactId: { $exists: true, $nin: ['', null] } }),
    db.collection('proposals').countDocuments({ ...scope, lines: { $exists: true, $not: { $size: 0 } } }),
    db.collection('hub_payments').countDocuments({ ...scope, eventId: { $exists: true, $nin: ['', null] } }),
    db.collection('deals').countDocuments({ ...scope, 'importMeta.source': 'perfect_venue_refresh' }),
  ]);
  const sample = await db.collection('deals').findOne(scope, { projection: { _id: 1, title: 1, contactId: 1, companyId: 1, importMeta: 1 } });
  console.log(JSON.stringify({ database: db.databaseName, tenant, counts, relationships: { contactsWithCompany, dealsWithContact, proposalsWithLines, paymentsWithDeal, importedDeals: provenance }, representative: { hasDeal: Boolean(sample), hasContactLink: Boolean(sample?.contactId), hasCompanyLink: Boolean(sample?.companyId), hasSourceKey: Boolean(sample?.importMeta?.sourceKey) } }, null, 2));
} finally { await client.close(); }
