import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGuestStatusTimeline,
  guestPortalPhase,
  guestPrimaryNav,
  proposalStatusFromPortal,
} from './guestTimeline.js';

const INTAKE = {
  eventDateIso: '2027-06-12',
};

test('day-0 inquiry: waiting on proposal; details and paid are not complete', () => {
  const steps = buildGuestStatusTimeline({
    proposalStatus: null,
    amountPaid: 0,
    balanceDue: 0,
    grandTotal: 0,
    eventDateIso: INTAKE.eventDateIso,
    detailsConfirmed: false,
  });
  const byKey = Object.fromEntries(steps.map(s => [s.key, s]));
  assert.equal(byKey.inquiry.state, 'complete');
  assert.equal(byKey.proposal.state, 'current');
  assert.match(byKey.proposal.detail ?? '', /not sent yet/i);
  assert.equal(byKey.details.state, 'upcoming');
  assert.notEqual(byKey.details.state, 'complete');
  assert.equal(byKey.final_pay.state, 'upcoming');
  assert.notEqual(byKey.final_pay.state, 'complete');
  assert.doesNotMatch(byKey.final_pay.detail ?? '', /paid in full/i);
  assert.equal(guestPortalPhase({ proposalStatus: null, amountPaid: 0, grandTotal: 0 }), 'awaiting_proposal');
});

test('intake guests+date+space does not mark details complete even if a caller lies', () => {
  const steps = buildGuestStatusTimeline({
    proposalStatus: undefined,
    amountPaid: 0,
    balanceDue: 0,
    grandTotal: 0,
    eventDateIso: '2027-06-12',
    detailsConfirmed: true,
  });
  const details = steps.find(s => s.key === 'details');
  const proposal = steps.find(s => s.key === 'proposal');
  assert.equal(proposal?.state, 'current');
  assert.notEqual(details?.state, 'complete');
});

test('$0 package is never paid in full', () => {
  const steps = buildGuestStatusTimeline({
    proposalStatus: 'accepted',
    amountPaid: 0,
    balanceDue: 0,
    grandTotal: 0,
    eventDateIso: '2027-06-12',
  });
  const pay = steps.find(s => s.key === 'final_pay');
  assert.notEqual(pay?.state, 'complete');
  assert.doesNotMatch(pay?.detail ?? '', /paid in full/i);
});

test('after proposal sent, current step is sign', () => {
  const steps = buildGuestStatusTimeline({
    proposalStatus: 'sent',
    amountPaid: 0,
    grandTotal: 4500,
    balanceDue: 4500,
  });
  assert.equal(steps.find(s => s.key === 'proposal')?.state, 'complete');
  assert.equal(steps.find(s => s.key === 'signed')?.state, 'current');
  assert.equal(guestPortalPhase({ proposalStatus: 'sent', grandTotal: 4500, balanceDue: 4500 }), 'awaiting_signature');
});

test('after signed, current step is deposit; details still not current until deposit', () => {
  const steps = buildGuestStatusTimeline({
    proposalStatus: 'accepted',
    amountPaid: 0,
    grandTotal: 4500,
    balanceDue: 4500,
    detailsConfirmed: false,
  });
  assert.equal(steps.find(s => s.key === 'signed')?.state, 'complete');
  assert.equal(steps.find(s => s.key === 'deposit')?.state, 'current');
  assert.equal(steps.find(s => s.key === 'details')?.state, 'upcoming');
  assert.equal(guestPortalPhase({ proposalStatus: 'accepted', amountPaid: 0, grandTotal: 4500, balanceDue: 4500 }), 'awaiting_deposit');
});

test('after deposit, details becomes current', () => {
  const steps = buildGuestStatusTimeline({
    proposalStatus: 'accepted',
    amountPaid: 1000,
    grandTotal: 4500,
    balanceDue: 3500,
    detailsConfirmed: false,
  });
  assert.equal(steps.find(s => s.key === 'deposit')?.state, 'complete');
  assert.equal(steps.find(s => s.key === 'details')?.state, 'current');
  assert.equal(guestPortalPhase({ proposalStatus: 'accepted', amountPaid: 1000, grandTotal: 4500, balanceDue: 3500 }), 'details');
});

test('guest nav: Home+Messages until proposal; Sign when sent; Pay after signed', () => {
  assert.deepEqual(
    guestPrimaryNav('awaiting_proposal').map(n => n.label),
    ['Home', 'Messages'],
  );
  assert.deepEqual(
    guestPrimaryNav('awaiting_signature').map(n => n.label),
    ['Home', 'Sign', 'Messages'],
  );
  assert.deepEqual(
    guestPrimaryNav('awaiting_deposit').map(n => n.label),
    ['Home', 'Pay deposit', 'Messages'],
  );
  assert.ok(guestPrimaryNav('details').some(n => n.label === 'Details'));
});

test('pending_review without a published proposal is still waiting', () => {
  assert.equal(proposalStatusFromPortal({ agreementStatus: 'pending_review' }), null);
  assert.equal(proposalStatusFromPortal({ proposalStatus: 'sent' }), 'sent');
  assert.equal(proposalStatusFromPortal({ agreementStatus: 'signed' }), 'accepted');
});
