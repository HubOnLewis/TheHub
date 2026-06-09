#!/usr/bin/env node
/**
 * Perfect Venue — local, authorized data extraction for HuB on Lewis migration seeding.
 *
 * SAFETY:
 * - No credentials in code or env (except optional CDP URL to attach to YOUR browser).
 * - No passwords stored. Uses persistent Chrome profile OR manual login in headed window.
 * - Does not bypass authentication. You must log in yourself.
 * - All output stays under data/perfect-venue-export/ (gitignored).
 *
 * Usage:
 *   npm run extract:perfect-venue
 *
 * Optional:
 *   PV_CDP_URL=http://127.0.0.1:9222  Attach to Chrome started with --remote-debugging-port=9222
 *   PV_SKIP_WAIT=1                   Skip Enter prompt if session already authenticated
 *   PV_MAX_EVENT_PAGES=15            Cap individual event detail pages (default 15)
 */

import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = join(ROOT, 'data', 'perfect-venue-export');
const PROFILE_DIR = join(ROOT, '.playwright-pv-profile');
const BASE = 'https://app.perfectvenue.com';

const IGNORE_URL_RE =
  /stripe|canny|rrweb|segment|analytics|sentry|hotjar|intercom|cloudfront\.net\/.*\.js|googletagmanager|facebook\.net|doubleclick|amplitude|fullstory|datadog|launchdarkly|telemetry|tracking|beacon/i;

const CAPTURE_CONTENT_TYPES = /json|graphql/i;

/** Routes to visit after login (relative to BASE). */
const ROUTES = [
  { key: 'home', paths: ['/', '/home', '/dashboard'] },
  { key: 'calendar', paths: ['/calendar'] },
  { key: 'tasks', paths: ['/tasks'] },
  { key: 'inbox', paths: ['/inbox', '/messages'] },
  { key: 'events', paths: ['/events', '/bookings'] },
  { key: 'settings', paths: ['/settings', '/venue-settings'] },
];

const exportState = {
  meta: {
    extractedAt: new Date().toISOString(),
    baseUrl: BASE,
    profileDir: PROFILE_DIR,
    cdp: process.env.PV_CDP_URL ?? null,
  },
  events: [],
  tasks: [],
  calendar: [],
  settings: {},
  pages: [],
  network: [],
  eventLinks: [],
};

function ensureDirs() {
  for (const sub of [
    OUTPUT,
    join(OUTPUT, 'raw-page-text'),
    join(OUTPUT, 'network-captures'),
  ]) {
    mkdirSync(sub, { recursive: true });
  }
}

function slug(s) {
  return String(s)
    .slice(0, 80)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'page';
}

function hashBody(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 12);
}

function shouldIgnoreNetworkUrl(url) {
  return IGNORE_URL_RE.test(url);
}

function looksLikePvData(json) {
  const s = JSON.stringify(json).toLowerCase();
  return /event|booking|task|calendar|guest|venue|client|customer|balance|deposit|proposal|space|room|inbox|message/i.test(
    s,
  );
}

async function waitForEnter(prompt) {
  if (process.env.PV_SKIP_WAIT === '1') return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(res => {
    rl.question(prompt, () => {
      rl.close();
      res();
    });
  });
}

async function scrollPage(page, passes = 8) {
  for (let i = 0; i < passes; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, Math.max(400, window.innerHeight * 0.7));
      const grids = document.querySelectorAll(
        '[class*="scroll"], [data-testid*="scroll"], .ReactVirtualized__Grid, [role="grid"]',
      );
      grids.forEach(el => {
        if (el.scrollHeight > el.clientHeight) el.scrollTop += el.clientHeight * 0.8;
      });
    });
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

/** DOM + visible text extraction (structure-agnostic). */
async function extractVisible(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText ?? '').replace(/\s+\n/g, '\n').trim();
    const title = document.title;
    const url = location.href;

    const tableRows = [];
    document.querySelectorAll('table tr').forEach(tr => {
      const cells = [...tr.querySelectorAll('th, td')]
        .map(c => c.innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (cells.length) tableRows.push(cells);
    });

    const roleRows = [];
    document.querySelectorAll('[role="row"]').forEach(row => {
      const cells = [...row.querySelectorAll('[role="cell"], [role="gridcell"], td, th')]
        .map(c => c.innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (!cells.length) {
        const t = row.innerText.replace(/\s+/g, ' ').trim();
        if (t) roleRows.push([t]);
      } else roleRows.push(cells);
    });

    const links = [...document.querySelectorAll('a[href]')]
      .map(a => ({
        href: a.href,
        text: a.innerText.replace(/\s+/g, ' ').trim().slice(0, 200),
      }))
      .filter(l => l.text || /event|booking|calendar|task/i.test(l.href));

    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => ({
      tag: h.tagName,
      text: h.innerText.trim(),
    }));

    const labels = [];
    document.querySelectorAll('label, [class*="label"], dt').forEach(el => {
      const t = el.innerText?.trim();
      if (t && t.length < 120) labels.push(t);
    });

    return { title, url, text, tableRows, roleRows, links, headings, labels };
  });
}

function parseLooseRecords(pageData, pageKey) {
  const records = [];
  const rows = [...(pageData.tableRows ?? []), ...(pageData.roleRows ?? [])];
  for (const cells of rows) {
    if (cells.length < 2) continue;
    records.push({
      source: pageKey,
      rawCells: cells,
      hint: inferRecordType(cells, pageKey),
    });
  }
  return records;
}

function inferRecordType(cells, pageKey) {
  const line = cells.join(' ').toLowerCase();
  if (pageKey === 'tasks' || /task|todo|due|assignee/i.test(line)) return 'task';
  if (pageKey === 'calendar' || /\d{1,2}\/\d{1,2}|\dam|\dpm|calendar/i.test(line)) return 'calendar';
  if (
    pageKey === 'events' ||
    pageKey === 'home' ||
    /event|booking|guest|deposit|balance|proposal|confirmed|inquiry/i.test(line)
  ) {
    return 'event';
  }
  if (pageKey === 'settings' || /venue|tax|fee|space|room|template/i.test(line)) return 'settings';
  if (pageKey === 'inbox' || /inbox|message|email|thread/i.test(line)) return 'inbox';
  return 'unknown';
}

function mergeIntoBuckets(pageKey, pageData, records) {
  const pageRecord = {
    page: pageKey,
    url: pageData.url,
    title: pageData.title,
    capturedAt: new Date().toISOString(),
    rowCount: records.length,
    linkCount: pageData.links?.length ?? 0,
  };
  exportState.pages.push(pageRecord);

  for (const r of records) {
    if (r.hint === 'task') exportState.tasks.push(r);
    else if (r.hint === 'calendar') exportState.calendar.push(r);
    else if (r.hint === 'event') exportState.events.push(r);
    else if (r.hint === 'settings') {
      exportState.settings[pageKey] = exportState.settings[pageKey] ?? [];
      exportState.settings[pageKey].push(r);
    }
  }

  if (pageKey === 'settings' || pageKey === 'inbox') {
    exportState.settings[`${pageKey}_text`] = pageData.text?.slice(0, 50_000) ?? '';
    exportState.settings[`${pageKey}_labels`] = pageData.labels ?? [];
  }
}

function collectEventLinks(pageData) {
  const seen = new Set(exportState.eventLinks.map(l => l.href));
  for (const l of pageData.links ?? []) {
    if (!l.href || seen.has(l.href)) continue;
    if (/event|booking|reservation|\/e\//i.test(l.href) && l.href.includes('perfectvenue.com')) {
      seen.add(l.href);
      exportState.eventLinks.push({ href: l.href, text: l.text, discoveredOn: pageData.url });
    }
  }
}

async function setupNetworkCapture(page) {
  page.on('response', async response => {
    try {
      const url = response.url();
      if (shouldIgnoreNetworkUrl(url)) return;
      const headers = response.headers();
      const ct = headers['content-type'] ?? '';
      if (!CAPTURE_CONTENT_TYPES.test(ct) && !/graphql|api\./i.test(url)) return;

      const status = response.status();
      if (status < 200 || status >= 400) return;

      let body;
      try {
        body = await response.text();
      } catch {
        return;
      }
      if (!body || body.length > 2_000_000) return;

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return;
      }

      if (!looksLikePvData(parsed)) return;

      const id = hashBody(url + body.slice(0, 500));
      const filename = `${id}.json`;
      const filepath = join(OUTPUT, 'network-captures', filename);
      writeFileSync(
        filepath,
        JSON.stringify({ url, status, contentType: ct, capturedAt: new Date().toISOString(), body: parsed }, null, 2),
      );

      exportState.network.push({ url, file: `network-captures/${filename}`, status });
      mergeGraphqlIntoBuckets(parsed);
    } catch {
      /* ignore capture errors */
    }
  });
}

function mergeGraphqlIntoBuckets(json) {
  const visit = (node, path = '') => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    const keys = Object.keys(node);
    const blob = keys.join(' ').toLowerCase();
    if (Array.isArray(node.events)) node.events.forEach(e => exportState.events.push({ source: 'graphql', path, ...flatten(e) }));
    if (Array.isArray(node.bookings)) node.bookings.forEach(e => exportState.events.push({ source: 'graphql', path, ...flatten(e) }));
    if (Array.isArray(node.tasks)) node.tasks.forEach(t => exportState.tasks.push({ source: 'graphql', path, ...flatten(t) }));
    if (Array.isArray(node.calendarEvents)) node.calendarEvents.forEach(c => exportState.calendar.push({ source: 'graphql', path, ...flatten(c) }));

    for (const k of keys) {
      if (/events|bookings|tasks|calendar/i.test(k) && Array.isArray(node[k])) {
        const bucket = /task/i.test(k) ? exportState.tasks : /calendar/i.test(k) ? exportState.calendar : exportState.events;
        node[k].forEach(item => bucket.push({ source: 'graphql', field: k, ...flatten(item) }));
      }
      if (typeof node[k] === 'object') visit(node[k], path ? `${path}.${k}` : k);
    }
  };

  if (Array.isArray(json)) json.forEach((item, i) => visit(item, `[${i}]`));
  else visit(json);
}

function flatten(obj) {
  if (!obj || typeof obj !== 'object') return { value: obj };
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      if ('name' in v || 'title' in v || 'label' in v) out[k] = v.name ?? v.title ?? v.label;
      else if ('id' in v) out[k] = v.id;
      else out[k] = JSON.stringify(v).slice(0, 500);
    } else out[k] = v;
  }
  return out;
}

async function visitRoute(page, routeKey, path) {
  const url = `${BASE}${path}`;
  console.log(`  → ${url}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2000);
    await scrollPage(page, 10);
    const data = await extractVisible(page);
    const records = parseLooseRecords(data, routeKey);
    mergeIntoBuckets(routeKey, data, records);
    collectEventLinks(data);

    const fname = `${routeKey}-${slug(path || 'root')}.txt`;
    writeFileSync(join(OUTPUT, 'raw-page-text', fname), data.text ?? '', 'utf8');
    writeFileSync(
      join(OUTPUT, 'raw-page-text', `${fname}.meta.json`),
      JSON.stringify({ url: data.url, title: data.title, tableRows: data.tableRows?.length, links: data.links?.length }, null, 2),
    );
    return true;
  } catch (err) {
    console.warn(`    ⚠ Could not load ${url}: ${err.message}`);
    return false;
  }
}

async function visitEventDetails(page, maxPages) {
  const links = exportState.eventLinks.slice(0, maxPages);
  console.log(`\nEvent detail pages (up to ${maxPages}, found ${exportState.eventLinks.length} links)…`);
  for (let i = 0; i < links.length; i++) {
    const { href, text } = links[i];
    console.log(`  → [${i + 1}/${links.length}] ${text || href}`);
    try {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await scrollPage(page, 4);
      const data = await extractVisible(page);
      const records = parseLooseRecords(data, 'event-detail');
      mergeIntoBuckets('event-detail', data, records);
      exportState.events.push({
        source: 'event-detail-page',
        url: href,
        linkText: text,
        textExcerpt: data.text?.slice(0, 8000),
        tableRows: data.tableRows,
      });
      const fname = `event-detail-${i + 1}-${slug(text || href)}.txt`;
      writeFileSync(join(OUTPUT, 'raw-page-text', fname), data.text ?? '', 'utf8');
    } catch (err) {
      console.warn(`    ⚠ ${err.message}`);
    }
  }
}

function dedupeByJson(arr) {
  const seen = new Set();
  return arr.filter(item => {
    const k = JSON.stringify(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function writeOutputs() {
  exportState.events = dedupeByJson(exportState.events);
  exportState.tasks = dedupeByJson(exportState.tasks);
  exportState.calendar = dedupeByJson(exportState.calendar);

  writeFileSync(join(OUTPUT, 'events.json'), JSON.stringify(exportState.events, null, 2));
  writeFileSync(join(OUTPUT, 'tasks.json'), JSON.stringify(exportState.tasks, null, 2));
  writeFileSync(join(OUTPUT, 'calendar.json'), JSON.stringify(exportState.calendar, null, 2));
  writeFileSync(
    join(OUTPUT, 'settings.json'),
    JSON.stringify(
      {
        ...exportState.settings,
        _meta: { pagesVisited: exportState.pages, networkFiles: exportState.network.length },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(OUTPUT, 'manifest.json'), JSON.stringify(exportState.meta, null, 2));
  writeFileSync(join(OUTPUT, 'pages-index.json'), JSON.stringify(exportState.pages, null, 2));
  writeFileSync(join(OUTPUT, 'event-links.json'), JSON.stringify(exportState.eventLinks, null, 2));

  const readme = buildReadme();
  writeFileSync(join(OUTPUT, 'README.md'), readme, 'utf8');
}

function buildReadme() {
  return `# Perfect Venue export (local)

Generated: **${exportState.meta.extractedAt}**

This folder contains data extracted from [Perfect Venue](https://app.perfectvenue.com) while you were **logged in with your own account**. Nothing was sent off this machine.

## What was captured

| File | Description |
|------|-------------|
| \`events.json\` | Table rows, GraphQL-derived objects, and event detail page excerpts (${exportState.events.length} records) |
| \`tasks.json\` | Task-like rows and API payloads (${exportState.tasks.length} records) |
| \`calendar.json\` | Calendar-like rows and API payloads (${exportState.calendar.length} records) |
| \`settings.json\` | Settings/inbox visible text, labels, and setting rows |
| \`raw-page-text/\` | Full visible page text per route |
| \`network-captures/\` | Filtered JSON/GraphQL responses (${exportState.network.length} files) |
| \`event-links.json\` | Event/booking URLs discovered for detail visits |
| \`pages-index.json\` | Routes visited and capture metadata |

## How it was captured

- Playwright **headed** browser (persistent profile: \`.playwright-pv-profile/\`)
- DOM visible text + tables + virtualized grid scrolling
- Network: JSON/GraphQL only; telemetry/Stripe/Canny/rrweb/analytics ignored

## Limitations

- Structure follows what Perfect Venue renders in the UI; field names may not match The Hub CRM schema.
- Virtualized lists may not include every historical row (scroll passes are finite).
- GraphQL capture depends on which API calls fire per page.
- **Do not commit this folder** — it may contain PII and commercial data.

## Next steps (Hub CRM)

Map \`events.json\` / GraphQL captures into \`packages/web/src/data/demoVenue.ts\` or Mongo import scripts manually. Review with Jason/Hannah before production import.
`;
}

async function getBrowserContext() {
  const cdp = process.env.PV_CDP_URL?.trim();
  if (cdp) {
    console.log(`Attaching to Chrome via CDP: ${cdp}`);
    const browser = await chromium.connectOverCDP(cdp);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return { browser, context, page, persistent: false };
  }

  mkdirSync(PROFILE_DIR, { recursive: true });
  console.log(`Using persistent profile: ${PROFILE_DIR}`);
  const launchOpts = {
    headless: false,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: false,
  };
  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, { ...launchOpts, channel: 'chrome' });
    console.log('Launched installed Google Chrome (persistent profile).');
  } catch {
    context = await chromium.launchPersistentContext(PROFILE_DIR, launchOpts);
    console.log('Launched Playwright Chromium (Chrome not found — profile still persists).');
  }
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser: null, context, page, persistent: true };
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' Perfect Venue — local extraction (authorized session only)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('No credentials are stored. Log in manually when the browser opens.\n');

  ensureDirs();

  const maxEventPages = Number(process.env.PV_MAX_EVENT_PAGES ?? 15) || 15;
  const { browser, context, page, persistent } = await getBrowserContext();

  await setupNetworkCapture(page);

  console.log(`Opening ${BASE} …\n`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  const alreadyIn = await page
    .waitForSelector('nav, [role="navigation"], header, [class*="sidebar"]', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (!alreadyIn) {
    console.log('If you see a login screen, sign in to Perfect Venue (HuB on Lewis).');
  }

  await waitForEnter(
    '\nWhen you can see the HuB on Lewis app (home/calendar), press ENTER to start extraction… ',
  );

  console.log('\nNavigating Hub routes…');
  const visited = new Set();
  for (const { key, paths } of ROUTES) {
    for (const p of paths) {
      const norm = `${key}:${p}`;
      if (visited.has(norm)) continue;
      visited.add(norm);
      const ok = await visitRoute(page, key, p);
      if (ok && p === paths[0]) break;
    }
  }

  await visitEventDetails(page, maxEventPages);

  writeOutputs();

  console.log('\n✓ Export complete.');
  console.log(`  Output: ${OUTPUT}`);
  console.log(`  Events: ${exportState.events.length} | Tasks: ${exportState.tasks.length} | Calendar: ${exportState.calendar.length}`);
  console.log(`  Network: ${exportState.network.length} JSON files\n`);

  if (persistent) {
    await context.close();
  } else if (browser) {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n[extract-perfect-venue] Failed:', err.message);
  process.exit(1);
});
