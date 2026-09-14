import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const values = {};
for (const line of fs.readFileSync('.env.staging.local', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const index = trimmed.indexOf('=');
  if (index > 0) values[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
}

const client = new MongoClient(values.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
try {
  await client.connect();
  const db = client.db(values.DB_NAME);
  const result = await db.command({ ping: 1 });
  console.log(JSON.stringify({ ok: result.ok, database: db.databaseName, host: new URL(values.MONGODB_URI).hostname }, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    name: error?.name,
    code: error?.code,
    codeName: error?.codeName,
    message: error?.message,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
