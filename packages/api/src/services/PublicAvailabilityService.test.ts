import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { Db } from 'mongodb';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/hub_test';
process.env.JWT_SECRET ??= 'public-availability-test-secret-32ch!!';
process.env.SUPER_ADMIN_EMAILS ??= 'jason@hubonlewis.com';

const { DealRepository } = await import('../repositories/DealRepository.js');
const { publicAvailabilityService } = await import('./PublicAvailabilityService.js');
const { publicAvailabilityLeaksInternal } = await import('@hub-crm/shared');

test.afterEach(() => {
  mock.restoreAll();
});

function mockDeals(data: unknown[]) {
  mock.method(DealRepository, 'listCalendarDeals', async () => ({ data, total: data.length }));
}

test('open date is available', async () => {
  mockDeals([]);
  const range = await publicAvailabilityService.listRange({} as Db, '2026-12-01', '2026-12-01');
  assert.deepEqual(range, {
    startDate: '2026-12-01',
    endDate: '2026-12-01',
    days: [{ date: '2026-12-01', status: 'available', morning: 'available', evening: 'available' }],
  });
  assert.deepEqual(publicAvailabilityLeaksInternal(range), []);
});

test('evening booking leaves the morning open', async () => {
  mockDeals([
    {
      status: 'Won',
      importMeta: {
        eventDateIso: '2026-12-12',
        pvStatus: 'confirmed',
        startTime: '17:00',
        endTime: '22:00',
      },
    },
  ]);
  const range = await publicAvailabilityService.listRange({} as Db, '2026-12-12', '2026-12-12');
  assert.deepEqual(range.days[0], {
    date: '2026-12-12',
    status: 'partial',
    morning: 'available',
    evening: 'booked',
  });
  assert.equal(await publicAvailabilityService.statusForDate({} as Db, '2026-12-12'), 'partial');
});

test('confirmed booking projects booked', async () => {
  mockDeals([
    {
      status: 'Won',
      importMeta: {
        eventDateIso: '2026-12-12',
        pvStatus: 'confirmed',
        title: 'Private wedding',
        contactEmail: 'guest@example.com',
        notes: 'secret',
      },
    },
  ]);
  const status = await publicAvailabilityService.statusForDate({} as Db, '2026-12-12');
  assert.equal(status, 'booked');
});

test('active hold projects hold', async () => {
  mockDeals([
    { status: 'Draft', importMeta: { eventDateIso: '2026-12-13', pvStatus: 'lead', contact: 'Alex' } },
  ]);
  assert.equal(await publicAvailabilityService.statusForDate({} as Db, '2026-12-13'), 'hold');
});

test('blackout projects closed', async () => {
  mockDeals([{ status: 'Draft', importMeta: { eventDateIso: '2026-12-25', blackout: true } }]);
  assert.equal(await publicAvailabilityService.statusForDate({} as Db, '2026-12-25'), 'closed');
});

test('expired hold does not remain blocked', async () => {
  mockDeals([
    {
      status: 'Draft',
      importMeta: {
        eventDateIso: '2026-12-14',
        pvStatus: 'lead',
        holdExpiresAt: '2020-01-01T00:00:00.000Z',
      },
    },
  ]);
  assert.equal(
    await publicAvailabilityService.statusForDate({} as Db, '2026-12-14', Date.parse('2026-06-01T00:00:00.000Z')),
    'available',
  );
});

test('coworking inventory is not projected', async () => {
  mockDeals([
    {
      status: 'Won',
      unitId: 'office-1',
      importMeta: { inventoryType: 'office', eventDateIso: '2026-12-15', contact: 'Tenant Co' },
    },
  ]);
  assert.equal(await publicAvailabilityService.statusForDate({} as Db, '2026-12-15'), 'available');
});
