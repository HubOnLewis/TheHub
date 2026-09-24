import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLeadAnalysisContext, buildLeadAnalysisJobInput } from './leadAnalysisPrompt.js';

const TEST_LEAD = {
  _id: 'lead-test-1',
  company: 'Test Party',
  contact: 'Alex Rivera',
  email: 'alex@example.com',
  phone: '316-555-0100',
  status: 'Converted',
  eventType: 'Private party',
  eventDate: '2026-12-09',
  guestCount: 35,
  notes: 'created as a test lead',
  convertedDealId: 'deal-linked-1',
};

test('converted private party test lead does not treat known facts as missing', () => {
  const ctx = buildLeadAnalysisContext(TEST_LEAD);
  assert.equal(ctx.isTestRecord, true);
  assert.match(ctx.statusMeaning, /Converted/i);
  assert.match(ctx.statusMeaning, /linked/i);
  assert.equal(ctx.venueFit.assessment, 'strong');
  assert.ok(ctx.knownFacts.some(f => f.includes('35')));
  assert.ok(ctx.knownFacts.some(f => f.includes('2026-12-09')));
  assert.ok(ctx.knownFacts.some(f => /Private party/i.test(f)));
  assert.ok(ctx.missingCandidates.some(f => /budget/i.test(f)));
  assert.ok(ctx.missingCandidates.every(f => !/guest count/i.test(f)));
  assert.ok(ctx.missingCandidates.every(f => !/event date/i.test(f)));
  assert.ok(ctx.doNotTreatAsMissing.includes('confirmation of guest count'));
  assert.ok(ctx.doNotTreatAsMissing.includes('confirmation of event date'));
  assert.ok(ctx.doNotTreatAsMissing.includes('contact confirmation'));
  assert.match(ctx.suggestedNextAction, /linked event/i);
  assert.doesNotMatch(ctx.suggestedNextAction, /Reach out to the lead/i);
  assert.equal(ctx.availabilityIncluded, false);

  const input = buildLeadAnalysisJobInput(TEST_LEAD);
  assert.match(input.userPrompt, /Availability not included in this analysis context/);
  assert.match(input.systemPrompt, /Never list them as missing/);
  assert.ok(input.systemPrompt.length < 1600, 'system prompt should stay compact for 20b latency');
  assert.equal(input.num_predict, 512);
  assert.match(input.suggestedNextAction, /Open linked event/);
});
