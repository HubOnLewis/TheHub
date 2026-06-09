/**
 * Render static-site build wrapper — resolves VITE_API_URL before Vite build.
 *
 * When VITE_API_URL is unset, derives from The-Hub-Api:
 *   expected service URL: https://The-Hub-Api.onrender.com/api
 *   lowercase-safe URL:  https://the-hub-api.onrender.com/api
 * so Blueprint deploys do not require hand-typing API URLs.
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

const env = { ...process.env };
if (apiUrl && !String(env.VITE_API_URL ?? '').trim()) {
  env.VITE_API_URL = apiUrl;
  console.log(`[render-prepare-web-build] VITE_API_URL=${apiUrl}`);
} else if (env.VITE_API_URL) {
  console.log(`[render-prepare-web-build] Using configured VITE_API_URL`);
} else {
  console.warn('[render-prepare-web-build] No VITE_API_URL — production build will use relative /api');
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(
  npmCmd,
  ['run', 'build', '--workspace=packages/web'],
  { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' },
);

process.exit(result.status ?? 1);
