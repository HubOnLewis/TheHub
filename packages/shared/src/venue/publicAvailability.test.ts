import assert from 'node:assert/strict';
import test from 'node:test';
import {
  occupancySignalFromDeal,
  occupancySlotFromTimes,
  isPublicWindowOpen,
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

test('evening booking leaves morning open as a partial day', () => {
  const days = projectPublicDays('2026-12-12', '2026-12-12', [
    { date: '2026-12-12', block: 'booked', slot: 'evening' },
  ]);
  assert.deepEqual(days[0], {
    date: '2026-12-12',
    status: 'partial',
    morning: 'available',
    evening: 'booked',
  });
});

test('morning hold plus evening booking is still requestable in the morning', () => {
  const [day] = projectPublicDays('2026-12-12', '2026-12-12', [
    { date: '2026-12-12', block: 'hold', slot: 'morning' },
    { date: '2026-12-12', block: 'booked', slot: 'evening' },
  ]);
  assert.equal(day.status, 'partial');
  assert.equal(day.morning, 'hold');
  assert.equal(day.evening, 'booked');
  assert.equal(isPublicWindowOpen(day, '09:00', '14:00'), false);
  assert.equal(isPublicWindowOpen(day, '17:00', '22:00'), false);
});

test('evening inquiry is allowed when only the evening is open', () => {
  const [day] = projectPublicDays('2026-12-12', '2026-12-12', [
    { date: '2026-12-12', block: 'booked', slot: 'morning' },
  ]);
  assert.equal(isPublicWindowOpen(day, '17:00', '22:00'), true);
  assert.equal(isPublicWindowOpen(day, '09:00', '14:00'), false);
  assert.equal(occupancySlotFromTimes('17:00', '22:00'), 'evening');
  assert.equal(occupancySlotFromTimes('09:00', '14:00'), 'morning');
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
  assert.deepEqual(signal, { date: '2026-12-12', block: 'booked', slot: 'allDay' });
});

test('draft inquiry projects hold', () => {
  const signal = occupancySignalFromDeal({
    status: 'Draft',
    importMeta: { eventDate: '2026-12-12', pvStatus: 'lead', space: 'Main Hall' },
  });
  assert.deepEqual(signal, { date: '2026-12-12', block: 'hold', slot: 'allDay' });
});

test('blackout flag projects closed', () => {
  const signal = occupancySignalFromDeal({
    status: 'Draft',
    importMeta: { eventDateIso: '2026-12-25', blackout: true },
  });
  assert.deepEqual(signal, { date: '2026-12-25', block: 'closed', slot: 'allDay' });
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

test('Won CRM status is booked even if pvStatus is still lead', () => {
  const signal = occupancySignalFromDeal(
    {
      status: 'Won',
      importMeta: {
        eventDateIso: '2026-12-12',
        pvStatus: 'lead',
        startTime: '17:00',
        endTime: '22:00',
        holdExpiresAt: '2026-01-01T00:00:00.000Z',
      },
    },
    Date.parse('2026-06-01T00:00:00.000Z'),
  );
  assert.deepEqual(signal, { date: '2026-12-12', block: 'booked', slot: 'evening' });
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

test('timed evening booking occupies only the evening slot', () => {
  const signal = occupancySignalFromDeal({
    status: 'Won',
    importMeta: {
      eventDateIso: '2026-12-12',
      pvStatus: 'confirmed',
      startTime: '17:00',
      endTime: '22:00',
    },
  });
  assert.deepEqual(signal, { date: '2026-12-12', block: 'booked', slot: 'evening' });
});

test('public DTO includes date, overall status, and both slots', () => {
  const dto = toPublicAvailabilityDto('2026-12-01', '2026-12-01', [
    { date: '2026-12-01', status: 'available', morning: 'available', evening: 'available' },
  ]);
  assert.deepEqual(dto, {
    startDate: '2026-12-01',
    endDate: '2026-12-01',
    days: [{ date: '2026-12-01', status: 'available', morning: 'available', evening: 'available' }],
  });
  assert.deepEqual(publicAvailabilityLeaksInternal(dto), []);
  assert.ok(publicAvailabilityLeaksInternal({ days: [{ date: '2026-12-01', status: 'booked', title: 'x' }] }).includes('title'));
});
