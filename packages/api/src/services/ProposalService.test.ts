import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { applyProposalAction, canApplyProposalAction, nextProposalVersion } = await import('./ProposalService.js');
const { buildGuestStatusTimeline } = await import('@hub-crm/shared');

test('proposal persist transitions: draft → sent → viewed → accepted', () => {
  const t0 = new Date('2026-08-31T16:00:00.000Z');
  const sent = applyProposalAction({ status: 'draft' }, 'send', t0, 'Hannah');
  assert.equal(sent.status, 'sent');
  assert.equal(sent.sentAt?.toISOString(), t0.toISOString());

  const viewed = applyProposalAction(
    { status: 'sent', sentAt: t0 },
    'view',
    new Date('2026-08-31T17:00:00.000Z'),
    'client',
  );
  assert.equal(viewed.status, 'viewed');
  assert.ok(viewed.viewedAt);

  const accepted = applyProposalAction(
    { status: 'viewed', sentAt: t0, viewedAt: viewed.viewedAt as Date },
    'accept',
    new Date('2026-08-31T18:00:00.000Z'),
    'Kiasia Allen',
  );
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.acceptedBy, 'Kiasia Allen');
  assert.ok(accepted.acceptedAt);
});

test('proposal persist: cannot accept a draft; viewing is sticky', () => {
  assert.equal(canApplyProposalAction('draft', 'accept'), false);
  assert.equal(canApplyProposalAction('accepted', 'view'), false);
  const firstView = new Date('2026-08-01T00:00:00.000Z');
  const again = applyProposalAction(
    { status: 'viewed', viewedAt: firstView },
    'view',
    new Date('2026-08-02T00:00:00.000Z'),
    'client',
  );
  assert.equal(again.status, 'viewed');
  assert.equal(again.viewedAt?.toISOString(), firstView.toISOString());
});

test('new send increments version; superseded is a legal prior state', () => {
  assert.equal(nextProposalVersion(0), 1);
  assert.equal(nextProposalVersion(3), 4);
  const superseded = applyProposalAction({ status: 'sent' }, 'supersede', new Date(), 'staff');
  assert.equal(superseded.status, 'superseded');
});

test('guest timeline advances Inquiry → Proposal → Signed → Deposit → Details → Final pay → Day-of', () => {
  const inquiry = buildGuestStatusTimeline({});
  assert.equal(inquiry.find(s => s.state === 'current')?.key, 'proposal');

  const proposed = buildGuestStatusTimeline({ proposalStatus: 'sent' });
  assert.equal(proposed.find(s => s.key === 'proposal')?.state, 'complete');
  assert.equal(proposed.find(s => s.state === 'current')?.key, 'signed');

  const signed = buildGuestStatusTimeline({ proposalStatus: 'accepted' });
  assert.equal(signed.find(s => s.key === 'signed')?.state, 'complete');
  assert.equal(signed.find(s => s.state === 'current')?.key, 'deposit');

  const deposit = buildGuestStatusTimeline({
    proposalStatus: 'accepted',
    amountPaid: 1000,
    grandTotal: 4000,
    balanceDue: 3000,
  });
  assert.equal(deposit.find(s => s.key === 'deposit')?.state, 'complete');
  assert.equal(deposit.find(s => s.state === 'current')?.key, 'details');

  const details = buildGuestStatusTimeline({
    proposalStatus: 'accepted',
    amountPaid: 1000,
    grandTotal: 4000,
    balanceDue: 3000,
    detailsConfirmed: true,
  });
  assert.equal(details.find(s => s.state === 'current')?.key, 'final_pay');

  const paid = buildGuestStatusTimeline({
    proposalStatus: 'accepted',
    amountPaid: 4000,
    grandTotal: 4000,
    balanceDue: 0,
    detailsConfirmed: true,
    eventDateIso: '2099-01-01',
  });
  assert.equal(paid.find(s => s.key === 'final_pay')?.state, 'complete');
  assert.equal(paid.find(s => s.state === 'current')?.key, 'day_of');
});
