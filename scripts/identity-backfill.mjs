import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri || !dbName) {
  console.error('MONGODB_URI and DB_NAME are required');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const unresolved = {
  dealsCompany: [],
  unitsCompany: [],
  ownerIdentity: [],
};

const companies = db.collection('companies');
const deals = db.collection('deals');
const units = db.collection('units');
const builds = db.collection('builds');
const productionJobs = db.collection('production_jobs');
const deliveryRecords = db.collection('delivery_records');
const users = db.collection('users');
const toObjectId = (v) => {
  try { return new ObjectId(String(v)); } catch { return null; }
};

const companyByTenantName = new Map();
for await (const c of companies.find({}, { projection: { _id: 1, tenantId: 1, name: 1 } })) {
  const key = `${c.tenantId}::${String(c.name).trim().toLowerCase()}`;
  const list = companyByTenantName.get(key) ?? [];
  list.push(String(c._id));
  companyByTenantName.set(key, list);
}

for await (const d of deals.find({ $or: [{ companyId: { $exists: false } }, { companyId: '' }, { companyId: null }] })) {
  const key = `${d.tenantId}::${String(d.company ?? '').trim().toLowerCase()}`;
  const matches = companyByTenantName.get(key) ?? [];
  if (matches.length === 1) {
    await deals.updateOne({ _id: d._id }, { $set: { companyId: matches[0] } });
  } else {
    unresolved.dealsCompany.push(String(d._id));
  }
}

for await (const u of units.find({ $or: [{ companyId: { $exists: false } }, { companyId: '' }, { companyId: null }] })) {
  if (!u.assignedDealId) {
    unresolved.unitsCompany.push(String(u._id));
    continue;
  }
  const dealId = toObjectId(u.assignedDealId);
  if (!dealId) {
    unresolved.unitsCompany.push(String(u._id));
    continue;
  }
  const deal = await deals.findOne({ _id: dealId, tenantId: u.tenantId }, { projection: { companyId: 1 } });
  if (deal?.companyId) {
    await units.updateOne({ _id: u._id }, { $set: { companyId: deal.companyId } });
  } else {
    unresolved.unitsCompany.push(String(u._id));
  }
}

for await (const d of deals.find({ $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: '' }, { ownerUserId: null }] })) {
  const name = String(d.assignedTo ?? '').trim();
  if (!name) {
    unresolved.ownerIdentity.push(String(d._id));
    continue;
  }
  const matches = await users
    .find({ tenantId: d.tenantId, active: true, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }, { projection: { _id: 1 } })
    .toArray();
  if (matches.length === 1) {
    await deals.updateOne({ _id: d._id }, { $set: { ownerUserId: String(matches[0]._id) } });
  } else {
    unresolved.ownerIdentity.push(String(d._id));
  }
}

for await (const b of builds.find({})) {
  if (!b.unitId) continue;
  const unitId = toObjectId(b.unitId);
  if (!unitId) {
    unresolved.unitsCompany.push(`build:${String(b._id)}`);
    continue;
  }
  const unit = await units.findOne({ _id: unitId }, { projection: { companyId: 1 } });
  if (!unit?.companyId) unresolved.unitsCompany.push(`build:${String(b._id)}`);
}

for await (const j of productionJobs.find({})) {
  if (!j.buildId || !j.unitId) unresolved.unitsCompany.push(`production:${String(j._id)}`);
}

for await (const r of deliveryRecords.find({ $or: [{ companyId: { $exists: false } }, { companyId: '' }, { companyId: null }] })) {
  const unitId = toObjectId(r.unitId);
  if (!unitId) continue;
  const unit = await units.findOne({ _id: unitId }, { projection: { companyId: 1 } });
  if (unit?.companyId) {
    await deliveryRecords.updateOne({ _id: r._id }, { $set: { companyId: unit.companyId } });
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      unresolvedCounts: {
        dealsCompany: unresolved.dealsCompany.length,
        unitsCompany: unresolved.unitsCompany.length,
        ownerIdentity: unresolved.ownerIdentity.length,
      },
      unresolved,
    },
    null,
    2,
  ),
);

await client.close();
