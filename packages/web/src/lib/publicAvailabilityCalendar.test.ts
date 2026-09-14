import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthCells, statusLabel } from './publicAvailabilityCalendar.js';

test('month grid is full weeks and includes the 1st', () => {
  const cells = buildMonthCells(2026, 11);
  assert.equal(cells.length % 7, 0);
  assert.ok(cells.some(c => c.date === '2026-12-01' && c.inMonth));
  assert.ok(cells.some(c => c.date === '2026-12-31' && c.inMonth));
});

test('status labels are not color-only', () => {
  assert.equal(statusLabel('available'), 'Available');
  assert.equal(statusLabel('hold'), 'On hold');
  assert.equal(statusLabel('booked'), 'Booked');
  assert.equal(statusLabel('closed'), 'Closed');
});
