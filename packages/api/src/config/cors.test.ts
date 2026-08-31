import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  PUBLIC_INQUIRY_ORIGINS,
  createOriginMatcher,
  mergePublicInquiryOrigins,
} from './cors.js';

test('public inquiry CORS always includes admin and localhost, never wildcard', () => {
  const merged = mergePublicInquiryOrigins([]);
  assert.equal(merged.includes('*'), false);
  assert.ok(merged.includes('https://admin.hubonlewis.com'));
  assert.ok(merged.includes('http://localhost:5173'));
  assert.ok(merged.includes('http://127.0.0.1:5173'));
  assert.equal(PUBLIC_INQUIRY_ORIGINS.includes('*' as (typeof PUBLIC_INQUIRY_ORIGINS)[number]), false);
});

test('public inquiry origin matcher allows admin and localhost and rejects others', () => {
  const matcher = createOriginMatcher(mergePublicInquiryOrigins([]));
  assert.equal(matcher.isAllowed('https://admin.hubonlewis.com'), true);
  assert.equal(matcher.isAllowed('http://localhost:5173'), true);
  assert.equal(matcher.isAllowed('http://127.0.0.1:5173'), true);
  assert.equal(matcher.isAllowed('https://evil.example'), false);
  assert.equal(matcher.isAllowed('*'), false);
});

test('mergePublicInquiryOrigins strips a wildcard if one is passed in', () => {
  const merged = mergePublicInquiryOrigins(['https://admin.hubonlewis.com', '*']);
  assert.equal(merged.includes('*'), false);
  assert.ok(merged.includes('https://admin.hubonlewis.com'));
});