// scripts/seed-admin.mjs
// Creates the initial super_admin user.
// Run once: node scripts/seed-admin.mjs
//
// Edit the USER object below before running.

import { MongoClient } from 'mongodb';
import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dependency needed) ──────────────
const envPath = resolve(__dirname, '../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const MONGODB_URI = envVars['MONGODB_URI'];
const DB_NAME     = envVars['DB_NAME'] ?? 'mtte_core';

if (!MONGODB_URI) { console.error('MONGODB_URI not found in .env'); process.exit(1); }

// ── Admin user to create ──────────────────────────────────────────
const USER = {
  name:     'Michaela',
  email:    'mike@wki.com',   // change if needed
  password: 'Admin1234!',     // change to your desired login password
  role:     'super_admin',
  entity:   'WKI',
  location: 'Wichita',
  tenantId: 'wki-wichita',
};

// ── bcrypt-compatible SHA-based hash (requires bcryptjs) ──────────
// We'll use a dynamic import of bcryptjs from the api workspace deps
async function hashPassword(plain) {
  const bcrypt = await import('../packages/api/node_modules/bcryptjs/dist/bcrypt.js').catch(() =>
    import('../node_modules/bcryptjs/dist/bcrypt.js')
  );
  return bcrypt.default.hash(plain, 12);
}

async function main() {
  console.log('Connecting to Atlas…');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db     = client.db(DB_NAME);
  const users  = db.collection('users');

  const existing = await users.findOne({ email: USER.email });
  if (existing) {
    console.log(`User ${USER.email} already exists (id: ${existing._id}). Nothing created.`);
    await client.close();
    return;
  }

  const passwordHash = await hashPassword(USER.password);
  const now = new Date();
  const result = await users.insertOne({
    name:          USER.name,
    email:         USER.email,
    passwordHash,
    role:          USER.role,
    entity:        USER.entity,
    location:      USER.location,
    tenantId:      USER.tenantId,
    active:        true,
    createdAt:     now,
    updatedAt:     now,
    lastLoginAt:   null,
  });

  console.log(`Created super_admin: ${USER.email}  (id: ${result.insertedId})`);
  console.log(`Login password: ${USER.password}`);
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
