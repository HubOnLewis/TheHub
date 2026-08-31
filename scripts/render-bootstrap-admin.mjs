/**
 * Render preDeploy hook — creates missing Hub operators without overwriting accounts.
 *
 * Empty users collection → Jason (super_admin) + Hannah (admin).
 * Jason present / Hannah missing → create Hannah only.
 * Existing accounts are never overwritten (password, role, or name).
 *
 * Set SEED_ADMIN_PASSWORD (and optional SEED_HANNAH_PASSWORD) before first deploy.
 * This script does not print password values.
 */
import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { buildSeedUsers, planBootstrap, userDocFromSpec } from './lib/seed-admin-users.mjs';

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

const fileEnv = loadEnvFile(resolve(__dirname, '../.env'));

function pick(key, fallback) {
  const v = process.env[key] ?? fileEnv[key];
  return v !== undefined && v !== '' ? v : fallback;
}

const MONGODB_URI = pick('MONGODB_URI', '');
const DB_NAME = pick('DB_NAME', 'hub_crm');

if (!MONGODB_URI) {
  console.log('[bootstrap] MONGODB_URI unset — skipping admin bootstrap.');
  process.exit(0);
}

const { users: seedUsers } = buildSeedUsers(pick);

async function hashPassword(plain) {
  const bcrypt = await import('../packages/api/node_modules/bcryptjs/dist/bcrypt.js').catch(() =>
    import('../node_modules/bcryptjs/dist/bcrypt.js'),
  );
  return bcrypt.default.hash(plain, 12);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const users = db.collection('users');

  const existing = await users.find({}, { projection: { email: 1 } }).toArray();
  const plan = planBootstrap(
    existing.map(u => u.email),
    seedUsers,
    { requirePassword: true },
  );

  if (plan.toCreate.length === 0) {
    const missingPw = plan.skipped.filter(s => s.reason === 'password-missing');
    if (missingPw.length) {
      console.warn(
        `[bootstrap] ${missingPw.map(s => s.email).join(', ')} missing but seed password is unset or too short.`,
      );
      console.warn('[bootstrap] Set SEED_ADMIN_PASSWORD (and optional SEED_HANNAH_PASSWORD) in Render, then redeploy API.');
    } else {
      console.log(`[bootstrap] ${existing.length} user(s) exist — seed operators present, nothing to create.`);
    }
    await client.close();
    return;
  }

  const now = new Date();
  for (const spec of plan.toCreate) {
    const passwordHash = await hashPassword(spec.password);
    const result = await users.insertOne(userDocFromSpec(spec, passwordHash, now));
    console.log(`[bootstrap] Created ${spec.role}: ${spec.email} (id: ${result.insertedId})`);
  }

  await client.close();
}

main().catch(err => {
  console.error('[bootstrap] Failed:', err);
  process.exit(1);
});