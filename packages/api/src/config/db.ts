// packages/api/src/config/db.ts
import { MongoClient, type Db } from 'mongodb';
import { env } from './env.js';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (database) return database;

  client   = new MongoClient(env.MONGODB_URI);
  await client.connect();
  database = client.db(env.DB_NAME);

  console.log(`[DB] Connected to MongoDB — ${env.DB_NAME}`);
  return database;
}

export function getDB(): Db {
  if (!database) throw new Error('Database not initialised — call connectDB() first');
  return database;
}

export async function closeDB(): Promise<void> {
  await client?.close();
  client   = null;
  database = null;
}
