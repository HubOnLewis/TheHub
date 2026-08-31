import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectSpaceConflicts,
  findHardConflictsForProposal,
  isAssignedSpace,
  requiredSpaceError,
  spacesHardConflict,
  timesOverlap,
  type OccupancySlot,
} from '@hub-crm/shared';

function slot(partial: Partial<OccupancySlot> & Pick<OccupancySlot, 'id' | 'space'>): OccupancySlot {
  return {
    title: partial.title ?? partial.id,
    dateKey: partial.dateKey ?? '2026-09-12',
    startMin: partial.startMin ?? 17 * 60,
    endMin: partial.endMin ?? 22 * 60,
    status: partial.status ?? 'Won',
    ...partial,
  };
}

test('same space overlapping times is a hard conflict', () => {
  const conflicts = detectSpaceConflicts([
    slot({ id: 'a', space: 'Main Hall', startMin: 17 * 60, endMin: 22 * 60 }),
    slot({ id: 'b', space: 'Main Hall', startMin: 20 * 60, endMin: 23 * 60 }),
  ]);
  assert.equal(conflicts.filter(c => c.severity === 'hard').length, 1);
});

test('different spaces overlapping times are not a hard conflict', () => {
  const conflicts = detectSpaceConflicts([
    slot({ id: 'a', space: 'Main Hall' }),
    slot({ id: 'b', space: 'Gallery' }),
  ]);
  assert.equal(conflicts.filter(c => c.severity === 'hard').length, 0);
});

test('full venue overlaps any assigned space', () => {
  const conflicts = detectSpaceConflicts([
    slot({ id: 'a', space: 'Full venue' }),
    slot({ id: 'b', space: 'Patio' }),
  ]);
  assert.equal(conflicts.filter(c => c.severity === 'hard').length, 1);
});

test('lost events are ignored by default', () => {
  const conflicts = detectSpaceConflicts([
    slot({ id: 'a', space: 'Main Hall', status: 'Lost' }),
    slot({ id: 'b', space: 'Main Hall', status: 'Won' }),
  ]);
  assert.equal(conflicts.length, 0);
});

test('TBD overlap is soft, not hard', () => {
  const conflicts = detectSpaceConflicts([
    slot({ id: 'a', space: 'TBD' }),
    slot({ id: 'b', space: 'Main Hall' }),
  ]);
  assert.equal(conflicts.filter(c => c.severity === 'hard').length, 0);
  assert.equal(conflicts.filter(c => c.severity === 'soft').length, 1);
});

test('proposal finder blocks overlapping assigned space', () => {
  const hits = findHardConflictsForProposal({
    dateKey: '2026-09-12',
    startMin: 18 * 60,
    endMin: 21 * 60,
    space: 'Main Hall',
    slots: [slot({ id: 'existing', space: 'Main Hall' })],
  });
  assert.equal(hits.length, 1);
});

test('required space rejects TBD for dated events', () => {
  assert.ok(requiredSpaceError('TBD', true));
  assert.ok(requiredSpaceError('', true));
  assert.equal(requiredSpaceError('Main Hall', true), null);
  assert.equal(requiredSpaceError('', false), null);
  assert.equal(isAssignedSpace('Gallery'), true);
  assert.equal(spacesHardConflict('Main Hall', 'main hall'), true);
  assert.equal(timesOverlap(100, 200, 200, 300), false);
});
