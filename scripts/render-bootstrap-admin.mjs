/**
 * Render preDeploy hook — creates the first super_admin only when the users collection is empty.
 * Safe to run on every deploy; never overwrites existing accounts.
 *
 * Set SEED_ADMIN_PASSWORD (sync: false in Blueprint) before first deploy.
 */
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

const USER = {
  name: pick('SEED_ADMIN_NAME', 'Jason Lavender'),
  email: pick('SEED_ADMIN_EMAIL', 'jason@hubonlewis.com').toLowerCase().trim(),
  password: pick('SEED_ADMIN_PASSWORD', ''),
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
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const users = db.collection('users');

  const existingCount = await users.countDocuments();
  if (existingCount > 0) {
    console.log(`[bootstrap] ${existingCount} user(s) exist — skipping seed.`);
    await client.close();
    return;
  }

  if (!USER.password || USER.password.length < 8) {
    console.warn(
      '[bootstrap] No users in database but SEED_ADMIN_PASSWORD is unset or too short.',
    );
    console.warn('[bootstrap] Set SEED_ADMIN_PASSWORD in Render, then redeploy API.');
    await client.close();
    process.exit(0);
  }

  const passwordHash = await hashPassword(USER.password);
  const now = new Date();
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

  console.log(`[bootstrap] Created first super_admin: ${USER.email} (id: ${result.insertedId})`);
  await client.close();
}

main().catch(err => {
  console.error('[bootstrap] Failed:', err);
  process.exit(1);
});
