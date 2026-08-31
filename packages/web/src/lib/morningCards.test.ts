import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMorningCards, isNewInquiry, pickDoThisNow, selectNewInquiries } from './morningCards.js';

test('Home morning includes far-dated Draft/inquiry events as card #1', () => {
  const farInquiry = {
    id: 'evt-2027',
    title: 'June 2027 wedding inquiry',
    href: '/events/evt-2027',
    statusLabel: 'Inquiry',
    stage: 'draft',
    proposalStatus: null,
    eventDateIso: '2027-06-12',
    space: 'Main Hall',
    guests: 80,
  };
  const bookedSoon = {
    id: 'evt-soon',
    title: 'Next week reception',
    href: '/events/evt-soon',
    statusLabel: 'Confirmed',
    proposalStatus: 'accepted',
    eventDateIso: '2026-09-05',
  };
  const inquiries = selectNewInquiries([farInquiry, bookedSoon]);
  assert.equal(inquiries.length, 1);
  assert.equal(inquiries[0]?.id, 'evt-2027');
  assert.equal(isNewInquiry(farInquiry), true);
  assert.equal(isNewInquiry(bookedSoon), false);

  const cards = buildMorningCards({
    inquiries,
    unsignedProposals: [],
    unpaidDeposits: [],
    unansweredMessages: [],
    missingSpace: [],
  });
  assert.equal(cards[0]?.key, 'new-inquiries');
  assert.equal(cards[0]?.count, 1);
  assert.match(cards[0]?.action ?? '', /open & send proposal/i);
  assert.match(cards[0]?.preview ?? '', /2027/);
});

test('pv Lead status without a published proposal is a new inquiry', () => {
  assert.equal(
    isNewInquiry({
      id: 'lead-1',
      title: 'Public book inquiry',
      href: '/opportunities/lead-1',
      statusLabel: 'Lead',
      stage: 'lead',
      proposalStatus: null,
    }),
    true,
  );
});

test('Do this now ranks Reply then Send proposal then Collect deposit then Assign room', () => {
  const cards = buildMorningCards({
    inquiries: [{ id: 'i', title: 'Inquiry', href: '/opportunities/i' }],
    unsignedProposals: [],
    unpaidDeposits: [{ eventId: 'p', eventTitle: 'Unpaid', href: '/opportunities/p' }],
    unansweredMessages: [{ eventId: 'm', eventTitle: 'Ping', preview: 'Need a DJ rec', href: '/opportunities/m' }],
    missingSpace: [{ id: 's', title: 'No room', href: '/opportunities/s' }],
  });
  const now = pickDoThisNow(cards);
  assert.equal(now?.key, 'unanswered');
  assert.equal(now?.action, 'Reply');
});
