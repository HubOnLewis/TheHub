import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { eventBus } = await import('./index.js');

function activityDb() {
  const dealId = new ObjectId();
  const activities: Record<string, unknown>[] = [];
  const deal = {
    _id: dealId,
    tenantId: 'tenant-a',
    companyId: 'company-a',
    company: 'Acme Events',
    assignedTo: 'Coordinator',
    ownerUserId: 'owner-a',
  };
  return {
    dealId,
    activities,
    collection(name: string) {
      if (name === 'deals') {
        return {
          findOne: async () => deal,
        };
      }
      if (name === 'interactions') {
        return {
          insertOne: async (doc: Record<string, unknown>) => {
            activities.push(doc);
            return { insertedId: new ObjectId() };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };
}

test('deal lifecycle events write tenant-scoped activity history through interactions', async () => {
  const db = activityDb();

  await eventBus.emit({ type: 'deal.created', dealId: db.dealId.toString(), tenantId: 'tenant-a' }, db as any);
  await eventBus.emit({
    type: 'event.stage_changed',
    dealId: db.dealId.toString(),
    from: 'Draft',
    to: 'Pending Approval',
    tenantId: 'tenant-a',
  }, db as any);

  assert.equal(db.activities.length, 2);
  assert.deepEqual(db.activities.map(a => a.relatedDealId), [db.dealId.toString(), db.dealId.toString()]);
  assert.deepEqual(db.activities.map(a => a.tenantId), ['tenant-a', 'tenant-a']);
  assert.deepEqual(db.activities.map(a => a.type), ['note', 'note']);
  assert.equal(db.activities[0]?.summary, 'Deal created');
  assert.equal(db.activities[1]?.summary, 'Deal stage changed');
  assert.equal(db.activities[1]?.body, 'Stage changed from Draft to Pending Approval.');
});
