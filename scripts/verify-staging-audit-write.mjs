import fs from 'node:fs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

const env = {};
for (const line of fs.readFileSync('.env.staging.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const api = 'http://127.0.0.1:3311/api';
const jwtSecret = 'hub-staging-api-verification-secret-32-chars';
const token = jwt.sign({ id: 'staging-audit-verifier', name: 'Staging Audit Verifier', email: 'staging-audit-verifier@example.test', role: 'admin', entity: 'HUB', location: 'Wichita', tenantId: env.HUB_TENANT_ID }, jwtSecret, { expiresIn: '10m' });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const correlationIds = [];
const getDeals = await fetch(`${api}/deals?limit=1&sort=updatedAt&order=desc`, { headers });
if (!getDeals.ok) throw new Error(`deal list failed: ${getDeals.status}`);
const deal = (await getDeals.json()).data?.[0];
if (!deal?._id) throw new Error('no staging deal available');
const originalNotes = deal.notes ?? '';
async function patch(notes) {
  const correlationId = crypto.randomUUID();
  correlationIds.push(correlationId);
  const response = await fetch(`${api}/deals/${deal._id}`, {
    method: 'PATCH', headers: { ...headers, 'x-request-id': correlationId },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) throw new Error(`deal patch failed: ${response.status}`);
  return { correlationId, body: await response.json() };
}
const changed = await patch(`${originalNotes}${originalNotes ? '\n' : ''}[staging-audit-verification]`);
const restored = await patch(originalNotes);
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const audit = await client.db(env.DB_NAME).collection('audit_events').find({ correlationId: { $in: correlationIds } }).project({ _id: 0, actorName: 1, tenantId: 1, timestamp: 1, action: 1, entityType: 1, entityId: 1, source: 1, correlationId: 1, metadata: 1 }).sort({ timestamp: 1 }).toArray();
  console.log(JSON.stringify({ dealId: String(deal._id), mutation: 'notes marker then restore', changedStatus: changed.body.status, restoredStatus: restored.body.status, correlationIds, auditEvents: audit }, null, 2));
} finally { await client.close(); }
