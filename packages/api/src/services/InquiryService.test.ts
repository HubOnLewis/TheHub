import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { PublicInquirySchema, isAssignedSpace } = await import('@hub-crm/shared');
const { mapPublicInquiryToRecords } = await import('./InquiryService.js');
const { knownEventTypeFromCreate } = await import('./PlaybookService.js');

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