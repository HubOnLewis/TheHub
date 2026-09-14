import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./assert-hub-staging-target.mjs', import.meta.url));
const base = {
  ...process.env,
  MONGODB_URI: 'mongodb+srv://hub-staging.example/hub_crm_staging',
  DB_NAME: 'hub_crm_staging',
  HUB_TENANT_ID: 'hub-wichita',
};

function run(env) {
  return spawnSync(process.execPath, [script], {
    env,
    encoding: 'utf8',
  });
}

test('staging guard refuses missing explicit approval', () => {
  const result = run({ ...base, HUB_STAGING_APPROVED: '' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /HUB_STAGING_APPROVED/);
});

test('staging guard refuses protected Hub production database', () => {
  const result = run({ ...base, HUB_STAGING_APPROVED: '1', DB_NAME: 'hub_crm' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /protected database/i);
});

test('staging guard accepts an explicitly approved staging target', () => {
  const result = run({ ...base, HUB_STAGING_APPROVED: '1' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.database, 'hub_crm_staging');
  assert.equal(parsed.tenantId, 'hub-wichita');
});
