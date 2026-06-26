#!/usr/bin/env node
/**
 * Reset password hashes for every user in the users collection.
 *
 * Use when admin-created accounts cannot log in (wrong hash, legacy `password` field, etc.).
 *
 * Usage (production — paste URI from Render → The-Hub-Api → Environment):
 *   $env:TARGET_MONGODB_URI="mongodb+srv://...thehub.../hub_crm"
 *   $env:DB_NAME="hub_crm"
 *   $env:RESET_PASSWORD="your-new-password"
 *   npm run reset:all-passwords:dry-run
 *   npm run reset:all-passwords:apply
 *
 * On Render Shell (MONGODB_URI already set on the API service):
 *   RESET_PASSWORD='...' node scripts/reset-all-user-passwords.mjs --apply --confirm
 *
 * Never commit RESET_PASSWORD or production URIs to git.
 */

import { MongoClient } from 'mongodb';
import { loadEnv, getMongoDb, parseMongoTarget } from './lib/hub-refresh-utils.mjs';

loadEnv();

const apply = process.argv.includes('--apply');
const confirm = process.argv.includes('--confirm');
const emailFilter = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]?.toLowerCase().trim()
  : null;

const uri = process.env.TARGET_MONGODB_URI || process.env.MONGODB_URI;
const newPassword = process.env.RESET_PASSWORD?.trim();

if (!uri) {
  console.error('[reset-passwords] TARGET_MONGODB_URI or MONGODB_URI is required');
  process.exit(1);
}

if (apply && (!confirm || !newPassword)) {
  console.error(
    '[reset-passwords] Apply requires --confirm and RESET_PASSWORD in the environment',
  );
  process.exit(1);
}

async function hashPassword(plain) {
  const bcrypt = await import('../packages/api/node_modules/bcryptjs/dist/bcrypt.js').catch(() =>
    import('../node_modules/bcryptjs/dist/bcrypt.js'),
  );
  return bcrypt.default.hash(plain, 12);
}

async function verifyPassword(plain, hash) {
  const bcrypt = await import('../packages/api/node_modules/bcryptjs/dist/bcrypt.js').catch(() =>
    import('../node_modules/bcryptjs/dist/bcrypt.js'),
  );
  return bcrypt.default.compare(plain, hash);
}

const mongoTarget = parseMongoTarget(uri);
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = getMongoDb(client);
  const dbName = db.databaseName;
  const users = db.collection('users');

  const query = emailFilter ? { email: emailFilter } : {};
  const allUsers = await users
    .find(query, {
      projection: { email: 1, name: 1, role: 1, active: 1, tenantId: 1, passwordHash: 1, password: 1 },
    })
    .sort({ email: 1 })
    .toArray();

  console.log('\n=== Reset all user passwords ===\n');
  console.log(`  Mode:       ${apply ? 'APPLY' : 'dry-run'}`);
  console.log(`  Mongo host: ${mongoTarget.host}`);
  console.log(`  Database:   ${dbName}`);
  console.log(`  Users:      ${allUsers.length}${emailFilter ? ` (filter: ${emailFilter})` : ''}`);

  if (allUsers.length === 0) {
    console.error('\n[reset-passwords] No users matched — check DB_NAME / cluster URI.');
    process.exit(1);
  }

  const jason = allUsers.find(u => u.email === 'jason@hubonlewis.com');
  if (!jason && !emailFilter) {
    console.warn(
      '\n  ⚠ jason@hubonlewis.com not found — this may not be the production HuB database.',
    );
    if (apply) {
      console.error('[reset-passwords] Aborting apply without Jason user (safety check).');
      process.exit(1);
    }
  }

  console.log('\nUsers:');
  for (const u of allUsers) {
    const hashState = u.passwordHash ? 'passwordHash' : u.password ? 'legacy password field' : 'no hash';
    console.log(
      `  ${u.email}  role=${u.role}  active=${u.active}  tenant=${u.tenantId ?? '(none)'}  [${hashState}]`,
    );
  }

  if (!apply) {
    console.log('\n[reset-passwords] Dry-run only — no changes written.');
    console.log('  Set RESET_PASSWORD, then run with --apply --confirm to update all listed users.');
    process.exit(0);
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  let updated = 0;

  for (const u of allUsers) {
    const result = await users.updateOne(
      { _id: u._id },
      {
        $set: { passwordHash, updatedAt: now },
        $unset: { password: '' },
      },
    );
    if (result.modifiedCount === 1 || result.matchedCount === 1) updated += 1;
    console.log(`  updated ${u.email}`);
  }

  const sample = allUsers[0];
  const refreshed = await users.findOne({ _id: sample._id }, { projection: { passwordHash: 1 } });
  const ok = refreshed?.passwordHash && (await verifyPassword(newPassword, refreshed.passwordHash));

  console.log(`\n[reset-passwords] Updated ${updated} user(s).`);
  console.log(`  Bcrypt verify (${sample.email}): ${ok ? 'OK' : 'FAILED'}`);

  if (!ok) {
    console.error('[reset-passwords] Post-update verification failed — investigate before sharing password.');
    process.exit(1);
  }

  console.log('\n[reset-passwords] Done. Users can log in with RESET_PASSWORD; change after first login.');
} finally {
  await client.close();
}
