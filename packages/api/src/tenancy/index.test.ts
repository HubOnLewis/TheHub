import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { env } = await import('../config/env.js');
const { resolveTenant } = await import('./index.js');

test('super admin emails are matched case-insensitively and unlock cross-tenant scope', () => {
  const original = env.SUPER_ADMIN_EMAILS;
  (env as typeof env & { SUPER_ADMIN_EMAILS: string[] }).SUPER_ADMIN_EMAILS = ['admin@hubonlewis.com'];

  const request = {
    headers: {},
    user: {
      id: 'u-1',
      name: 'Jason Admin',
      email: 'ADMIN@HUBONLEWIS.COM',
      role: 'sales',
      entity: 'HUB',
      location: 'Wichita',
      tenantId: 'hub-wichita',
    },
  } as any;

  resolveTenant(request, {} as any, () => undefined);

  assert.equal(request.tenant.tenantId, null);
  assert.equal(request.tenant.isSuperAdmin, true);

  (env as typeof env & { SUPER_ADMIN_EMAILS: string[] }).SUPER_ADMIN_EMAILS = original;
});

test('non-super-admin users stay scoped to their tenant', () => {
  const original = env.SUPER_ADMIN_EMAILS;
  (env as typeof env & { SUPER_ADMIN_EMAILS: string[] }).SUPER_ADMIN_EMAILS = ['admin@hubonlewis.com'];

  const request = {
    headers: {},
    user: {
      id: 'u-2',
      name: 'Salesperson',
      email: 'sales@hubonlewis.com',
      role: 'sales',
      entity: 'HUB',
      location: 'Wichita',
      tenantId: 'hub-wichita',
    },
  } as any;

  resolveTenant(request, {} as any, () => undefined);

  assert.equal(request.tenant.tenantId, 'hub-wichita');
  assert.equal(request.tenant.isSuperAdmin, false);

  (env as typeof env & { SUPER_ADMIN_EMAILS: string[] }).SUPER_ADMIN_EMAILS = original;
});
