#!/usr/bin/env node
/**
 * CORS preflight smoke test for production login.
 *
 * Usage:
 *   npm run smoke:cors
 *   API_BASE_URL=https://the-hub-api.onrender.com/api node scripts/smoke-cors.mjs
 *   API_BASE_URL=http://localhost:3001/api node scripts/smoke-cors.mjs
 */

const API_BASE = (process.env.API_BASE_URL ?? 'https://the-hub-api.onrender.com/api').replace(
  /\/$/,
  '',
);

const ORIGINS = (
  process.env.CORS_TEST_ORIGINS ??
  'https://admin.hubonlewis.com,https://the-hub-qy8a.onrender.com'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const LOGIN_URL = `${API_BASE}/auth/login`;

async function probe(origin) {
  const res = await fetch(LOGIN_URL, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

  const acao = res.headers.get('access-control-allow-origin');
  const acam = res.headers.get('access-control-allow-methods');
  const ok = res.status >= 200 && res.status < 300 && acao === origin;

  console.log(`\nOrigin: ${origin}`);
  console.log(`  URL:    OPTIONS ${LOGIN_URL}`);
  console.log(`  Status: ${res.status}`);
  console.log(`  ACAO:   ${acao ?? '(missing)'}`);
  console.log(`  ACAM:   ${acam ?? '(missing)'}`);
  console.log(`  Result: ${ok ? 'PASS' : 'FAIL'}`);

  return ok;
}

console.log('[smoke:cors] CORS preflight check');
console.log(`[smoke:cors] API_BASE_URL=${API_BASE}`);

let allOk = true;
for (const origin of ORIGINS) {
  try {
    const ok = await probe(origin);
    if (!ok) allOk = false;
  } catch (err) {
    console.error(`\nOrigin: ${origin}`);
    console.error(`  Result: FAIL — ${err instanceof Error ? err.message : err}`);
    allOk = false;
  }
}

if (!allOk) {
  console.error('\n[smoke:cors] ✗ One or more origins failed');
  process.exit(1);
}

console.log('\n[smoke:cors] ✓ All origins passed');
