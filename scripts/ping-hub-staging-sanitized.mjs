import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const values = {};
for (const line of fs.readFileSync('.env.staging.local', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const index = trimmed.indexOf('=');
  if (index > 0) values[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
}
const parsed = new URL(values.MONGODB_URI);
const client = new MongoClient(parsed.toString(), { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db(values.DB_NAME);
  const result = await db.command({ ping: 1 });
  console.log(JSON.stringify({ ok: result.ok, database: db.databaseName, host: parsed.hostname, username: parsed.username, authSource: parsed.searchParams.get('authSource') || '(driver default)' }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ name: error?.name, code: error?.code, codeName: error?.codeName, message: error?.message, attemptedUsername: parsed.username, authSource: parsed.searchParams.get('authSource') || '(driver default)' }, null, 2));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
