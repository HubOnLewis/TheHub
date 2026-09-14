/**
 * Production smoke — public routes + API health (no auth required for listed paths).
 *
 * Usage:
 *   HUB_WEB_URLS=https://the-hub-qy8a.onrender.com,https://admin.hubonlewis.com \
 *   HUB_API_URL=https://api.hubonlewis.com \
 *   node scripts/smoke-production.mjs
 */
import { chromium } from 'playwright';

const WEB_TARGETS = (process.env.HUB_WEB_URLS ?? process.env.HUB_WEB_URL ?? 'https://the-hub-qy8a.onrender.com,https://admin.hubonlewis.com')
  .split(',')
  .map(url => url.trim().replace(/\/$/, ''))
  .filter(Boolean);
const API = (process.env.HUB_API_URL ?? 'https://api.hubonlewis.com').replace(/\/$/, '');

const PUBLIC_ROUTES = [
  '/login',
  '/privacy',
  '/terms',
];

const AUTH_ROUTES = [
  '/dashboard',
  '/leads',
  '/prospects',
  '/opportunities',
  '/marketing',
  '/referrals',
  '/monthly-scorecard',
  '/settings/team-access',
];

async function checkHealth() {
  const url = `${API}/health`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Health ${res.status} at ${url}`);
  const body = await res.json();
  if (body.status !== 'ok') throw new Error(`Unexpected health body: ${JSON.stringify(body)}`);
  console.log(`OK   API health — ${url}`);
}

const browser = await chromium.launch();
let failed = 0;

try {
  await checkHealth();
} catch (e) {
  failed++;
  console.error('FAIL API health:', e.message);
}

for (const web of WEB_TARGETS) {
  const page = await browser.newPage();
  console.log(`\nChecking web host: ${web}`);

  for (const route of PUBLIC_ROUTES) {
    try {
      await page.goto(`${web}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const title = await page.title();
      const bodyText = await page.locator('body').innerText();
      if (
        !title ||
        title.toLowerCase().includes('error') ||
        title.toLowerCase().includes('render - application loading') ||
        bodyText.includes('Application loading')
      ) {
        failed++;
        console.error(`FAIL ${web}${route}: app did not load (title "${title}")`);
      } else {
        console.log(`OK   ${route} — ${title}`);
      }
    } catch (e) {
      failed++;
      console.error(`FAIL ${web}${route}:`, e.message);
    }
  }

  for (const route of AUTH_ROUTES) {
    try {
      await page.goto(`${web}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const url = page.url();
      const onLogin = url.includes('/login');
      if (onLogin) {
        console.log(`OK   ${route} — redirects to login (expected without session)`);
      } else {
        const title = await page.title();
        console.log(`OK   ${route} — ${title} (session may exist)`);
      }
    } catch (e) {
      failed++;
      console.error(`FAIL ${web}${route}:`, e.message);
    }
  }

  try {
    await page.goto(`${web}/r/DEMO`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    console.log(`OK   /r/DEMO — landed at ${page.url()}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${web}/r/DEMO:`, e.message);
  }

  await page.close();
}

await browser.close();

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nProduction smoke passed for ${WEB_TARGETS.length} web hosts`);
