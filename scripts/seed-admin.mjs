// scripts/seed-admin.mjs
// ─────────────────────────────────────────────────────────────────────────────
// LOCAL / DEVELOPMENT ONLY — seeds or updates the demo super_admin for The Hub CRM.
//
// Default demo identity (HuB on Lewis):
//   Email: jason@hubonlewis.com
//   Password: HubAdmin123!   (change after first login on shared machines)
//
// NEVER use these defaults in production. Override via SEED_* in repo-root `.env` or shell.
//
// Re-running this script updates the password hash if the user already exists (same email),
// so local login keeps working after credential changes.
//
// Supported overrides (optional):
//   SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD,
//   SEED_ADMIN_ENTITY, SEED_ADMIN_LOCATION, SEED_ADMIN_TENANT_ID
// ─────────────────────────────────────────────────────────────────────────────

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    return Object.fromEntries(
      raw
        .split('\n')
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const envPath = resolve(__dirname, '../.env');
const fileEnv = loadEnvFile(envPath);

/** Prefer process.env (CI/shell), then .env file, then fallback. */
function pick(key, fallback) {
  const v = process.env[key] ?? fileEnv[key];
  return v !== undefined && v !== '' ? v : fallback;
}

const MONGODB_URI = pick('MONGODB_URI', '');
const DB_NAME = pick('DB_NAME', 'hub_crm');

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set — add it to .env or export it before running.');
  process.exit(1);
}

const USER = {
  name: pick('SEED_ADMIN_NAME', 'Jason Lavender'),
  email: pick('SEED_ADMIN_EMAIL', 'jason@hubonlewis.com').toLowerCase().trim(),
  password: pick('SEED_ADMIN_PASSWORD', 'HubAdmin123!'),
  role: 'super_admin',
  entity: pick('SEED_ADMIN_ENTITY', 'HUB'),
  location: pick('SEED_ADMIN_LOCATION', 'Wichita'),
  tenantId: pick('SEED_ADMIN_TENANT_ID', 'hub-wichita'),
};

async function hashPassword(plain) {
  const bcrypt = await import('../packages/api/node_modules/bcryptjs/dist/bcrypt.js').catch(() =>
    import('../node_modules/bcryptjs/dist/bcrypt.js'),
  );
  return bcrypt.default.hash(plain, 12);
}

async function main() {
  console.log('Connecting to MongoDB…');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const users = db.collection('users');

  const passwordHash = await hashPassword(USER.password);
  const now = new Date();

  const existing = await users.findOne({ email: USER.email });

  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: USER.name,
          passwordHash,
          role: USER.role,
          entity: USER.entity,
          location: USER.location,
          tenantId: USER.tenantId,
          active: true,
          updatedAt: now,
        },
      },
    );
    console.log(`Updated existing super_admin: ${USER.email} (id: ${existing._id})`);
    console.log('Password hash refreshed — use current SEED_ADMIN_PASSWORD / default HubAdmin123! for login.');
  } else {
    const result = await users.insertOne({
      name: USER.name,
      email: USER.email,
      passwordHash,
      role: USER.role,
      entity: USER.entity,
      location: USER.location,
      tenantId: USER.tenantId,
      active: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    console.log(`Created super_admin: ${USER.email}  (id: ${result.insertedId})`);
  }

  console.log('Done. Ensure API .env SUPER_ADMIN_EMAILS includes this email for full admin scope.');
  await client.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
