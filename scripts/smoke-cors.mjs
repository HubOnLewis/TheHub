#!/usr/bin/env node
/**
 * CORS preflight smoke test for production login.
 *
 * Usage:
 *   npm run smoke:cors
 *   API_BASE_URL=https://api.hubonlewis.com/api node scripts/smoke-cors.mjs
 *   API_BASE_URL=http://localhost:3001/api node scripts/smoke-cors.mjs
 */

import { HUB_API_PUBLIC_VITE_URL } from './lib/hub-api-public-url.mjs';

const API_BASES = process.env.API_BASE_URL
  ? [process.env.API_BASE_URL.replace(/\/$/, '')]
  : [HUB_API_PUBLIC_VITE_URL];

const ORIGINS = (
  process.env.CORS_TEST_ORIGINS ??
  'https://admin.hubonlewis.com,https://the-hub-qy8a.onrender.com'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

async function probe(apiBase, origin) {
  const loginUrl = `${apiBase}/auth/login`;
  const res = await fetch(loginUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

  const acao = res.headers.get('access-control-allow-origin');
  const acam = res.headers.get('access-control-allow-methods');
  const acah = res.headers.get('access-control-allow-headers');
  const ok = res.status >= 200 && res.status < 300 && acao === origin;

  console.log(`\nAPI:    ${apiBase}`);
  console.log(`Origin: ${origin}`);
  console.log(`  URL:    OPTIONS ${loginUrl}`);
  console.log(`  Status: ${res.status}`);
  console.log(`  ACAO:   ${acao ?? '(missing)'}`);
  console.log(`  ACAM:   ${acam ?? '(missing)'}`);
  console.log(`  ACAH:   ${acah ?? '(missing)'}`);
  console.log(`  Result: ${ok ? 'PASS' : 'FAIL'}`);

  return ok;
}

console.log('[smoke:cors] CORS preflight check');
console.log(`[smoke:cors] Testing ${API_BASES.length} API base(s)`);

let allOk = true;
for (const apiBase of API_BASES) {
  for (const origin of ORIGINS) {
    try {
      const ok = await probe(apiBase, origin);
      if (!ok) allOk = false;
    } catch (err) {
      console.error(`\nAPI:    ${apiBase}`);
      console.error(`Origin: ${origin}`);
      console.error(`  Result: FAIL — ${err instanceof Error ? err.message : err}`);
      allOk = false;
    }
  }
}

if (!allOk) {
  console.error('\n[smoke:cors] ✗ One or more checks failed');
  process.exit(1);
}

console.log('\n[smoke:cors] ✓ All checks passed');
