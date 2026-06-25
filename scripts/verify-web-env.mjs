#!/usr/bin/env node
/**
 * Production web build guard — VITE_API_URL must be a non-localhost absolute URL.
 *
 * Strict mode (fails build):
 *   node scripts/verify-web-env.mjs --strict
 *   RENDER=true / CI=true / VERIFY_WEB_ENV_STRICT=1
 *
 * Local `npm run build` in packages/web skips strict checks unless --strict is passed.
 */
import {
  HUB_API_PUBLIC_VITE_URL,
  resolveProductionViteApiUrl,
} from './lib/hub-api-public-url.mjs';

const LOCALHOST = /localhost|127\.0\.0\.1/i;
const INVALID_ONRENDER_API = /the-hub-api\.onrender\.com/i;

function isInvalidProductionUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return true;
  if (LOCALHOST.test(s)) return true;
  if (INVALID_ONRENDER_API.test(s)) return true;
  return false;
}

function shouldEnforce(argv) {
  if (argv.includes('--strict')) return true;
  if (process.env.RENDER === 'true') return true;
  if (process.env.CI === 'true') return true;
  if (process.env.VERIFY_WEB_ENV_STRICT === '1') return true;
  return false;
}

const argv = process.argv.slice(2);
const enforce = shouldEnforce(argv);

if (!enforce) {
  console.log('[verify-web-env] Skipping strict production check (local build)');
  process.exit(0);
}

const viteApiUrl = resolveProductionViteApiUrl(process.env.VITE_API_URL);

if (isInvalidProductionUrl(viteApiUrl)) {
  console.error(`
✗ Invalid production VITE_API_URL.

Set on the Render static site (The-Hub):
  VITE_API_URL=${HUB_API_PUBLIC_VITE_URL}

Current value: ${JSON.stringify(process.env.VITE_API_URL ?? '')}
`);
  process.exit(1);
}

console.log(`[verify-web-env] ✓ VITE_API_URL=${viteApiUrl}`);
