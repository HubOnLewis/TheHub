// packages/api/src/services/AiJobService.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultTaskTypeForAgent, isLocalAiAgentId } from '@hub-crm/shared';

test('local agent allowlist rejects arbitrary names', () => {
  assert.equal(isLocalAiAgentId('lead-intelligence'), true);
  assert.equal(isLocalAiAgentId('event-operations'), true);
  assert.equal(isLocalAiAgentId('shell-exec'), false);
  assert.equal(isLocalAiAgentId(''), false);
});

test('default task types map correctly', () => {
  assert.equal(defaultTaskTypeForAgent('lead-intelligence'), 'analyze_lead');
  assert.equal(defaultTaskTypeForAgent('event-operations'), 'analyze_event');
  assert.equal(defaultTaskTypeForAgent('follow-up-drafting'), 'draft_follow_up');
});
