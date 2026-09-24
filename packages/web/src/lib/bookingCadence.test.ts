import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingCadence } from './liveEventHelpers.js';
import type { CrmEventRow } from './crmEvents.js';

const BASE: Omit<CrmEventRow, 'id' | 'createdAt'> = {
  title: 'Event',
  contact: 'Contact',
  status: 'Draft',
  statusLabel: 'Inquiry',
  eventDate: null,
  eventDateDisplay: '—',
  eventTime: '',
  guests: 0,
  space: '',
  value: 0,
  lastContacted: null,
  lastContactedDisplay: '—',
  createdDisplay: '—',
  owner: '—',
  href: '/opportunities/x',
  source: 'api',
};

function rowCreatedDaysAgo(id: string, days: number, now: number): CrmEventRow {
  return { ...BASE, id, createdAt: new Date(now - days * 86_400_000).toISOString() };
}

test('bookingCadence buckets records into their trailing week, oldest first', () => {
  const now = Date.now();
  const rows = [
    rowCreatedDaysAgo('a', 0, now), // this week -> last bucket
    rowCreatedDaysAgo('b', 1, now), // this week -> last bucket
    rowCreatedDaysAgo('c', 8, now), // one week ago -> second-to-last bucket
  ];
  const cadence = bookingCadence(rows, 4, now);
  assert.equal(cadence.length, 4);
  assert.equal(cadence[3], 2, 'current week has the two same-week records');
  assert.equal(cadence[2], 1, 'prior week has the one record created 8 days ago');
  assert.equal(cadence[0] + cadence[1], 0, 'older weeks are empty, not fabricated');
});

test('bookingCadence ignores records with no or invalid createdAt', () => {
  const now = Date.now();
  const rows: CrmEventRow[] = [
    { ...BASE, id: 'no-date', createdAt: null },
    { ...BASE, id: 'bad-date', createdAt: 'not-a-date' },
  ];
  const cadence = bookingCadence(rows, 4, now);
  assert.deepEqual(cadence, [0, 0, 0, 0]);
});

test('bookingCadence drops records older than the requested window', () => {
  const now = Date.now();
  const rows = [rowCreatedDaysAgo('old', 90, now)];
  const cadence = bookingCadence(rows, 4, now);
  assert.deepEqual(cadence, [0, 0, 0, 0]);
});
