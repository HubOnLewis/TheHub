import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { PublicInquirySchema, PublicInquiryAvailabilitySchema, isAssignedSpace } = await import('@hub-crm/shared');
const {
  mapPublicInquiryToRecords,
  inquiryService,
  SPACE_TAKEN_MESSAGE,
  ROOM_TAKEN_MESSAGE,
  availabilityImportMeta,
} = await import('./InquiryService.js');
const { knownEventTypeFromCreate } = await import('./PlaybookService.js');
const { dealService } = await import('./DealService.js');
const { leadService } = await import('./LeadService.js');
const { ConflictError } = await import('../errors/index.js');
const { DealRepository } = await import('../repositories/DealRepository.js');

test.afterEach(() => {
  mock.restoreAll();
});

test('public inquiry schema requires name and email', () => {
  const bad = PublicInquirySchema.safeParse({ name: '', email: 'not-an-email' });
  assert.equal(bad.success, false);
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

test('public inquiry without space skips occupancy fields so dated holds stay possible', () => {
  const mapped = mapPublicInquiryToRecords({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2026-10-17',
    eventType: 'Birthday',
  });
  assert.equal(mapped.deal.importMeta?.eventDate, '2026-10-17');
  assert.equal(mapped.deal.importMeta?.eventDateIso, undefined);
  assert.equal(mapped.deal.importMeta?.space, undefined);
  assert.equal(knownEventTypeFromCreate(mapped.deal.importMeta as Record<string, unknown>), 'social');
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

test('conflict rejection does not create a lead or deal', async () => {
  mockTakenMainHall();
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

  await assert.rejects(
    () => inquiryService.create({} as never, inquiryBody),
    (err: unknown) => err instanceof ConflictError && (err as Error).message === SPACE_TAKEN_MESSAGE,
  );
  assert.equal(leadCalls, 0);
  assert.equal(dealCalls, 0);
});

test('availability conflict does not create a lead', async () => {
  mockTakenMainHall();
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

  await assert.rejects(
    () => inquiryService.checkAvailability({} as never, { eventDate: '2026-10-17', space: 'Main Hall' }),
    (err: unknown) => err instanceof ConflictError && (err as Error).message === ROOM_TAKEN_MESSAGE,
  );
  assert.equal(leadCalls, 0);
  assert.equal(dealCalls, 0);
});

test('availability ok returns available true without creating a lead', async () => {
  mock.method(dealService, 'assertSpaceAvailability', async () => undefined);
  let leadCalls = 0;
  mock.method(leadService, 'create', async () => {
    leadCalls += 1;
    return { _id: 'lead_should_not' };
  });

  const result = await inquiryService.checkAvailability({} as never, {
    eventDate: '2026-10-17',
    space: 'Main Hall',
  });
  assert.equal(result.available, true);
  assert.equal(result.eventDate, '2026-10-17');
  assert.equal(result.space, 'Main Hall');
  assert.equal(leadCalls, 0);
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
