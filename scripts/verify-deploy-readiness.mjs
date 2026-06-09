/**
 * Pre-deploy verification — typecheck, production build, blueprint sanity.
 * Usage: node scripts/verify-deploy-readiness.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(npmCmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

function checkBlueprint() {
  const path = resolve(root, 'render.yaml');
  if (!existsSync(path)) {
    console.error('✗ render.yaml missing');
    process.exit(1);
  }
  const yaml = readFileSync(path, 'utf8');
  const required = [
    'The-Hub-Api',
    'The-Hub',
    'MONGODB_URI',
    'JWT_SECRET',
    'HUB_API_SERVICE_NAME',
    'HUB_WEB_SERVICE_NAME',
    'SUPER_ADMIN_EMAILS',
  ];
  const missing = required.filter(token => !yaml.includes(token));
  if (missing.length) {
    console.error('✗ render.yaml missing:', missing.join(', '));
    process.exit(1);
  }
  console.log('✓ render.yaml contains required services and env keys');
}

function checkSecretsTemplate() {
  const path = resolve(root, 'render.secrets.template');
  if (!existsSync(path)) {
    console.warn('⚠ render.secrets.template missing (optional)');
    return;
  }
  console.log('✓ render.secrets.template present — paste into Render dashboard on first deploy');
}

console.log('The Hub CRM — deploy readiness check\n');

checkBlueprint();
checkSecretsTemplate();
run('Typecheck', ['run', 'typecheck']);
run('Production build (API + shared)', ['run', 'build', '--workspace=packages/shared', '--workspace=packages/api']);
run('Production build (web via Render wrapper)', ['run', 'build:render:web']);

console.log('\n✓ All checks passed.');
console.log('\nManual steps before client demo:');
console.log('  1. Paste render.secrets.template into Render (MONGODB_URI + SEED_ADMIN_PASSWORD minimum)');
console.log('  2. Apply Blueprint from repo root (Dashboard → New → Blueprint)');
console.log('  3. Wait for API + web deploy; hit /health on API');
console.log('  4. Login at web /login with SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD');
console.log('  5. node scripts/smoke-production.mjs (optional) against live URLs');
