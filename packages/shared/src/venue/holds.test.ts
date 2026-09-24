import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dealOccupiesCalendar,
  defaultHoldExpiresAt,
  holdActionPatch,
  isHoldExpired,
  isHoldReleased,
  resolveHoldLifecycle,
} from './holds.js';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');

test('default hold expires in 7 days', () => {
  const iso = defaultHoldExpiresAt(new Date(NOW));
  assert.equal(Date.parse(iso), NOW + 7 * 86_400_000);
});

test('expired inquiry hold no longer occupies the calendar', () => {
  const deal = {
    status: 'Draft',
    importMeta: {
      pvStatus: 'lead',
      eventDateIso: '2026-10-17',
      holdExpiresAt: '2026-09-20T12:00:00.000Z',
    },
  };
  assert.equal(isHoldExpired(deal.importMeta, NOW), true);
  assert.equal(resolveHoldLifecycle(deal, NOW), 'expired');
  assert.equal(dealOccupiesCalendar(deal, NOW), false);
});

test('confirmed events occupy even if hold timestamp is in the past', () => {
  const deal = {
    status: 'Won',
    importMeta: {
      pvStatus: 'confirmed',
      eventDateIso: '2026-10-17',
      holdExpiresAt: '2026-09-01T12:00:00.000Z',
      amountPaid: 1000,
      grandTotal: 4000,
    },
  };
  assert.equal(resolveHoldLifecycle(deal, NOW), 'converted');
  assert.equal(dealOccupiesCalendar(deal, NOW), true);
});

test('Won CRM status occupies after hold expiry even if pvStatus is still lead', () => {
  const deal = {
    status: 'Won',
    importMeta: {
      pvStatus: 'lead',
      eventDateIso: '2026-10-17',
      holdExpiresAt: '2026-09-01T12:00:00.000Z',
    },
  };
  assert.equal(resolveHoldLifecycle(deal, NOW), 'converted');
  assert.equal(dealOccupiesCalendar(deal, NOW), true);
});

test('staff release frees a live hold', () => {
  const deal = {
    status: 'Draft',
    importMeta: {
      pvStatus: 'lead',
      holdExpiresAt: '2026-09-28T12:00:00.000Z',
      holdReleasedAt: '2026-09-21T12:00:00.000Z',
    },
  };
  assert.equal(isHoldReleased(deal.importMeta), true);
  assert.equal(resolveHoldLifecycle(deal, NOW), 'released');
  assert.equal(dealOccupiesCalendar(deal, NOW), false);
});

test('extend hold clears a prior release and pushes expiry', () => {
  const patch = holdActionPatch(
    'extend',
    { holdExpiresAt: '2026-09-22T12:00:00.000Z', holdReleasedAt: '2026-09-21T00:00:00.000Z' },
    { days: 7, now: new Date(NOW) },
  );
  assert.equal(patch.holdReleasedAt, '');
  assert.equal(patch.holdExpiresAt, new Date(NOW + 8 * 86_400_000).toISOString());
});
