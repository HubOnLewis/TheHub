/**
 * Render static-site build wrapper — resolves VITE_API_URL before Vite build.
 *
 * When VITE_API_URL is unset, derives from The-Hub-Api:
 *   https://the-hub-api.onrender.com/api
 *
 * Fails the build if production VITE_API_URL is missing or points at localhost.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveViteApiUrl } from './render-onrender-url.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const apiUrl = resolveViteApiUrl({
  viteApiUrl: process.env.VITE_API_URL,
  apiServiceName: process.env.HUB_API_SERVICE_NAME ?? 'The-Hub-Api',
  root: process.env.RENDER_ONRENDER_ROOT ?? 'onrender.com',
});

const env = {
  ...process.env,
  NODE_ENV: 'production',
  VERIFY_WEB_ENV_STRICT: '1',
};

if (apiUrl && !String(env.VITE_API_URL ?? '').trim()) {
  env.VITE_API_URL = apiUrl;
  console.log(`[render-prepare-web-build] VITE_API_URL=${apiUrl}`);
} else if (env.VITE_API_URL) {
  console.log(`[render-prepare-web-build] Using configured VITE_API_URL=${env.VITE_API_URL}`);
} else {
  console.error('[render-prepare-web-build] No VITE_API_URL and could not derive API URL');
  process.exit(1);
}

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
