// scripts/import-qrf-data.mjs
// Demo generator: sample catalog → opportunities + booking records (legacy truck templates).
//
// These files are BUILD ESTIMATOR TEMPLATES (no customer data filled in).
// The Look Up Data sheets contain the real product catalog with pricing.
// This script uses that catalog + existing VOZE companies to create a
// realistic active pipeline for demo purposes.
//
// Usage:
//   node scripts/import-qrf-data.mjs --tenant wki-wichita
//   node scripts/import-qrf-data.mjs --tenant wki-wichita --dry-run

import XLSX from 'xlsx';
import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const TENANT  = args[args.indexOf('--tenant') + 1];
const DRY_RUN = args.includes('--dry-run');
if (!TENANT) { console.error('Usage: node import-qrf-data.mjs --tenant <tenantId>'); process.exit(1); }

// ── Env ───────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const MONGODB_URI = envVars['MONGODB_URI'];
const DB_NAME     = envVars['DB_NAME'] ?? 'hub_crm';
if (!MONGODB_URI) { console.error('MONGODB_URI not found in .env'); process.exit(1); }

// ── Excel file paths ──────────────────────────────────────────────
const SERVICE_TRUCK_FILE = resolve(__dirname, '../voze data/Service Truck QRF 1Q26V4 28 Jan 2026.xlsm');
const DUMP_TRUCK_FILE    = resolve(__dirname, '../voze data/Dump truck QRF 1Q26V3 28 Jan 2025 - MASTER DDM - DE version.xlsm');

// ── Deal status map ───────────────────────────────────────────────
// Maps a rough status label to our DEAL_STATUSES enum
function mapDealStatus(raw) {
  const s = String(raw ?? '').toLowerCase().trim();
  if (/sold|closed|delivered|won/.test(s))    return 'Delivered';
  if (/build|in.?build|production/.test(s))   return 'In Build';
  if (/approved/.test(s))                      return 'Approved';
  if (/lost|declined|dead/.test(s))           return 'Lost';
  if (/pending|approval/.test(s))             return 'Pending Approval';
  if (/quoted|open|active|working/.test(s))   return 'Won';
  return 'Approved';
}

// ── Parse currency safely ─────────────────────────────────────────
function parseMoney(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ── Read Look Up Data from a workbook ─────────────────────────────
function readLookUpData(wb, sheetName = 'Look Up Data') {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

// ── Extract product rows: [description, salesPrice] ──────────────
function extractProducts(rows) {
  const products = [];
  for (const row of rows) {
    const desc  = String(row[0] ?? '').trim();
    const price = parseMoney(row[1]);
    if (!desc || desc.length < 10 || !price || price < 1000) continue;
    // Skip header-like rows
    if (/^(bed type|sales markup|options:|accessori|description)/i.test(desc)) continue;
    products.push({ description: desc, price });
  }
  return products;
}

// ── Synthetic deal configs ────────────────────────────────────────
// Realistic deals spread across statuses for a good-looking demo pipeline.
// Salesperson and dates are varied to look organic.
const SALESPEOPLE = ['David Williams', 'Mike Agnew', 'Sarah Chen', 'Tom Briggs', 'Lisa Ramos'];
const STATUSES    = [
  'Won', 'Won', 'Won',           // 3 won (closed)
  'Approved', 'Approved',        // 2 approved
  'In Build', 'In Build',        // 2 in build
  'Pending Approval',            // 1 pending
  'Draft', 'Draft',              // 2 draft / quoted
];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Generate a fake-but-plausible VIN ─────────────────────────────
function fakeVin(index) {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  const prefix = 'WKI2026';
  let suffix = '';
  let seed = index * 7919 + 12345;
  for (let i = 0; i < 10; i++) {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    suffix += chars[seed % chars.length];
  }
  return (prefix + suffix).slice(0, 17).padEnd(17, '0');
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  // 1. Parse Excel files ───────────────────────────────────────────
  console.log('[qrf-import] Reading Excel files…');
  const stWb = XLSX.readFile(SERVICE_TRUCK_FILE);
  const dtWb = XLSX.readFile(DUMP_TRUCK_FILE);

  const stProducts = extractProducts(readLookUpData(stWb));
  const dtProducts = extractProducts(readLookUpData(dtWb));

  console.log(`[qrf-import] Service truck products found: ${stProducts.length}`);
  console.log(`[qrf-import] Dump truck products found:    ${dtProducts.length}`);

  if (stProducts.length === 0 && dtProducts.length === 0) {
    console.error('[qrf-import] No products extracted — check file paths.');
    process.exit(1);
  }

  // 2. Connect to MongoDB ──────────────────────────────────────────
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const dealsCol    = db.collection('deals');
  const unitsCol    = db.collection('units');
  const companiesCol = db.collection('companies');

  // 3. Load existing companies for this tenant ─────────────────────
  const companies = await companiesCol
    .find({ tenantId: TENANT })
    .project({ _id: 1, name: 1, phone: 1 })
    .limit(200)
    .toArray();

  if (companies.length === 0) {
    console.error('[qrf-import] No companies found for tenant. Run import-voze-companies first.');
    await client.close();
    process.exit(1);
  }

  // Pick companies that have real names (not stubs)
  const realCompanies = companies.filter(c => c.name && c.name.length > 3);
  console.log(`[qrf-import] Using ${realCompanies.length} companies as customers`);

  // 4. Build deal + unit list ──────────────────────────────────────
  // Combine both product lists into a single pool
  const allProducts = [
    ...stProducts.map(p => ({ ...p, unitType: 'Service Truck', make: 'Kenworth', year: 2026 })),
    ...dtProducts.map(p => ({ ...p, unitType: 'Dump Truck',    make: 'Kenworth', year: 2025 })),
  ];

  // We'll create one deal per entry in STATUSES using varied companies + products
  const targetCount = Math.min(STATUSES.length, realCompanies.length, allProducts.length);
  const dealsToCreate = [];

  // Seed with deterministic shuffle so reruns are consistent
  const companyPool  = [...realCompanies].sort((a, b) => a.name.localeCompare(b.name));
  const productPool  = [...allProducts];

  for (let i = 0; i < targetCount; i++) {
    const company  = companyPool[i % companyPool.length];
    const product  = productPool[i % productPool.length];
    const status   = STATUSES[i];
    const salesperson = SALESPEOPLE[i % SALESPEOPLE.length];
    const daysBack = [5, 12, 20, 35, 45, 60, 75, 90, 110, 130][i] ?? 30;

    // Add 15–30% markup to the parts cost to get a realistic sell price
    const markup   = 1.15 + (i % 4) * 0.05;
    const amount   = Math.round(product.price * markup);

    dealsToCreate.push({
      company,
      product,
      status,
      salesperson,
      amount,
      daysBack,
      index: i,
    });
  }

  // 5. Insert deals + units ────────────────────────────────────────
  let dealsCreated   = 0;
  let unitsCreated   = 0;
  let dealsSkipped   = 0;

  const now = new Date();

  for (const item of dealsToCreate) {
    const { company, product, status, salesperson, amount, daysBack, index } = item;
    const createdAt = daysAgo(daysBack);

    const dealTitle = `${product.unitType} - ${company.name}`;

    // Idempotency: skip if deal with same title + amount already exists
    const existing = await dealsCol.findOne({ tenantId: TENANT, title: dealTitle, amount });
    if (existing) {
      dealsSkipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would create deal: "${dealTitle}" $${amount.toLocaleString()} (${status})`);
      dealsCreated++;
      continue;
    }

    // Create unit first so we can link dealId
    const unitVin = fakeVin(index + 100);
    const stockNum = `DEMO-${2025 + (index % 2)}-${String(index + 1).padStart(3, '0')}`;

    // Check for existing unit by stock number
    const existingUnit = await unitsCol.findOne({ tenantId: TENANT, stockNumber: stockNum });
    let unitId = existingUnit?._id?.toString() ?? null;

    if (!existingUnit) {
      const unitResult = await unitsCol.insertOne({
        tenantId:    TENANT,
        vin:         unitVin,
        stockNumber: stockNum,
        year:        product.year,
        make:        product.make,
        model:       product.unitType,
        spec:        product.description.slice(0, 200),
        msrp:        amount,
        entity:      'WKI',
        location:    'Wichita',
        status:      ['Won', 'Delivered', 'In Build'].includes(status) ? 'Reserved' : 'Available',
        dealId:      null,   // will update after deal insert
        createdAt,
        updatedAt:   now,
      });
      unitId = unitResult.insertedId.toString();
      unitsCreated++;
    }

    // Insert deal
    const dealResult = await dealsCol.insertOne({
      tenantId:      TENANT,
      title:         dealTitle,
      company:       company.name,
      contact:       '',
      amount,
      assignedTo:    salesperson,
      unitId,
      notes:         product.description.slice(0, 300),
      status,
      createdAt,
      updatedAt:     now,
      lastTouchedAt: createdAt,
    });

    const dealId = dealResult.insertedId.toString();
    dealsCreated++;

    // Back-link the unit to the deal
    if (unitId && !existingUnit) {
      await unitsCol.updateOne({ _id: new ObjectId(unitId) }, { $set: { dealId } });
    }
  }

  // 6. Summary ─────────────────────────────────────────────────────
  console.log('\n[qrf-import] ─────────────────────────────────');
  console.log(`[qrf-import] Tenant:          ${TENANT}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`[qrf-import] Deals created:   ${dealsCreated}`);
  console.log(`[qrf-import] Units created:   ${unitsCreated}`);
  console.log(`[qrf-import] Deals skipped:   ${dealsSkipped} (already existed)`);
  console.log('[qrf-import] ─────────────────────────────────');

  await client.close();
}

main().catch(e => { console.error('[qrf-import] Fatal:', e); process.exit(1); });
