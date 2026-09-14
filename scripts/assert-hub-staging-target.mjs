#!/usr/bin/env node
/** Refuse Hub imports unless the target is explicitly approved staging. */

const uri = String(process.env.MONGODB_URI ?? '').trim();
const dbName = String(process.env.DB_NAME ?? '').trim();
const tenantId = String(process.env.HUB_TENANT_ID ?? '').trim();
const approved = ['1', 'true', 'yes'].includes(String(process.env.HUB_STAGING_APPROVED ?? '').toLowerCase());

if (!uri) throw new Error('MONGODB_URI is required for staging validation');
if (!dbName) throw new Error('DB_NAME is required for staging validation');
if (!tenantId) throw new Error('HUB_TENANT_ID is required for staging validation');
if (!approved) throw new Error('HUB_STAGING_APPROVED=1 is required; refusing unapproved database target');
if (dbName === 'hub_crm' || dbName === 'mtte_core' || /mtte_core/i.test(uri)) {
  throw new Error(`Refusing protected database target: ${dbName || '(missing)'}`);
}
if (!/staging|sandbox|test/i.test(dbName)) {
  throw new Error(`Refusing non-staging database name: ${dbName}`);
}

let parsed;
try {
  parsed = new URL(uri);
} catch {
  throw new Error('MONGODB_URI is not a valid MongoDB URI');
}

console.log(JSON.stringify({
  approved: true,
  host: parsed.hostname,
  database: dbName,
  tenantId,
  writesAllowed: true,
}, null, 2));
