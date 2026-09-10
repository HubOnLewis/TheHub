/**
 * Local portal routing smoke — serves Vite preview and asserts DOM content.
 * Does not hit production. Does not write CRM data.
 *
 * Usage: node scripts/smoke-portal-local.mjs
 * Requires: packages/web/dist already built, Playwright chromium installed.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'packages/web/dist');
const indexHtml = join(dist, 'index.html');

if (!existsSync(indexHtml)) {
  console.error('Missing packages/web/dist — run npm run build --workspace=packages/web first');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function serveDist() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let filePath = join(dist, decodeURIComponent(url.pathname));
      if (!normalize(filePath).startsWith(normalize(dist))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!existsSync(filePath) || filePath.endsWith('/') || !extname(filePath)) {
        filePath = indexHtml; // SPA fallback
      }
      try {
        const body = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function assertRoute(page, base, path, expectText) {
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(800);
  const text = await page.locator('body').innerText();
  const html = await page.locator('#root').innerHTML();
  const ok = expectText.every(t => text.includes(t) || html.includes(t));
  if (!ok || html.trim().length < 40) {
    console.error(`FAIL ${path}`);
    console.error(`  expected: ${expectText.join(' | ')}`);
    console.error(`  body: ${text.slice(0, 240).replace(/\n/g, ' / ')}`);
    console.error(`  rootLen: ${html.length}`);
    if (errors.length) console.error(`  pageerrors: ${errors.join('; ')}`);
    return false;
  }
  if (errors.length) {
    console.error(`FAIL ${path}: console pageerror — ${errors.join('; ')}`);
    return false;
  }
  console.log(`OK   ${path} — found ${expectText[0]}`);
  return true;
}

const { server, base } = await serveDist();
const browser = await chromium.launch();
const page = await browser.newPage();
let failed = 0;

try {
  if (!(await assertRoute(page, base, '/portal/login', ['Your event portal']))) failed++;
  if (!(await assertRoute(page, base, '/portal/login?access=TEST', ['Your event portal']))) failed++;
  if (!(await assertRoute(page, base, '/portal', ['Your event portal']))) failed++;
  if (!(await assertRoute(page, base, '/login', ['Sign in']))) failed++;
  if (!(await assertRoute(page, base, '/book', ['Book your event']))) failed++;
} finally {
  await browser.close();
  server.close();
}

if (failed) {
  console.error(`\nPortal local smoke failed (${failed})`);
  process.exit(1);
}
console.log('\nPortal local smoke passed.');
