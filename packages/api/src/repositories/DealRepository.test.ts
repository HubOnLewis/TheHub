import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { DealRepository } = await import('./DealRepository.js');

test('calendar deal query requires event metadata, excludes lost deals, and remains tenant-scoped', async () => {
  let capturedFilter: Record<string, unknown> | undefined;
  const collection = {
    find(filter: Record<string, unknown>) {
      capturedFilter = filter;
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        async toArray() {
          return [{
            _id: 'deal-1',
            tenantId: 'tenant-a',
            title: 'Venue event',
            company: 'Acme Events',
            contact: 'Jane Doe',
            amount: 2500,
            status: 'Won',
            importMeta: { eventDateIso: '2026-09-10', startTime: '18:00', endTime: '22:00' },
            createdAt: new Date(),
            updatedAt: new Date(),
          }];
        },
      };
    },
    async countDocuments() { return 1; },
  };

  const result = await DealRepository.listCalendarDeals(
    { collection: () => collection } as any,
    { tenantId: 'tenant-a' } as any,
    { page: 1, limit: 500, sort: 'updatedAt', order: 'desc' },
  );

  assert.equal(result.total, 1);
  assert.equal(result.data[0]?._id, 'deal-1');
  assert.deepEqual(capturedFilter, {
    tenantId: 'tenant-a',
    status: { $ne: 'Lost' },
    $or: [
      { 'importMeta.eventDateIso': { $exists: true, $nin: [null, ''] } },
      { 'importMeta.eventDate': { $exists: true, $nin: [null, ''] } },
    ],
  });
});
