import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';

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
const { publicAvailabilityService } = await import('./PublicAvailabilityService.js');
const { AVAILABILITY_CHANGED_CODE, AVAILABILITY_CHANGED_MESSAGE } = await import('@hub-crm/shared');
const { BadRequestError, ConflictError } = await import('../errors/index.js');
const { DealRepository } = await import('../repositories/DealRepository.js');

test.afterEach(() => {
  mock.restoreAll();
});

test('public inquiry schema requires name, email, date, space, and event type', () => {
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
  const missingDate = PublicInquirySchema.safeParse({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventType: 'Wedding',
    space: 'Main Hall',
  });
  assert.equal(missingDate.success, false);
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
  assert.equal(meta.startTime, '17:00');
  assert.equal(meta.endTime, '22:00');
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
  assert.equal(typeof mapped.deal.importMeta?.holdExpiresAt, 'string');
  assert.ok(Date.parse(String(mapped.deal.importMeta?.holdExpiresAt)) > Date.now());
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

function mockPublicDay(status: 'available' | 'hold' | 'booked' | 'closed' = 'available') {
  mock.method(publicAvailabilityService, 'dayForDate', async () => ({
    date: '2026-10-17',
    status,
    morning: status,
    evening: status,
  }));
}

function mockTakenMainHall() {
  mockPublicDay('available');
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

test('missing event date is 400 and does not create a lead', async () => {
  const calls = mockNoLeadCreate();
  await assert.rejects(
    () => inquiryService.create({} as never, {
      name: 'Alex Guest',
      email: 'alex@example.com',
      eventType: 'Wedding',
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
    (err: unknown) =>
      err instanceof ConflictError &&
      (err as Error).message === AVAILABILITY_CHANGED_MESSAGE &&
      (err as { code?: string }).code === AVAILABILITY_CHANGED_CODE,
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

test('availability and create share 17:00-22:00 when startTime is omitted', () => {
  const avail = availabilityImportMeta({ eventDate: '2026-10-17', space: 'Main Hall' });
  const mapped = mapPublicInquiryToRecords({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    eventType: 'Wedding',
    space: 'Main Hall',
  });
  assert.equal(avail.startTime, '17:00');
  assert.equal(avail.endTime, '22:00');
  assert.equal(mapped.deal.importMeta?.startTime, '17:00');
  assert.equal(mapped.deal.importMeta?.endTime, '22:00');
});

test('availability and create use sent startTime with default end 22:00', () => {
  const avail = availabilityImportMeta({
    eventDate: '2026-10-17',
    space: 'Main Hall',
    startTime: '18:30',
  });
  const mapped = mapPublicInquiryToRecords({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    eventType: 'Wedding',
    space: 'Main Hall',
    startTime: '18:30',
  });
  assert.equal(avail.startTime, '18:30');
  assert.equal(avail.endTime, '22:00');
  assert.equal(mapped.deal.importMeta?.startTime, '18:30');
  assert.equal(mapped.deal.importMeta?.endTime, '22:00');
});

test('availability with startTime uses that start and default end', async () => {
  let seen: Record<string, unknown> | undefined;
  mock.method(dealService, 'assertSpaceAvailability', async (_db: Db, _ctx: TenantContext, meta: Record<string, unknown> | undefined) => {
    seen = meta;
  });
  await inquiryService.checkAvailability({} as never, {
    eventDate: '2026-10-17',
    space: 'Main Hall',
    startTime: '18:30',
  });
  assert.equal(seen?.startTime, '18:30');
  assert.equal(seen?.endTime, '22:00');
});

test('availability without startTime uses the create default window', async () => {
  let seen: Record<string, unknown> | undefined;
  mock.method(dealService, 'assertSpaceAvailability', async (_db: Db, _ctx: TenantContext, meta: Record<string, unknown> | undefined) => {
    seen = meta;
  });
  await inquiryService.checkAvailability({} as never, {
    eventDate: '2026-10-17',
    space: 'Main Hall',
  });
  assert.equal(seen?.startTime, '17:00');
  assert.equal(seen?.endTime, '22:00');
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

test('date that became booked returns AVAILABILITY_CHANGED without creating records', async () => {
  mockPublicDay('booked');
  const calls = mockNoLeadCreate();
  await assert.rejects(
    () => inquiryService.create({} as never, inquiryBody),
    (err: unknown) =>
      err instanceof ConflictError &&
      (err as { code?: string }).code === AVAILABILITY_CHANGED_CODE,
  );
  assert.equal(calls.leadCalls(), 0);
  assert.equal(calls.dealCalls(), 0);
});

test('evening default is rejected when only the morning is open', async () => {
  mock.method(publicAvailabilityService, 'dayForDate', async () => ({
    date: '2026-10-17',
    status: 'partial' as const,
    morning: 'available' as const,
    evening: 'booked' as const,
  }));
  const calls = mockNoLeadCreate();
  await assert.rejects(
    () => inquiryService.create({} as never, inquiryBody),
    (err: unknown) => err instanceof ConflictError,
  );
  assert.equal(calls.leadCalls(), 0);
});

test('morning request is accepted when only the evening is booked', async () => {
  mock.method(publicAvailabilityService, 'dayForDate', async () => ({
    date: '2026-10-17',
    status: 'partial' as const,
    morning: 'available' as const,
    evening: 'booked' as const,
  }));
  mock.method(dealService, 'assertSpaceAvailability', async () => undefined);
  mock.method(leadService, 'create', async () => ({ _id: 'lead_am' }));
  mock.method(dealService, 'create', async () => ({ _id: 'deal_am' }));
  mock.method(inquiryService, 'mintPortal', async () => ({
    token: 'tok',
    path: '/portal/login?access=tok',
    reused: false,
  }));
  const result = await inquiryService.create({} as never, {
    ...inquiryBody,
    startTime: '09:00',
    endTime: '14:00',
  });
  assert.equal(result.eventId, 'deal_am');
});

test('successful inquiry returns portalUrl', async () => {
  mockPublicDay('available');
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
  assert.equal(result.confirmedBooking, false);
  assert.equal(result.received, true);
  assert.equal(result.requestedDate, '2026-10-17');
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
