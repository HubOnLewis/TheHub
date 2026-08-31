import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const {
  applyEventPlaybook,
  applyPlaybookToImportMeta,
  playbookFromImportMeta,
  resolveEventType,
  resolveContractTerms,
  DEFAULT_HUB_CONTRACT_TERMS,
  applyClientDetailsToImportMeta,
  clientDetailsFromImportMeta,
  clientDetailsAreComplete,
  extraContacts,
  parseClientDetails,
} = await import('@hub-crm/shared');
const { applyPlaybookToDealMeta, persistClientDetailsOnDealMeta } = await import('./PlaybookService.js');

const EVENT = '2026-10-17';
const NOW = new Date('2026-08-31T18:00:00.000Z');

test('resolveEventType maps venue language onto playbook keys', () => {
  assert.equal(resolveEventType('Wedding'), 'wedding');
  assert.equal(resolveEventType('baby shower'), 'social');
  assert.equal(resolveEventType('Corporate lunch'), 'corporate');
  assert.equal(resolveEventType('gala'), 'nonprofit');
  assert.equal(resolveEventType(''), 'other');
});

test('playbook apply: wedding generates tasks, deposit+balance, alcohol docs, timeline keyed off event date', () => {
  const { playbook, importMetaPatch } = applyEventPlaybook({
    eventType: 'wedding',
    eventDateIso: EVENT,
    grandTotal: 8000,
    now: NOW,
  });

  assert.equal(playbook.eventType, 'wedding');
  assert.ok(playbook.tasks.some(t => /guest count/i.test(t.label)));
  assert.ok(playbook.tasks.some(t => /alcohol/i.test(t.label)));
  assert.ok(playbook.tasks.some(t => /vendor/i.test(t.label)));

  assert.equal(playbook.paymentSchedule.length, 2);
  assert.equal(playbook.paymentSchedule[0]?.kind, 'deposit');
  assert.equal(playbook.paymentSchedule[0]?.percent, DEFAULT_HUB_CONTRACT_TERMS.depositPercent);
  assert.equal(playbook.paymentSchedule[1]?.kind, 'balance');
  assert.equal(playbook.paymentSchedule[0]?.dueDate, '2026-08-31');
  assert.equal(playbook.paymentSchedule[1]?.dueDate, '2026-10-03');

  assert.ok(playbook.documents.some(d => d.key === 'alcoholDocs' && d.required));
  assert.ok(playbook.documents.some(d => d.key === 'staffBeo'));

  const count = playbook.clientTimeline.find(s => s.id === 'tl-count');
  assert.equal(count?.dueDate, '2026-10-03');
  const alcohol = playbook.clientTimeline.find(s => s.id === 'tl-alcohol');
  assert.equal(alcohol?.dueDate, '2026-09-26');
  assert.equal(importMetaPatch.eventType, 'wedding');
  assert.equal((importMetaPatch.playbook as { eventType: string }).eventType, 'wedding');
});

test('playbook apply: corporate skips alcohol docs and uses AV rider', () => {
  const { playbook } = applyEventPlaybook({
    eventType: 'corporate',
    eventDateIso: EVENT,
    now: NOW,
  });
  assert.equal(playbook.documents.some(d => d.key === 'alcoholDocs'), false);
  assert.ok(playbook.documents.some(d => d.key === 'avRider'));
  assert.ok(playbook.tasks.some(t => /AV/i.test(t.label)));
  assert.equal(playbook.clientTimeline.some(s => s.id === 'tl-alcohol'), false);
});

test('playbook apply: existing Hub contract terms override default windows', () => {
  const { playbook } = applyEventPlaybook({
    eventType: 'wedding',
    eventDateIso: EVENT,
    existingMeta: {
      contractTerms: {
        depositPercent: 0.5,
        finalCountDaysBeforeEvent: 7,
        balanceDaysBeforeEvent: 7,
        alcoholDocsDaysBeforeEvent: 10,
      },
    },
    now: NOW,
  });
  assert.equal(playbook.terms.depositPercent, 0.5);
  assert.equal(playbook.paymentSchedule[0]?.percent, 0.5);
  assert.equal(playbook.clientTimeline.find(s => s.id === 'tl-count')?.dueDate, '2026-10-10');
  assert.equal(playbook.clientTimeline.find(s => s.id === 'tl-balance')?.dueDate, '2026-10-10');
  assert.equal(playbook.clientTimeline.find(s => s.id === 'tl-alcohol')?.dueDate, '2026-10-07');
});

test('playbook apply preserves clientDetails, payments, and portal token on importMeta', () => {
  const next = applyPlaybookToImportMeta(
    {
      portalAccessToken: 'tok_keep',
      amountPaid: 1000,
      guests: 80,
      clientDetails: { guestCount: 80, layout: 'Round banquet' },
      eventDateIso: EVENT,
    },
    'wedding',
    NOW,
  );
  assert.equal(next.portalAccessToken, 'tok_keep');
  assert.equal(next.amountPaid, 1000);
  assert.equal((next.clientDetails as { guestCount: number }).guestCount, 80);
  assert.equal(playbookFromImportMeta(next)?.eventType, 'wedding');
});

test('applyPlaybookToDealMeta uses deal amount as grandTotal fallback', () => {
  const meta = applyPlaybookToDealMeta(
    { amount: 5000, importMeta: { eventDateIso: EVENT } },
    'private',
    NOW,
  );
  assert.equal(meta.grandTotal, 5000);
  assert.equal(playbookFromImportMeta(meta)?.eventType, 'private');
});

test('portal details persist onto the deal and sync guests for staff/BEO', () => {
  const next = persistClientDetailsOnDealMeta(
    {
      importMeta: {
        eventDateIso: EVENT,
        space: 'Event Space',
        guests: 40,
      },
    },
    {
      guestCount: 92,
      layout: 'Crescent tables',
      barPackage: 'full_bar',
      allergies: 'No tree nuts',
      musicCutoff: '10:00 PM',
      timelineBlocks: [
        { id: 'b1', label: 'Cocktail hour', startTime: '5:00 PM', endTime: '6:00 PM' },
        { id: 'b2', label: 'Dinner', startTime: '6:00 PM', endTime: '8:00 PM' },
      ],
      vendors: [{ id: 'v1', type: 'DJ', name: 'Spin Co', status: 'confirmed' }],
      contacts: [
        { name: 'Alex Planner', email: 'alex@planner.test', role: 'planner' },
      ],
    },
    NOW,
  );

  assert.equal(next.guests, 92);
  assert.equal(next.layout, 'Crescent tables');
  assert.equal(next.barPackage, 'full_bar');
  assert.equal(next.detailsConfirmed, true);

  const details = clientDetailsFromImportMeta(next);
  assert.equal(details.guestCount, 92);
  assert.equal(details.allergies, 'No tree nuts');
  assert.equal(details.musicCutoff, '10:00 PM');
  assert.equal(details.timelineBlocks?.length, 2);
  assert.equal(details.vendors?.[0]?.name, 'Spin Co');
  assert.equal(extraContacts(details)[0]?.role, 'planner');
  assert.equal(clientDetailsAreComplete(details), true);
});

test('portal details merge — later patch does not wipe earlier fields', () => {
  const first = applyClientDetailsToImportMeta(
    {},
    { guestCount: 50, layout: 'Open lounge', allergies: 'Shellfish' },
    NOW,
  );
  const second = applyClientDetailsToImportMeta(
    first,
    { musicCutoff: '9:30 PM', barPackage: 'beer_wine' },
    NOW,
  );
  const details = parseClientDetails(second.clientDetails);
  assert.equal(details.guestCount, 50);
  assert.equal(details.layout, 'Open lounge');
  assert.equal(details.allergies, 'Shellfish');
  assert.equal(details.musicCutoff, '9:30 PM');
  assert.equal(details.barPackage, 'beer_wine');
});

test('multi-contact stores planner beside primary without replacing deal.contact', () => {
  const deal = { contact: 'Kiasia Allen', importMeta: {} };
  const meta = persistClientDetailsOnDealMeta(deal, {
    contacts: [
      { name: 'Kiasia Allen', role: 'client' },
      { name: 'Jordan Planner', email: 'jordan@planner.test', role: 'planner' },
    ],
  }, NOW);
  assert.equal(deal.contact, 'Kiasia Allen');
  const extras = extraContacts(clientDetailsFromImportMeta(meta));
  assert.equal(extras.length, 1);
  assert.equal(extras[0]?.name, 'Jordan Planner');
});

test('resolveContractTerms reads importMeta.contractTerms when present', () => {
  const terms = resolveContractTerms({
    contractTerms: { depositPercent: 30, finalCountDaysBeforeEvent: 10 },
  });
  assert.equal(terms.depositPercent, 0.3);
  assert.equal(terms.finalCountDaysBeforeEvent, 10);
  assert.equal(terms.balanceDaysBeforeEvent, DEFAULT_HUB_CONTRACT_TERMS.balanceDaysBeforeEvent);
});
