/**
 * Render static-site build wrapper — resolves VITE_API_URL before Vite build.
 *
 * Production default (browser-facing):
 *   https://api.hubonlewis.com/api
 *
 * Fails the build if production VITE_API_URL is missing or points at localhost.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveProductionViteApiUrl } from './lib/hub-api-public-url.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const apiUrl = resolveProductionViteApiUrl(process.env.VITE_API_URL);

const env = {
  ...process.env,
  NODE_ENV: 'production',
  VERIFY_WEB_ENV_STRICT: '1',
  VITE_API_URL: apiUrl,
};

console.log(`[render-prepare-web-build] VITE_API_URL=${apiUrl}`);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const verify = spawnSync('node', ['scripts/verify-web-env.mjs', '--strict'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}

const result = spawnSync(
  npmCmd,
  ['run', 'build', '--workspace=packages/web'],
  { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' },
);

process.exit(result.status ?? 1);
