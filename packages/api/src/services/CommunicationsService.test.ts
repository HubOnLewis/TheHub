import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const {
  threadFromInteractions,
  eventHasUnansweredGuestMessage,
  buildOutboundInteractionDoc,
  buildInboxTriage,
  renderTemplate,
} = await import('./CommunicationsService.js');
const { StubEmailProvider } = await import('./email/EmailProvider.js');

test('portal thread is one ordered event conversation for staff and guest', () => {
  const t1 = new Date('2026-08-31T15:00:00.000Z');
  const t2 = new Date('2026-08-31T15:05:00.000Z');
  const t3 = new Date('2026-08-31T15:10:00.000Z');
  const thread = threadFromInteractions([
    {
      _id: 'staff-1',
      body: 'Proposal is in your portal.',
      direction: 'outbound',
      createdAt: t1,
      createdByName: 'Hannah',
      metadata: { channel: 'portal', role: 'coordinator', deliveryStatus: 'persisted' },
    },
    {
      _id: 'guest-1',
      body: 'Can we add a late-night snack?',
      direction: 'inbound',
      createdAt: t3,
      createdByName: 'Kiasia',
      metadata: { channel: 'portal', role: 'client', deliveryStatus: 'persisted' },
    },
    {
      _id: 'staff-2',
      body: 'Yes — I added it to the BEO.',
      direction: 'outbound',
      createdAt: t2,
      createdByName: 'Hannah',
      metadata: { channel: 'email', role: 'coordinator', deliveryStatus: 'stubbed' },
    },
  ]);
  assert.equal(thread.length, 3);
  assert.deepEqual(thread.map(m => m.id), ['staff-1', 'staff-2', 'guest-1']);
  assert.equal(thread[0]?.role, 'coordinator');
  assert.equal(thread[2]?.role, 'client');
  assert.equal(thread[1]?.channel, 'email');
  assert.equal(thread[1]?.deliveryStatus, 'stubbed');
  assert.equal(eventHasUnansweredGuestMessage(thread), true);
});

test('guest then staff reply clears unanswered; stub email still persists the interaction', async () => {
  const now = new Date('2026-08-31T16:00:00.000Z');
  const guest = buildOutboundInteractionDoc({
    tenantId: 'hub-wichita',
    companyId: 'co1',
    companyName: 'Allen',
    eventId: 'evt1',
    body: 'We would like to sign tonight.',
    summary: 'Guest portal message',
    channel: 'portal',
    role: 'client',
    direction: 'inbound',
    actorId: 'portal-guest',
    actorName: 'Kiasia',
    deliveryStatus: 'persisted',
    now,
  });
  assert.equal(guest.relatedDealId, 'evt1');
  assert.equal(guest.metadata['channel'], 'portal');
  assert.equal(guest.metadata['deliveryStatus'], 'persisted');
  assert.equal(guest.type, 'note');

  const stub = new StubEmailProvider();
  const sendP = stub.send({
    to: 'guest@example.com',
    subject: 'Your proposal',
    body: 'See portal',
    eventId: 'evt1',
  });

  const staff = buildOutboundInteractionDoc({
    tenantId: 'hub-wichita',
    companyId: 'co1',
    companyName: 'Allen',
    eventId: 'evt1',
    body: 'See portal',
    summary: 'Your proposal',
    channel: 'email',
    role: 'coordinator',
    direction: 'outbound',
    actorId: 'staff-1',
    actorName: 'Hannah',
    deliveryStatus: 'stubbed',
    providerMessageId: 'stub_test',
    now: new Date(now.getTime() + 1000),
  });
  assert.equal(staff.type, 'email');
  assert.equal(staff.metadata['provider'], 'stub');
  assert.equal(staff.metadata['deliveryStatus'], 'stubbed');

  const result = await sendP;
  assert.equal(result.provider, 'stub');
  assert.equal(result.status, 'stubbed');
  assert.equal(result.ok, true);
  assert.match(result.messageId, /^stub_/);

  const thread = threadFromInteractions([
    {
      _id: 'g',
      body: guest.body,
      direction: guest.direction,
      createdAt: guest.createdAt,
      createdByName: guest.createdByName,
      metadata: guest.metadata,
    },
    {
      _id: 's',
      body: staff.body,
      direction: staff.direction,
      createdAt: staff.createdAt,
      createdByName: staff.createdByName,
      metadata: staff.metadata,
    },
  ]);
  assert.equal(eventHasUnansweredGuestMessage(thread), false);
});

test('inbox triage surfaces unanswered messages, unsigned proposals, unpaid deposits', () => {
  const triage = buildInboxTriage({
    threads: [
      {
        eventId: 'e1',
        eventTitle: 'Allen wedding',
        messages: [
          {
            id: '1',
            from: 'Kiasia',
            role: 'client',
            body: 'Is the patio available?',
            at: '2026-08-31T12:00:00.000Z',
            channel: 'portal',
            deliveryStatus: 'persisted',
          },
        ],
      },
    ],
    proposals: [
      { eventId: 'e1', eventTitle: 'Allen wedding', version: 2, status: 'viewed' },
      { eventId: 'e2', eventTitle: 'Done', version: 1, status: 'accepted' },
    ],
    events: [
      { eventId: 'e1', eventTitle: 'Allen wedding', balanceDue: 2500, amountPaid: 0 },
      { eventId: 'e2', eventTitle: 'Done', balanceDue: 0, amountPaid: 4000 },
    ],
  });
  assert.equal(triage.unansweredMessages.length, 1);
  assert.match(triage.unansweredMessages[0]!.preview, /patio/);
  assert.equal(triage.unsignedProposals.length, 1);
  assert.equal(triage.unsignedProposals[0]!.version, 2);
  assert.equal(triage.unpaidDeposits.length, 1);
  assert.ok(triage.templates.some(t => t.key === 'proposal'));
});

test('templates fill event fields and never imply a live send', () => {
  const rendered = renderTemplate('proposal', {
    firstName: 'Kiasia',
    eventTitle: 'Allen wedding',
    coordinator: 'Hannah',
  });
  assert.ok(rendered);
  assert.match(rendered!.body, /Allen wedding/);
  assert.match(rendered!.body, /Hannah/);
  assert.doesNotMatch(rendered!.body, /Stripe/i);
});
