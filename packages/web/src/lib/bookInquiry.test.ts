import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AVAILABILITY_CHANGED_CODE,
  AVAILABILITY_CHANGED_MESSAGE,
  bookInquiryPayload,
  isAvailabilityChangedResponse,
  isRoomTakenResponse,
  isUsFriendlyPhone,
  ROOM_TAKEN_MESSAGE,
  validateBookInquiry,
} from './bookInquiry.js';

const valid = {
  name: 'Alex Guest',
  email: 'alex@example.com',
  eventDate: '2027-06-12',
  space: 'Main Hall',
  eventType: 'Wedding',
  guests: '80',
  phone: '316-555-0100',
  startTime: '17:00',
  endTime: '22:00',
};

test('book validation requires contact, date, room, type, guests, phone, and times', () => {
  const empty = validateBookInquiry({
    name: '',
    email: '',
    eventDate: '',
    space: '',
    eventType: '',
    guests: '',
  });
  assert.equal(empty.name, 'Please enter your name.');
  assert.equal(empty.phone, 'Please enter a valid phone number.');
  assert.equal(empty.startTime, 'Please choose a start time.');
  assert.equal(empty.endTime, 'Please choose an end time.');
});

test('valid inquiry payload marks public_availability source', () => {
  assert.deepEqual(validateBookInquiry(valid), {});
  const body = bookInquiryPayload(valid);
  assert.equal(body.source, 'public_availability');
  assert.equal(body.walkthroughRequested, false);
  assert.equal(body.endTime, '22:00');
});

test('US-friendly phone is required', () => {
  assert.equal(isUsFriendlyPhone(''), false);
  assert.equal(isUsFriendlyPhone('316-555-0100'), true);
});

test('409 AVAILABILITY_CHANGED is detected without dropping to generic copy only', () => {
  assert.equal(isAvailabilityChangedResponse(409, { code: AVAILABILITY_CHANGED_CODE, error: AVAILABILITY_CHANGED_MESSAGE }), true);
  assert.equal(isRoomTakenResponse(409, { error: ROOM_TAKEN_MESSAGE }), true);
});
