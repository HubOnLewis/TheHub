import assert from 'node:assert/strict';
import test from 'node:test';
import { applyVenueOpsAction, evaluateVenueOps, isFollowUpKind } from './opsQueue.js';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');

test('new inquiry older than a day creates a first-touch task', () => {
  const tasks = evaluateVenueOps(
    {
      _id: 'd1',
      title: 'Alex wedding',
      contact: 'Alex',
      status: 'Draft',
      createdAt: '2026-09-19T12:00:00.000Z',
      updatedAt: '2026-09-19T12:00:00.000Z',
      importMeta: { pvStatus: 'lead', eventDateIso: '2026-10-17', space: 'Main Hall' },
    },
    NOW,
  );
  assert.ok(tasks.some(t => t.kind === 'stale_inquiry' && t.priority === 'high'));
});

test('expired hold surfaces an ops task until dismissed', () => {
  const deal = {
    _id: 'd2',
    title: 'Held social',
    contact: 'Sam',
    status: 'Draft',
    importMeta: {
      pvStatus: 'lead',
      eventDateIso: '2026-10-17',
      holdExpiresAt: '2026-09-20T12:00:00.000Z',
    },
  };
  const open = evaluateVenueOps(deal, NOW);
  assert.ok(open.some(t => t.kind === 'hold_expired'));
  const dismissed = applyVenueOpsAction(deal.importMeta!, 'hold_expired:d2', {
    status: 'done',
    at: new Date(NOW).toISOString(),
  });
  const after = evaluateVenueOps({ ...deal, importMeta: dismissed }, NOW);
  assert.equal(after.some(t => t.kind === 'hold_expired'), false);
});

test('snoozed task stays hidden until snoozeUntil then reappears', () => {
  const deal = {
    _id: 'd4',
    title: 'Snooze social',
    contact: 'Riley',
    status: 'Draft',
    createdAt: '2026-09-19T12:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z',
    importMeta: { pvStatus: 'lead', eventDateIso: '2026-10-17', space: 'Main Hall' },
  };
  const open = evaluateVenueOps(deal, NOW);
  const stale = open.find(t => t.kind === 'stale_inquiry');
  assert.ok(stale);
  const snoozed = applyVenueOpsAction(deal.importMeta!, stale.id, {
    status: 'snoozed',
    at: new Date(NOW).toISOString(),
    snoozeUntil: new Date(NOW + 2 * 86_400_000).toISOString(),
  });
  const during = evaluateVenueOps({ ...deal, importMeta: snoozed }, NOW + 86_400_000);
  assert.equal(during.some(t => t.id === stale.id), false);
  const after = evaluateVenueOps({ ...deal, importMeta: snoozed }, NOW + 3 * 86_400_000);
  assert.ok(after.some(t => t.id === stale.id));
});

test('proposal stage is a follow-up kind', () => {
  const tasks = evaluateVenueOps(
    {
      _id: 'd3',
      title: 'Corp lunch',
      contact: 'Jordan',
      status: 'Approved',
      importMeta: { pvStatus: 'proposal_sent', grandTotal: 2400 },
    },
    NOW,
  );
  const proposal = tasks.find(t => t.kind === 'proposal_followup');
  assert.ok(proposal);
  assert.equal(isFollowUpKind(proposal.kind), true);
});
