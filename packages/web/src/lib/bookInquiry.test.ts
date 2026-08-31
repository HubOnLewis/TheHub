import assert from 'node:assert/strict';
import test from 'node:test';
import { bookInquiryPayload, validateBookInquiry } from './bookInquiry.js';

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
});
