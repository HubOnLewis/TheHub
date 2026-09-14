import assert from 'node:assert/strict';
import test from 'node:test';
import {
  occupancySignalFromDeal,
  projectPublicDays,
  publicAvailabilityLeaksInternal,
  toPublicAvailabilityDto,
} from './publicAvailability.js';

test('closed beats booked, booked beats hold, hold beats available', () => {
  const days = projectPublicDays('2026-12-01', '2026-12-04', [
    { date: '2026-12-02', block: 'hold' },
    { date: '2026-12-02', block: 'booked' },
    { date: '2026-12-03', block: 'closed' },
    { date: '2026-12-03', block: 'booked' },
  ]);
  assert.deepEqual(
    days.map(d => d.status),
    ['available', 'booked', 'closed', 'available'],
  );
});

test('confirmed deal projects booked without leaking title', () => {
  const signal = occupancySignalFromDeal({
    status: 'Won',
    importMeta: {
      eventDateIso: '2026-12-12',
      pvStatus: 'confirmed',
      title: 'Secret wedding',
      contactEmail: 'hidden@example.com',
    },
  });
  assert.deepEqual(signal, { date: '2026-12-12', block: 'booked' });
});

test('draft inquiry projects hold', () => {
  const signal = occupancySignalFromDeal({
    status: 'Draft',
    importMeta: { eventDate: '2026-12-12', pvStatus: 'lead', space: 'Main Hall' },
  });
  assert.deepEqual(signal, { date: '2026-12-12', block: 'hold' });
});

test('blackout flag projects closed', () => {
  const signal = occupancySignalFromDeal({
    status: 'Draft',
    importMeta: { eventDateIso: '2026-12-25', blackout: true },
  });
  assert.deepEqual(signal, { date: '2026-12-25', block: 'closed' });
});

test('expired hold does not block', () => {
  const signal = occupancySignalFromDeal(
    {
      status: 'Draft',
      importMeta: {
        eventDateIso: '2026-12-12',
        pvStatus: 'lead',
        holdExpiresAt: '2026-01-01T00:00:00.000Z',
      },
    },
    Date.parse('2026-06-01T00:00:00.000Z'),
  );
  assert.equal(signal, null);
});

test('coworking / office inventory is ignored', () => {
  assert.equal(
    occupancySignalFromDeal({
      status: 'Won',
      unitId: 'office-1',
      importMeta: { inventoryType: 'office', eventDateIso: '2026-12-12' },
    }),
    null,
  );
  assert.equal(
    occupancySignalFromDeal({
      status: 'Won',
      unitIds: ['u1'],
      importMeta: { coworking: true },
    }),
    null,
  );
});

test('public DTO only has date and status', () => {
  const dto = toPublicAvailabilityDto('2026-12-01', '2026-12-01', [
    { date: '2026-12-01', status: 'available' },
  ]);
  assert.deepEqual(dto, {
    startDate: '2026-12-01',
    endDate: '2026-12-01',
    days: [{ date: '2026-12-01', status: 'available' }],
  });
  assert.deepEqual(publicAvailabilityLeaksInternal(dto), []);
  assert.ok(publicAvailabilityLeaksInternal({ days: [{ date: '2026-12-01', status: 'booked', title: 'x' }] }).includes('title'));
});
