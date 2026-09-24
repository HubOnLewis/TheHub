import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMonthCells,
  formatClock,
  preferredSlot,
  statusLabel,
} from './publicAvailabilityCalendar.js';

test('month grid is full weeks and includes the 1st', () => {
  const cells = buildMonthCells(2026, 11);
  assert.equal(cells.length % 7, 0);
  assert.ok(cells.some(c => c.date === '2026-12-01' && c.inMonth));
  assert.ok(cells.some(c => c.date === '2026-12-31' && c.inMonth));
});

test('status labels are not color-only', () => {
  assert.equal(statusLabel('available'), 'Open');
  assert.equal(statusLabel('partial'), 'Partial');
  assert.equal(statusLabel('hold'), 'Hold');
  assert.equal(statusLabel('booked'), 'Booked');
  assert.equal(statusLabel('closed'), 'Closed');
});

test('preferred slot favors evening when both are open', () => {
  assert.equal(
    preferredSlot({ date: '2026-12-12', status: 'available', morning: 'available', evening: 'available' }),
    'evening',
  );
  assert.equal(
    preferredSlot({ date: '2026-12-12', status: 'partial', morning: 'available', evening: 'booked' }),
    'morning',
  );
  assert.equal(formatClock('09:00'), '9 AM');
  assert.equal(formatClock('17:00'), '5 PM');
});
