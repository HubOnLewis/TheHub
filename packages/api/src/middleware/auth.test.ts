import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { env } = await import('../config/env.js');
const { requireAuth, requireRole } = await import('./auth.js');

test('requireAuth rejects a missing bearer token', () => {
  const req = { headers: {} } as any;
  const res = {} as any;
  let nextCalledWith: unknown = null;

  requireAuth(req, res, (err?: unknown) => {
    nextCalledWith = err;
  });

  assert.ok(nextCalledWith);
  assert.equal((nextCalledWith as any).statusCode, 401);
});

test('requireAuth accepts a valid bearer token and attaches the user payload', () => {
  const token = jwt.sign(
    {
      id: 'user-123',
      name: 'Jane Doe',
      email: 'jane@hubonlewis.com',
      role: 'sales',
      entity: 'HUB',
      location: 'Wichita',
      tenantId: 'hub-wichita',
    },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const req = { headers: { authorization: `Bearer ${token}` } } as any;
  const res = {} as any;
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.email, 'jane@hubonlewis.com');
  assert.equal(req.user.role, 'sales');
});

test('requireRole denies a user without the required role', () => {
  const req = {
    user: {
      id: 'user-456',
      name: 'Service Agent',
      email: 'service@hubonlewis.com',
      role: 'service',
      entity: 'HUB',
      location: 'Wichita',
      tenantId: 'hub-wichita',
    },
  } as any;

  let nextCalledWith: unknown = null;
  const middleware = requireRole('super_admin', 'admin');
  middleware(req, {} as any, (err?: unknown) => {
    nextCalledWith = err;
  });

  assert.ok(nextCalledWith);
  assert.equal((nextCalledWith as any).statusCode, 401);
});
