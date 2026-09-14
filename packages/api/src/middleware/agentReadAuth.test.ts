'use strict';

/**
 * Unit tests for agent machine-token auth (no DB).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  agentReaderPayload,
  isAgentReadTokenConfigured,
  rejectNonGet,
  requireAgentReadToken,
  tokensEqual,
} from './agentReadAuth.js';

test('tokensEqual is true for identical secrets', () => {
  assert.equal(tokensEqual('abc123xyz', 'abc123xyz'), true);
});

test('tokensEqual is false for different secrets', () => {
  assert.equal(tokensEqual('abc123xyz', 'abc123xyZ'), false);
  assert.equal(tokensEqual('short', 'longer-secret'), false);
});

test('agent reader uses non-cross-tenant sales role', () => {
  process.env.HUB_AGENT_TENANT_ID = 'hub-on-lewis';
  const p = agentReaderPayload();
  assert.equal(p.role, 'sales');
  assert.equal(p.tenantId, 'hub-on-lewis');
});

test('requireAgentReadToken denies missing and invalid tokens', () => {
  process.env.HUB_AGENT_READ_TOKEN = 'permanent-machine-secret-value';
  let denied = false;
  requireAgentReadToken({ headers: {} } as never, {} as never, (err?: unknown) => {
    denied = Boolean(err);
  });
  assert.equal(denied, true);

  denied = false;
  requireAgentReadToken(
    { headers: { authorization: 'Bearer wrong-token-value-here!!!!' } } as never,
    {} as never,
    (err?: unknown) => {
      denied = Boolean(err);
    },
  );
  assert.equal(denied, true);

  let ok = false;
  const req: { headers: { authorization: string }; user?: unknown } = {
    headers: { authorization: 'Bearer permanent-machine-secret-value' },
  };
  requireAgentReadToken(req as never, {} as never, (err?: unknown) => {
    ok = !err;
  });
  assert.equal(ok, true);
  assert.equal((req.user as { id: string }).id, 'agent-reader');
});

test('rejectNonGet blocks POST/PATCH/DELETE', () => {
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
    let blocked = false;
    rejectNonGet({ method } as never, {} as never, (err?: unknown) => {
      blocked = Boolean(err);
    });
    assert.equal(blocked, true, method);
  }
  let allowed = false;
  rejectNonGet({ method: 'GET' } as never, {} as never, (err?: unknown) => {
    allowed = !err;
  });
  assert.equal(allowed, true);
});

test('isAgentReadTokenConfigured reflects env', () => {
  const prev = process.env.HUB_AGENT_READ_TOKEN;
  delete process.env.HUB_AGENT_READ_TOKEN;
  assert.equal(isAgentReadTokenConfigured(), false);
  process.env.HUB_AGENT_READ_TOKEN = 'x';
  assert.equal(isAgentReadTokenConfigured(), true);
  if (prev === undefined) delete process.env.HUB_AGENT_READ_TOKEN;
  else process.env.HUB_AGENT_READ_TOKEN = prev;
});
