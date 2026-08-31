import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bookAvailabilityPayload,
  bookInquiryPayload,
  isRoomTakenResponse,
  isUsFriendlyPhone,
  ROOM_TAKEN_MESSAGE,
  validateBookInquiry,
} from './bookInquiry.js';

test('book validation requires name, email, date, room, type, and guest count', () => {
  const empty = validateBookInquiry({
    name: '',
    email: '',
    eventDate: '',
    space: '',
    eventType: '',
    guests: '',
  });
  assert.equal(empty.name, 'Please enter your name.');
  assert.equal(empty.email, 'Please enter your email.');
  assert.equal(empty.eventDate, 'Please pick a date.');
  assert.equal(empty.space, 'Please pick a room.');
  assert.equal(empty.eventType, 'Please pick an event type.');
  assert.equal(empty.guests, 'Please enter a guest count.');
});

test('empty room and event type are rejected when other fields are filled', () => {
  const missing = validateBookInquiry({
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2027-06-12',
    space: '',
    eventType: '',
    guests: '80',
  });
  assert.equal(missing.space, 'Please pick a room.');
  assert.equal(missing.eventType, 'Please pick an event type.');
  assert.equal(missing.name, undefined);
  assert.equal(missing.email, undefined);
});

test('book validation rejects invalid email and zero guests; empty guests is not 80', () => {
  const bad = validateBookInquiry({
    name: 'Alex',
    email: 'not-an-email',
    eventDate: '2027-06-12',
    space: 'Main Hall',
    eventType: 'Wedding',
    guests: '0',
  });
  assert.equal(bad.email, 'Please enter a valid email.');
  assert.equal(bad.guests, 'Please enter a guest count.');
  const missingGuests = validateBookInquiry({
    name: 'Alex',
    email: 'alex@example.com',
    eventDate: '2027-06-12',
    space: 'Main Hall',
    eventType: 'Wedding',
    guests: '',
  });
  assert.equal(missingGuests.guests, 'Please enter a guest count.');
  assert.equal(Object.keys(missingGuests).join(), 'guests');
});

test('phone is optional; present values need basic US-friendly digits', () => {
  assert.equal(isUsFriendlyPhone(''), true);
  assert.equal(isUsFriendlyPhone(undefined), true);
  assert.equal(isUsFriendlyPhone('316-555-0100'), true);
  assert.equal(isUsFriendlyPhone('(316) 555-0100'), true);
  assert.equal(isUsFriendlyPhone('+1 316 555 0100'), true);
  assert.equal(isUsFriendlyPhone('555-0100'), false);
  const invalid = validateBookInquiry({
    name: 'Alex',
    email: 'alex@example.com',
    eventDate: '2027-06-12',
    space: 'Main Hall',
    eventType: 'Wedding',
    guests: '80',
    phone: '555-0100',
  });
  assert.equal(invalid.phone, 'Please enter a valid phone number.');
  const optional = validateBookInquiry({
    name: 'Alex',
    email: 'alex@example.com',
    eventDate: '2027-06-12',
    space: 'Main Hall',
    eventType: 'Wedding',
    guests: '80',
    phone: '',
  });
  assert.equal(optional.phone, undefined);
});

test('valid book inquiry passes phone, start time, and notes through the payload', () => {
  const fields = {
    name: 'Alex Guest',
    email: 'alex@example.com',
    eventDate: '2027-06-12',
    space: 'Main Hall',
    eventType: 'Wedding',
    guests: '80',
    phone: '316-555-0100',
    startTime: '17:00',
    notes: 'Garden ceremony',
  };
  assert.deepEqual(validateBookInquiry(fields), {});
  const body = bookInquiryPayload(fields);
  assert.equal(body.guests, 80);
  assert.equal(body.phone, '316-555-0100');
  assert.equal(body.startTime, '17:00');
  assert.equal(body.notes, 'Garden ceremony');
  assert.deepEqual(bookAvailabilityPayload(fields), { eventDate: '2027-06-12', space: 'Main Hall', startTime: '17:00' });
  assert.deepEqual(bookAvailabilityPayload({ eventDate: '2027-06-12', space: 'Main Hall' }), { eventDate: '2027-06-12', space: 'Main Hall' });
});

test('room-taken response is 409 or available false; start time stays optional', () => {
  assert.equal(isRoomTakenResponse(409, { error: ROOM_TAKEN_MESSAGE }), true);
  assert.equal(isRoomTakenResponse(200, { available: false }), true);
  assert.equal(isRoomTakenResponse(200, { available: true }), false);
  const noTime = validateBookInquiry({
    name: 'Alex',
    email: 'alex@example.com',
    eventDate: '2027-06-12',
    space: 'Main Hall',
    eventType: 'Wedding',
    guests: '80',
    startTime: '',
  });
  assert.deepEqual(noTime, {});
});
