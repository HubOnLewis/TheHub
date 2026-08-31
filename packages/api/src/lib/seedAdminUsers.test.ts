// @ts-nocheck — seed planner lives in untyped scripts/*.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

declare module '../../../../scripts/lib/seed-admin-users.mjs' {
  export const JASON_DEFAULTS: { name: string; email: string; role: string };
  export const HANNAH_DEFAULTS: { name: string; email: string; role: string };
  export function buildSeedUsers(
    pick: (key: string, fallback: string) => string,
    opts?: { localDefaultPassword?: string },
  ): {
    jason: { email: string; role: string };
    hannah: { email: string; role: string };
    users: Array<{ email: string; role: string; password: string }>;
  };
  export function planBootstrap(
    existingEmails: string[],
    specs: Array<{ email: string; role: string; password?: string }>,
    opts?: { requirePassword?: boolean },
  ): {
    emptyDb: boolean;
    toCreate: Array<{ email: string; role: string }>;
    skipped: Array<{ email: string; reason: string }>;
  };
  export function planSeedUpsert(
    existingEmails: string[],
    specs: Array<{ email: string; role: string }>,
  ): Array<{ action: 'create' | 'update'; spec: { email: string; role: string } }>;
}

const {
  JASON_DEFAULTS,
  HANNAH_DEFAULTS,
  buildSeedUsers,
  planBootstrap,
  planSeedUpsert,
} = await import('../../../../scripts/lib/seed-admin-users.mjs');

function pickFrom(map: Record<string, string>) {
  return (key: string, fallback: string) => {
    const v = map[key];
    return v !== undefined && v !== '' ? v : fallback;
  };
}

test('bootstrap empty collection creates Jason super_admin and Hannah admin', () => {
  const { users } = buildSeedUsers(
    pickFrom({ SEED_ADMIN_PASSWORD: 'seed-pass-ok', SEED_HANNAH_PASSWORD: 'hannah-pass-ok' }),
  );
  const plan = planBootstrap([], users, { requirePassword: true });
  assert.equal(plan.emptyDb, true);
  assert.equal(plan.toCreate.length, 2);
  assert.equal(plan.toCreate[0]?.email, JASON_DEFAULTS.email);
  assert.equal(plan.toCreate[0]?.role, 'super_admin');
  assert.equal(plan.toCreate[1]?.email, HANNAH_DEFAULTS.email);
  assert.equal(plan.toCreate[1]?.role, 'admin');
  assert.equal(plan.toCreate[1]?.role === 'super_admin', false);
});

test('bootstrap with Jason present creates missing Hannah admin only', () => {
  const { users, jason } = buildSeedUsers(pickFrom({ SEED_ADMIN_PASSWORD: 'seed-pass-ok' }));
  const plan = planBootstrap([jason.email], users, { requirePassword: true });
  assert.equal(plan.emptyDb, false);
  assert.equal(plan.toCreate.length, 1);
  assert.equal(plan.toCreate[0]?.email, HANNAH_DEFAULTS.email);
  assert.equal(plan.toCreate[0]?.role, 'admin');
  assert.equal(plan.skipped.some(s => s.email === jason.email && s.reason === 'exists'), true);
});

test('seed-admin upserts Hannah when missing and refreshes Jason', () => {
  const { users } = buildSeedUsers(pickFrom({}), { localDefaultPassword: 'local-dev-pass' });
  const plan = planSeedUpsert([JASON_DEFAULTS.email], users);
  assert.equal(plan[0]?.action, 'update');
  assert.equal(plan[0]?.spec.role, 'super_admin');
  assert.equal(plan[1]?.action, 'create');
  assert.equal(plan[1]?.spec.email, HANNAH_DEFAULTS.email);
  assert.equal(plan[1]?.spec.role, 'admin');
});

test('Hannah stays admin; Jason stays super_admin even with SEED_HANNAH overrides', () => {
  const { jason, hannah } = buildSeedUsers(
    pickFrom({
      SEED_HANNAH_NAME: 'Hannah Bayless',
      SEED_HANNAH_EMAIL: 'hannah@hubonlewis.com',
    }),
  );
  assert.equal(jason.role, 'super_admin');
  assert.equal(jason.email, JASON_DEFAULTS.email);
  assert.equal(hannah.role, 'admin');
  assert.equal(hannah.email, HANNAH_DEFAULTS.email);
});

test('bootstrap skips create when seed password is missing', () => {
  const { users } = buildSeedUsers(pickFrom({}));
  const plan = planBootstrap([], users, { requirePassword: true });
  assert.equal(plan.toCreate.length, 0);
  assert.equal(plan.skipped.every(s => s.reason === 'password-missing'), true);
});