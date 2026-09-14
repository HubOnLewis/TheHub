#!/usr/bin/env node
/** Hub-only staging wrapper. Loads .env.staging.local in a child process. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, '.env.staging.local');
if (!existsSync(envFile)) {
  console.error('[hub-staging] Missing .env.staging.local');
  process.exit(1);
}

function loadLocalEnv(file) {
  const env = { ...process.env };
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

const env = loadLocalEnv(envFile);
const command = process.argv[2] ?? 'validate';
const args = command === 'validate'
  ? ['scripts/assert-hub-staging-target.mjs']
  : command === 'import'
    ? ['scripts/import-hub-refresh.mjs', '--staging', '--apply', '--confirm-production', '--root', 'import/sept26', '--tenant', 'hub-wichita']
    : null;
if (!args) {
  console.error('[hub-staging] Usage: node scripts/run-hub-staging.mjs <validate|import>');
  process.exit(1);
}

const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: { ...env, HUB_STAGING_APPROVED: env.HUB_STAGING_IMPORT_APPROVED },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
