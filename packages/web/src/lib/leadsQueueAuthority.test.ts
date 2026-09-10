/**
 * Leads queue authority — live Mongo primary, Perfect Venue import secondary.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importedMasqueradesAsLiveCrm,
  resolveLeadsQueueAuthority,
} from './leadsQueueAuthority.js';
import { matchesLeadFilter } from './liveDataMappers.js';

test('live API success with Converted-only leads stays on LIVE CRM (not PV fallback)', () => {
  const auth = resolveLeadsQueueAuthority({
    isLoading: false,
    isError: false,
    liveTotal: 2,
    hasImportedRecords: true,
    selectedView: 'live',
  });
  assert.equal(auth.view, 'live');
  assert.equal(auth.sourceLabel, 'LIVE CRM');
  assert.equal(auth.liveApiOk, true);
  assert.equal(auth.allowImportedReference, true);
  assert.equal(auth.liveHint, null);
});

test('live API success with zero leads shows honest empty live queue, not PV as primary', () => {
  const auth = resolveLeadsQueueAuthority({
    isLoading: false,
    isError: false,
    liveTotal: 0,
    hasImportedRecords: true,
    selectedView: 'live',
  });
  assert.equal(auth.view, 'live');
  assert.equal(auth.sourceLabel, 'LIVE CRM');
  assert.match(auth.liveHint ?? '', /No live CRM leads/);
});

test('operator may open Perfect Venue import as secondary reference only', () => {
  const auth = resolveLeadsQueueAuthority({
    isLoading: false,
    isError: false,
    liveTotal: 2,
    hasImportedRecords: true,
    selectedView: 'imported',
  });
  assert.equal(auth.view, 'imported');
  assert.equal(auth.sourceLabel, 'PERFECT VENUE IMPORT');
  assert.equal(importedMasqueradesAsLiveCrm(auth), false);
});

test('imported view unavailable when no import records exist', () => {
  const auth = resolveLeadsQueueAuthority({
    isLoading: false,
    isError: false,
    liveTotal: 1,
    hasImportedRecords: false,
    selectedView: 'imported',
  });
  assert.equal(auth.view, 'live');
  assert.equal(auth.sourceLabel, 'LIVE CRM');
});

test('API error keeps LIVE CRM labeling and does not auto-swap to PV as live', () => {
  const auth = resolveLeadsQueueAuthority({
    isLoading: false,
    isError: true,
    liveTotal: 0,
    hasImportedRecords: true,
    selectedView: 'live',
  });
  assert.equal(auth.view, 'live');
  assert.equal(auth.sourceLabel, 'LIVE CRM');
  assert.equal(auth.liveApiOk, false);
  assert.match(auth.liveHint ?? '', /Could not load/);
});

test('matchesLeadFilter all includes Converted live CRM leads', () => {
  assert.equal(matchesLeadFilter({ status: 'Converted' }, 'all'), true);
  assert.equal(matchesLeadFilter({ status: 'New' }, 'all'), true);
  assert.equal(matchesLeadFilter({ status: 'Lost' }, 'all'), true);
  assert.equal(matchesLeadFilter({ status: 'Converted' }, 'open'), false);
  assert.equal(matchesLeadFilter({ status: 'New' }, 'open'), true);
  assert.equal(matchesLeadFilter({ status: 'Converted' }, 'converted'), true);
});
