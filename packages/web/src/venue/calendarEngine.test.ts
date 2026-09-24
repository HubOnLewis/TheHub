import assert from 'node:assert/strict';
import test from 'node:test';
import type { CrmEventRow } from '../lib/crmEvents.js';
import { rowsToCalendarBlocks } from './calendarEngine.js';

function row(partial: Partial<CrmEventRow> & Pick<CrmEventRow, 'id' | 'source'>): CrmEventRow {
  return {
    title: 'Event',
    contact: 'Alex',
    status: 'Draft',
    statusLabel: 'Lead',
    eventDate: '2026-10-17',
    eventDateDisplay: 'Oct 17',
    eventTime: '17:00 - 22:00',
    guests: 80,
    space: 'Main Hall',
    value: 0,
    lastContacted: null,
    lastContactedDisplay: '—',
    createdAt: null,
    createdDisplay: '—',
    owner: 'Hannah',
    href: '/events/x',
    ...partial,
  };
}

test('released live holds do not become calendar chips', () => {
  const blocks = rowsToCalendarBlocks([
    row({ id: 'hold-live', source: 'api', occupancy: 'hold' }),
    row({ id: 'hold-released', source: 'api' }),
    row({ id: 'booked', source: 'api', occupancy: 'booked' }),
  ]);
  assert.deepEqual(blocks.map(b => b.id), ['hold-live', 'booked']);
});

test('imported dated rows still draw when occupancy is unset', () => {
  const blocks = rowsToCalendarBlocks([row({ id: 'import-1', source: 'import' })]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.id, 'import-1');
});
