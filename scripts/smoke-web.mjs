/**
 * Local web smoke — dev server with VITE_SCREENSHOT_MODE=true.
 * Usage:
 *   $env:VITE_SCREENSHOT_MODE='true'; npm run dev:web
 *   node scripts/smoke-web.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5173';
const ROUTES = [
  '/login',
  '/privacy',
  '/terms',
  '/dashboard',
  '/leads',
  '/prospects',
  '/opportunities',
  '/marketing',
  '/referrals',
  '/monthly-scorecard',
  '/settings/team-access',
];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on('pageerror', err => errors.push({ route: 'global', message: err.message }));

let failed = 0;
for (const route of ROUTES) {
  const url = `${BASE}${route}`;
  const routeErrors = [];
  const onErr = err => routeErrors.push(err.message);
  page.on('pageerror', onErr);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(1500);
    const title = await page.title();
    const hasMain = (await page.locator('main, [role="main"]').count()) > 0;
    if (!title || title.includes('Error')) {
      failed++;
      console.error(`FAIL ${route}: bad title "${title}"`);
    } else if (!hasMain && route !== '/login') {
      failed++;
      console.error(`FAIL ${route}: no main landmark`);
    } else if (routeErrors.length) {
      failed++;
      console.error(`FAIL ${route}:`, routeErrors.join('; '));
    } else {
      console.log(`OK   ${route} — ${title}`);
    }
  } catch (e) {
    failed++;
    console.error(`FAIL ${route}:`, e.message);
  }
  page.off('pageerror', onErr);
}

await browser.close();
if (failed > 0) {
  console.error(`\n${failed} route(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${ROUTES.length} routes passed (base ${BASE})`);
