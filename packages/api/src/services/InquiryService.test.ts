import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { PublicInquirySchema, PublicInquiryAvailabilitySchema, isAssignedSpace } = await import('@hub-crm/shared');
const {
  mapPublicInquiryToRecords,
  inquiryService,
  ROOM_TAKEN_MESSAGE,
  availabilityImportMeta,
} = await import('./InquiryService.js');
const { knownEventTypeFromCreate } = await import('./PlaybookService.js');
const { dealService } = await import('./DealService.js');
const { leadService } = await import('./LeadService.js');
const { BadRequestError, ConflictError } = await import('../errors/index.js');
const { DealRepository } = await import('../repositories/DealRepository.js');

test.afterEach(() => {
  mock.restoreAll();
});

test('public inquiry schema requires name, email, space, and event type', () => {
  const bad = PublicInquirySchema.safeParse({ name: '', email: 'not-an-email' });
  assert.equal(bad.success, false);
  const missingSpace = PublicInquirySchema.safeParse({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    eventType: 'Wedding',
  });
  assert.equal(missingSpace.success, false);
  const missingType = PublicInquirySchema.safeParse({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    space: 'Main Hall',
  });
  assert.equal(missingType.success, false);
  const ok = PublicInquirySchema.safeParse({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    eventType: 'Wedding',
    space: 'Main Hall',
    guests: 80,
  });
  assert.equal(ok.success, true);
});

test('availability schema requires date and space', () => {
  const missing = PublicInquiryAvailabilitySchema.safeParse({ eventDate: '', space: '' });
  assert.equal(missing.success, false);
  const ok = PublicInquiryAvailabilitySchema.safeParse({
    eventDate: '2026-10-17',
    space: 'Main Hall',
  });
  assert.equal(ok.success, true);
  const meta = availabilityImportMeta(ok.data);
  assert.equal(meta.startTime, '00:00');
  assert.equal(meta.endTime, '23:59');
  const timed = PublicInquiryAvailabilitySchema.safeParse({
    eventDate: '2026-10-17',
    space: 'Main Hall',
    startTime: '18:30',
  });
  assert.equal(timed.success, true);
  const timedMeta = availabilityImportMeta(timed.data);
  assert.equal(timedMeta.startTime, '18:30');
  assert.equal(timedMeta.endTime, '22:00');
});

test('public inquiry maps to lead+deal and known event type for playbook', () => {
  const mapped = mapPublicInquiryToRecords({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    eventType: 'Wedding',
    space: 'Main Hall',
    startTime: '17:00',
    endTime: '22:00',
    guests: 80,
  });
  assert.equal(mapped.lead.contact, 'Alex Guest');
  assert.equal(mapped.lead.eventType, 'Wedding');
  assert.equal(mapped.lead.status, 'New');
  assert.equal(mapped.deal.importMeta?.eventType, 'Wedding');
  assert.equal(mapped.deal.importMeta?.eventDateIso, '2026-10-17');
  assert.equal(mapped.deal.importMeta?.space, 'Main Hall');
  assert.equal(mapped.deal.importMeta?.source, 'public_inquiry');
  assert.equal(knownEventTypeFromCreate(mapped.deal.importMeta as Record<string, unknown>), 'wedding');
  assert.equal(isAssignedSpace(String(mapped.deal.importMeta?.space)), true);
});

const inquiryBody = {
  name: 'Alex Guest',
  email: 'alex@example.com',
  eventDate: '2026-10-17',
  eventType: 'Wedding',
  space: 'Main Hall',
  guests: 80,
};

function mockTakenMainHall() {
  mock.method(DealRepository, 'listOccupancyForDate', async () => ({
    data: [{
      _id: 'existing',
      title: 'Held wedding',
      status: 'Won',
      importMeta: {
        eventDateIso: '2026-10-17',
        space: 'Main Hall',
        startTime: '17:00',
        endTime: '22:00',
      },
    }],
    total: 1,
  }));
}

function mockNoLeadCreate() {
  let leadCalls = 0;
  let dealCalls = 0;
  mock.method(leadService, 'create', async () => {
    leadCalls += 1;
    return { _id: 'lead_should_not' };
  });
  mock.method(dealService, 'create', async () => {
    dealCalls += 1;
    return { _id: 'deal_should_not' };
  });
  return {
    leadCalls: () => leadCalls,
    dealCalls: () => dealCalls,
  };
}

test('missing space is 400 and does not create a lead', async () => {
  const calls = mockNoLeadCreate();
  await assert.rejects(
    () => inquiryService.create({} as never, {
      name: 'Alex Guest',
      email: 'alex@example.com',
      eventDate: '2026-10-17',
      eventType: 'Wedding',
    } as never),
    (err: unknown) => err instanceof BadRequestError && (err as { statusCode: number }).statusCode === 400,
  );
  assert.equal(calls.leadCalls(), 0);
  assert.equal(calls.dealCalls(), 0);
});

test('missing event type is 400 and does not create a lead', async () => {
  const calls = mockNoLeadCreate();
  await assert.rejects(
    () => inquiryService.create({} as never, {
      name: 'Alex Guest',
      email: 'alex@example.com',
      eventDate: '2026-10-17',
      space: 'Main Hall',
    } as never),
    (err: unknown) => err instanceof BadRequestError && (err as { statusCode: number }).statusCode === 400,
  );
  assert.equal(calls.leadCalls(), 0);
  assert.equal(calls.dealCalls(), 0);
});

test('TBD space is 400 and does not create a lead', async () => {
  const calls = mockNoLeadCreate();
  await assert.rejects(
    () => inquiryService.create({} as never, {
      name: 'Alex Guest',
      email: 'alex@example.com',
      eventDate: '2026-10-17',
      eventType: 'Wedding',
      space: 'TBD',
    } as never),
    (err: unknown) => err instanceof BadRequestError && (err as { statusCode: number }).statusCode === 400,
  );
  assert.equal(calls.leadCalls(), 0);
  assert.equal(calls.dealCalls(), 0);
});

test('conflict rejection does not create a lead or deal', async () => {
  mockTakenMainHall();
  const calls = mockNoLeadCreate();

  await assert.rejects(
    () => inquiryService.create({} as never, inquiryBody),
    (err: unknown) => err instanceof ConflictError && (err as Error).message === ROOM_TAKEN_MESSAGE,
  );
  assert.equal(calls.leadCalls(), 0);
  assert.equal(calls.dealCalls(), 0);
});

test('availability conflict does not create a lead', async () => {
  mockTakenMainHall();
  const calls = mockNoLeadCreate();

  await assert.rejects(
    () => inquiryService.checkAvailability({} as never, { eventDate: '2026-10-17', space: 'Main Hall' }),
    (err: unknown) => err instanceof ConflictError && (err as Error).message === ROOM_TAKEN_MESSAGE,
  );
  assert.equal(calls.leadCalls(), 0);
  assert.equal(calls.dealCalls(), 0);
});

test('availability with startTime uses that start and default end', async () => {
  let seen: Record<string, unknown> | undefined;
  mock.method(dealService, 'assertSpaceAvailability', async (_db, _ctx, meta) => {
    seen = meta as Record<string, unknown>;
  });
  await inquiryService.checkAvailability({} as never, {
    eventDate: '2026-10-17',
    space: 'Main Hall',
    startTime: '18:30',
  });
  assert.equal(seen?.startTime, '18:30');
  assert.equal(seen?.endTime, '22:00');
});

test('availability without startTime stays day-level', async () => {
  let seen: Record<string, unknown> | undefined;
  mock.method(dealService, 'assertSpaceAvailability', async (_db, _ctx, meta) => {
    seen = meta as Record<string, unknown>;
  });
  await inquiryService.checkAvailability({} as never, {
    eventDate: '2026-10-17',
    space: 'Main Hall',
  });
  assert.equal(seen?.startTime, '00:00');
  assert.equal(seen?.endTime, '23:59');
});

test('availability ok returns available true without creating a lead', async () => {
  mock.method(dealService, 'assertSpaceAvailability', async () => undefined);
  const calls = mockNoLeadCreate();

  const result = await inquiryService.checkAvailability({} as never, {
    eventDate: '2026-10-17',
    space: 'Main Hall',
  });
  assert.equal(result.available, true);
  assert.equal(result.eventDate, '2026-10-17');
  assert.equal(result.space, 'Main Hall');
  assert.equal(calls.leadCalls(), 0);
});

test('successful inquiry returns portalUrl', async () => {
  mock.method(dealService, 'assertSpaceAvailability', async () => undefined);
  mock.method(leadService, 'create', async () => ({ _id: 'lead_1' }));
  mock.method(dealService, 'create', async () => ({ _id: 'deal_1' }));
  mock.method(inquiryService, 'mintPortal', async () => ({
    token: 'tok',
    path: '/portal/login?access=tok',
    reused: false,
  }));

  const result = await inquiryService.create({} as never, inquiryBody);
  assert.equal(result.eventId, 'deal_1');
  assert.equal(result.leadId, 'lead_1');
  assert.equal(result.portalPath, '/portal/login?access=tok');
  assert.equal(result.portalUrl, 'https://admin.hubonlewis.com/portal/login?access=tok');
  assert.equal(result.emailStatus, 'stubbed');
});

test('public inquiry stores phone, startTime, and notes on lead and importMeta', () => {
  const mapped = mapPublicInquiryToRecords({
    name: 'Alex Guest',
    email: 'alex@example.com',
    phone: '316-555-0100',
    eventDate: '2026-10-17',
    eventType: 'Wedding',
    space: 'Main Hall',
    startTime: '18:30',
    guests: 80,
    notes: 'Garden ceremony vibe',
  });
  assert.equal(mapped.lead.phone, '316-555-0100');
  assert.equal(mapped.lead.notes, 'Garden ceremony vibe');
  assert.equal(mapped.deal.notes, 'Garden ceremony vibe');
  assert.equal(mapped.deal.importMeta?.startTime, '18:30');
  assert.equal(mapped.deal.importMeta?.contactPhone, '316-555-0100');
  assert.equal(mapped.deal.importMeta?.inquiryNotes, 'Garden ceremony vibe');
});
