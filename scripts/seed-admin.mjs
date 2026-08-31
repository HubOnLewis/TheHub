// scripts/seed-admin.mjs
// ─────────────────────────────────────────────────────────────────────────────
// LOCAL / DEVELOPMENT ONLY — seeds or updates Hub login operators.
//
// Default identities (HuB on Lewis):
//   Jason Lavender  jason@hubonlewis.com  role=super_admin
//   Hannah Bayless  hannah@hubonlewis.com role=admin
//
// NEVER use local defaults in production. Override via SEED_* / SEED_HANNAH_* in
// repo-root `.env` or shell. This script does not print password values.
//
// Re-running updates the password hash if the user already exists (same email),
// so local login keeps working after credential changes.
//
// Supported overrides (optional):
//   SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD,
//   SEED_ADMIN_ENTITY, SEED_ADMIN_LOCATION, SEED_ADMIN_TENANT_ID
//   SEED_HANNAH_NAME, SEED_HANNAH_EMAIL, SEED_HANNAH_PASSWORD,
//   SEED_HANNAH_ENTITY, SEED_HANNAH_LOCATION, SEED_HANNAH_TENANT_ID
// ─────────────────────────────────────────────────────────────────────────────

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  buildSeedUsers,
  planSeedUpsert,
  userDocFromSpec,
  userUpdateFromSpec,
} from './lib/seed-admin-users.mjs';

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

const LOCAL_DEV_PASSWORD = 'HubAdmin123!';
const { users: seedUsers } = buildSeedUsers(pick, { localDefaultPassword: LOCAL_DEV_PASSWORD });

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

  const existing = await users
    .find({ email: { $in: seedUsers.map(u => u.email) } }, { projection: { email: 1 } })
    .toArray();
  const plan = planSeedUpsert(existing.map(u => u.email), seedUsers);
  const now = new Date();

  for (const step of plan) {
    const spec = step.spec;
    const passwordHash = await hashPassword(spec.password);
    if (step.action === 'update') {
      const row = existing.find(u => String(u.email).toLowerCase() === spec.email);
      await users.updateOne({ _id: row._id }, { $set: userUpdateFromSpec(spec, passwordHash, now) });
      console.log(`Updated existing ${spec.role}: ${spec.email} (id: ${row._id})`);
    } else {
      const result = await users.insertOne(userDocFromSpec(spec, passwordHash, now));
      console.log(`Created ${spec.role}: ${spec.email}  (id: ${result.insertedId})`);
    }
  }

  console.log('Done. Password hashes refreshed from SEED_* env / local defaults. Ensure API SUPER_ADMIN_EMAILS includes owner emails for full admin scope.');
  await client.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});