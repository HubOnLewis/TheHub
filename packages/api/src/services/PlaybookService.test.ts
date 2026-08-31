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
  setPlaybookTaskStatus,
  setClientTimelineStepStatus,
  setDocumentOnFile,
  playbookScheduleToLedger,
  planPlaybookPaymentUpserts,
  eventDocFromClientDetails,
  buildClientDetailsDocHtml,
  buildStaffBeoChecklistHtml,
  staffBeoChecklistRows,
  paymentSummaryLedgerFields,
  buildGuestPaymentSummaryDocHtml,
  guestSafePayment,
  guestSafePayments,
  guestPaymentHasSecrets,
  toPaymentSummaryLedgerRow,
} = await import('@hub-crm/shared');
const { applyPlaybookToDealMeta, persistClientDetailsOnDealMeta, knownEventTypeFromCreate } = await import('./PlaybookService.js');

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

test('check-off persist: staff can mark a playbook task done and undo on the deal meta', () => {
  const applied = applyPlaybookToImportMeta({ eventDateIso: EVENT, grandTotal: 8000 }, 'wedding', NOW);
  const taskId = playbookFromImportMeta(applied)?.tasks.find(t => t.id === 'task-deposit')?.id;
  assert.ok(taskId);
  assert.equal(playbookFromImportMeta(applied)?.tasks.find(t => t.id === taskId)?.status, 'open');

  const done = setPlaybookTaskStatus(applied, taskId, 'done');
  assert.ok(done);
  assert.equal(playbookFromImportMeta(done)?.tasks.find(t => t.id === taskId)?.status, 'done');
  assert.equal(done.portalAccessToken, applied.portalAccessToken);
  assert.equal(playbookFromImportMeta(done)?.tasks.filter(t => t.status === 'done').length, 1);

  const undone = setPlaybookTaskStatus(done, taskId, 'open');
  assert.ok(undone);
  assert.equal(playbookFromImportMeta(undone)?.tasks.find(t => t.id === taskId)?.status, 'open');
});

test('check-off persist: re-apply keeps done tasks and unknown task ids return null', () => {
  const first = applyPlaybookToImportMeta({ eventDateIso: EVENT }, 'wedding', NOW);
  const marked = setPlaybookTaskStatus(first, 'task-deposit', 'done');
  assert.ok(marked);
  const reapplied = applyPlaybookToImportMeta(marked, 'wedding', NOW);
  assert.equal(playbookFromImportMeta(reapplied)?.tasks.find(t => t.id === 'task-deposit')?.status, 'done');
  assert.equal(playbookFromImportMeta(reapplied)?.tasks.find(t => t.id === 'task-balance')?.status, 'open');
  assert.equal(setPlaybookTaskStatus(reapplied, 'task-does-not-exist', 'done'), null);
});

test('payment_links created from playbook apply: deposit+balance amounts and upsert plan', () => {
  const { playbook } = applyEventPlaybook({
    eventType: 'wedding',
    eventDateIso: EVENT,
    grandTotal: 8000,
    now: NOW,
  });
  const rows = playbookScheduleToLedger(playbook.paymentSchedule, 8000);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.kind, 'deposit');
  assert.equal(rows[0]?.amount, 2000);
  assert.equal(rows[0]?.playbookPaymentId, 'pay-deposit');
  assert.equal(rows[1]?.kind, 'balance');
  assert.equal(rows[1]?.amount, 6000);
  assert.equal(rows[1]?.dueDate, '2026-10-03');

  const createPlan = planPlaybookPaymentUpserts(rows, []);
  assert.equal(createPlan.length, 2);
  assert.equal(createPlan[0]?.action, 'create');
  assert.equal(createPlan[1]?.action, 'create');

  const existing = [
    { id: 'plink_dep', kind: 'deposit', status: 'created', amount: 1500, playbookPaymentId: 'pay-deposit' },
  ];
  const updatePlan = planPlaybookPaymentUpserts(rows, existing);
  assert.equal(updatePlan.length, 2);
  assert.equal(updatePlan[0]?.action, 'update');
  if (updatePlan[0]?.action === 'update') {
    assert.equal(updatePlan[0].id, 'plink_dep');
    assert.equal(updatePlan[0].row.amount, 2000);
  }
  assert.equal(updatePlan[1]?.action, 'create');

  const paid = [
    { id: 'plink_paid', kind: 'deposit', status: 'paid', amount: 2000, playbookPaymentId: 'pay-deposit' },
  ];
  const skipPaid = planPlaybookPaymentUpserts(rows, paid);
  assert.equal(skipPaid.some(s => s.row.kind === 'deposit'), false);
  assert.equal(skipPaid.length, 1);
  assert.equal(skipPaid[0]?.row.kind, 'balance');

  assert.equal(playbookScheduleToLedger(playbook.paymentSchedule, 0).length, 0);
});

test('doc flag persist: seeded playbook docs toggle on-file on importMeta.documents', () => {
  const applied = applyPlaybookToImportMeta({ eventDateIso: EVENT }, 'wedding', NOW);
  assert.equal((applied.documents as Record<string, boolean>).alcoholDocs, false);

  const onFile = setDocumentOnFile(applied, 'alcoholDocs', true);
  assert.ok(onFile);
  assert.equal((onFile.documents as Record<string, boolean>).alcoholDocs, true);
  assert.equal((onFile.documents as Record<string, boolean>).agreement, false);

  const off = setDocumentOnFile(onFile, 'alcoholDocs', false);
  assert.ok(off);
  assert.equal((off.documents as Record<string, boolean>).alcoholDocs, false);

  const reapplied = applyPlaybookToImportMeta(onFile, 'wedding', NOW);
  assert.equal((reapplied.documents as Record<string, boolean>).alcoholDocs, true);

  assert.equal(setDocumentOnFile(applied, 'not-a-doc', true), null);
});

test('client timeline check-off persist: guest can mark a step done and undo on the deal meta', () => {
  const applied = applyPlaybookToImportMeta({ eventDateIso: EVENT, grandTotal: 8000 }, 'wedding', NOW);
  const stepId = playbookFromImportMeta(applied)?.clientTimeline.find(s => s.id === 'tl-count')?.id;
  assert.ok(stepId);
  assert.equal(playbookFromImportMeta(applied)?.clientTimeline.find(s => s.id === stepId)?.status, 'open');

  const done = setClientTimelineStepStatus(applied, stepId, 'done');
  assert.ok(done);
  assert.equal(playbookFromImportMeta(done)?.clientTimeline.find(s => s.id === stepId)?.status, 'done');
  assert.equal(playbookFromImportMeta(done)?.clientTimeline.filter(s => s.status === 'done').length, 1);
  assert.equal(done.portalAccessToken, applied.portalAccessToken);

  const undone = setClientTimelineStepStatus(done, stepId, 'open');
  assert.ok(undone);
  assert.equal(playbookFromImportMeta(undone)?.clientTimeline.find(s => s.id === stepId)?.status, 'open');
});

test('client timeline check-off persist: re-apply keeps done client steps and unknown ids return null', () => {
  const first = applyPlaybookToImportMeta({ eventDateIso: EVENT }, 'wedding', NOW);
  const marked = setClientTimelineStepStatus(first, 'tl-details', 'done');
  assert.ok(marked);
  const reapplied = applyPlaybookToImportMeta(marked, 'wedding', NOW);
  assert.equal(playbookFromImportMeta(reapplied)?.clientTimeline.find(s => s.id === 'tl-details')?.status, 'done');
  assert.equal(playbookFromImportMeta(reapplied)?.clientTimeline.find(s => s.id === 'tl-count')?.status, 'open');
  assert.equal(setClientTimelineStepStatus(reapplied, 'tl-does-not-exist', 'done'), null);
});

test('BEO/doc content includes clientDetails fields from importMeta', () => {
  const meta = persistClientDetailsOnDealMeta(
    { importMeta: { eventDateIso: EVENT } },
    {
      guestCount: 92,
      layout: 'Crescent tables',
      barPackage: 'full_bar',
      allergies: 'No tree nuts',
      musicCutoff: '10:00 PM',
      timelineBlocks: [
        { id: 'b1', label: 'Cocktail hour', startTime: '5:00 PM', endTime: '6:00 PM' },
      ],
      vendors: [{ id: 'v1', type: 'DJ', name: 'Spin Co', status: 'confirmed' }],
    },
    NOW,
  );
  const details = clientDetailsFromImportMeta(meta);
  const fields = eventDocFromClientDetails(details);
  assert.equal(fields.guestCount, '92');
  assert.equal(fields.layout, 'Crescent tables');
  assert.match(fields.barPackage, /full bar/i);
  assert.equal(fields.allergies, 'No tree nuts');
  assert.equal(fields.musicCutoff, '10:00 PM');
  assert.equal(fields.timelineBlocks[0]?.label, 'Cocktail hour');
  assert.equal(fields.vendors[0]?.name, 'Spin Co');

  const html = buildClientDetailsDocHtml(details);
  assert.match(html, /92/);
  assert.match(html, /Crescent tables/);
  assert.match(html, /Full bar/);
  assert.match(html, /Cocktail hour/);
  assert.match(html, /5:00 PM/);
  assert.match(html, /Spin Co/);
  assert.match(html, /No tree nuts/);
  assert.match(html, /10:00 PM/);
});

test('BEO staff checklist reflects playbook task done vs open', () => {
  const applied = applyPlaybookToImportMeta({ eventDateIso: EVENT, grandTotal: 8000 }, 'wedding', NOW);
  const marked = setPlaybookTaskStatus(applied, 'task-deposit', 'done');
  assert.ok(marked);
  const tasks = playbookFromImportMeta(marked)?.tasks;
  assert.ok(tasks && tasks.length > 0);

  const rows = staffBeoChecklistRows(tasks, 'Jordan Coord');
  const deposit = rows.find(r => /deposit/i.test(r.label));
  const balance = rows.find(r => /final balance/i.test(r.label));
  const count = rows.find(r => /guest count/i.test(r.label));
  assert.equal(deposit?.done, true);
  assert.equal(deposit?.owner, 'Jordan Coord');
  assert.equal(balance?.done, false);
  assert.equal(count?.done, false);

  const html = buildStaffBeoChecklistHtml(tasks, 'Jordan Coord');
  assert.match(html, /Staff checklist/);
  assert.match(html, /Collect deposit to hold the date<\/td><td>Jordan Coord<\/td><td>☑<\/td>/);
  assert.match(html, /Collect final balance<\/td><td>Jordan Coord<\/td><td>☐<\/td>/);
  assert.match(html, /Confirm final guest count/);
  assert.equal((html.match(/☑/g) || []).length, 1);
  assert.ok((html.match(/☐/g) || []).length >= 1);
});

test('guest payment summary print includes payment_links ledger fields', () => {
  const paid = paymentSummaryLedgerFields({
    kind: 'deposit',
    amount: 2000,
    status: 'paid',
    dueDate: '2026-08-31',
    paidAt: '2026-08-31T18:00:00.000Z',
  });
  assert.equal(paid.kind, 'Deposit');
  assert.equal(paid.amountLabel, '$2,000');
  assert.equal(paid.dueDate, '2026-08-31');
  assert.equal(paid.statusLabel, 'Paid');
  assert.equal(paid.paidOn, '2026-08-31');
  assert.equal(paid.paid, true);

  const open = paymentSummaryLedgerFields({
    kind: 'balance',
    amount: 6000,
    status: 'created',
    dueDate: '2026-10-03',
  });
  assert.equal(open.kind, 'Final balance');
  assert.equal(open.amountLabel, '$6,000');
  assert.equal(open.dueDate, '2026-10-03');
  assert.equal(open.statusLabel, 'Unpaid');
  assert.equal(open.paidOn, '—');
  assert.equal(open.paid, false);

  const html = buildGuestPaymentSummaryDocHtml({
    title: 'Allen wedding',
    eventDateDisplay: 'Saturday, October 17, 2026',
    packageTotal: 8000,
    paidTotal: 2000,
    balanceDue: 6000,
    payments: [
      { kind: 'deposit', amount: 2000, status: 'paid', dueDate: '2026-08-31', paidAt: '2026-08-31T18:00:00.000Z' },
      { kind: 'balance', amount: 6000, status: 'created', dueDate: '2026-10-03' },
    ],
  });
  assert.match(html, /Payment schedule/);
  assert.match(html, /Deposit/);
  assert.match(html, /Final balance/);
  assert.match(html, /\$2,000/);
  assert.match(html, /\$6,000/);
  assert.match(html, /\$8,000/);
  assert.match(html, /2026-08-31/);
  assert.match(html, /2026-10-03/);
  assert.match(html, /Paid/);
  assert.match(html, /Unpaid/);
  assert.doesNotMatch(html, /Stripe/i);
  assert.doesNotMatch(html, /hub_/);
});

test('public portal payment objects omit payment-link token and secrets', () => {
  const raw = {
    id: 'plink_1',
    eventId: 'evt_1',
    eventTitle: 'Allen wedding',
    kind: 'deposit',
    amount: 2000,
    currency: 'USD',
    status: 'paid',
    token: 'hub_secretpaytoken',
    note: 'Staff-only note',
    dueDate: '2026-08-31',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    paidAt: '2026-08-31T18:00:00.000Z',
    createdBy: 'Hannah',
    source: 'playbook',
    playbookPaymentId: 'pay-deposit',
  };
  const safe = guestSafePayment(raw);
  assert.equal(safe.kind, 'deposit');
  assert.equal(safe.amount, 2000);
  assert.equal(safe.status, 'paid');
  assert.equal(safe.dueDate, '2026-08-31');
  assert.equal(safe.paidAt, '2026-08-31T18:00:00.000Z');
  assert.equal('token' in safe, false);
  assert.equal('note' in safe, false);
  assert.equal('createdBy' in safe, false);
  assert.equal(guestPaymentHasSecrets(safe), false);
  const payload = { payments: guestSafePayments([raw]) };
  const json = JSON.stringify(payload);
  assert.doesNotMatch(json, /hub_secretpaytoken/);
  assert.doesNotMatch(json, /"token"/);
  assert.match(json, /"amount":2000/);
});

test('staff payment summary print uses payment_links ledger not importMeta receipts', () => {
  const links = [
    {
      kind: 'deposit',
      amount: 2000,
      status: 'paid',
      dueDate: '2026-08-31',
      paidAt: '2026-08-31T18:00:00.000Z',
      token: 'hub_staff_secret',
      method: 'Staff-recorded (not Stripe)',
      paymentType: 'deposit',
    },
    {
      kind: 'balance',
      amount: 6000,
      status: 'created',
      dueDate: '2026-10-03',
      token: 'hub_other_secret',
    },
  ];
  const rows = links.map(toPaymentSummaryLedgerRow);
  assert.equal(rows[0]?.kind, 'deposit');
  assert.equal('token' in rows[0], false);
  const html = buildGuestPaymentSummaryDocHtml({
    title: 'Allen wedding',
    eventDateDisplay: 'Saturday, October 17, 2026',
    packageTotal: 8000,
    paidTotal: 2000,
    balanceDue: 6000,
    payments: rows,
  });
  assert.match(html, /Payment schedule/);
  assert.match(html, /Deposit/);
  assert.match(html, /Final balance/);
  assert.match(html, /Paid/);
  assert.match(html, /Unpaid/);
  assert.match(html, /2026-08-31/);
  assert.match(html, /2026-10-03/);
  assert.doesNotMatch(html, /Staff-recorded/);
  assert.doesNotMatch(html, /hub_staff_secret/);
  assert.doesNotMatch(html, /hub_other_secret/);
  assert.doesNotMatch(html, /token/i);
  assert.doesNotMatch(html, /Stripe/i);
});

test('create-with-type applies playbook when event type is known', () => {
  assert.equal(knownEventTypeFromCreate({ eventType: 'Wedding' }), 'wedding');
  assert.equal(knownEventTypeFromCreate({ eventType: '  ' }), null);
  assert.equal(knownEventTypeFromCreate({}), null);
  assert.equal(knownEventTypeFromCreate(undefined), null);

  const created = { amount: 8000, importMeta: { eventType: 'Wedding', eventDateIso: EVENT, grandTotal: 8000 } };
  const type = knownEventTypeFromCreate(created.importMeta);
  assert.equal(type, 'wedding');
  const meta = applyPlaybookToDealMeta(created, type, NOW);
  const pb = playbookFromImportMeta(meta);
  assert.ok(pb);
  assert.equal(pb?.eventType, 'wedding');
  assert.ok((pb?.tasks.length ?? 0) > 0);
  assert.equal(pb?.paymentSchedule[0]?.kind, 'deposit');
});

test('create without event type does not auto-apply playbook', () => {
  const created = { amount: 2500, importMeta: { eventDateIso: EVENT } };
  assert.equal(knownEventTypeFromCreate(created.importMeta), null);
  assert.equal(playbookFromImportMeta(created.importMeta), null);
});
