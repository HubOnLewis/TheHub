import fs from 'node:fs';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';

const env = { NODE_ENV: 'development', PORT: '3311', JWT_SECRET: 'hub-staging-api-verification-secret-32-chars', SUPER_ADMIN_EMAILS: 'jason@hubonlewis.com', HUB_PRODUCT_MODE: 'venue', CORS_ORIGINS: 'http://localhost:5173' };
for (const line of fs.readFileSync('.env.staging.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const base = 'http://127.0.0.1:3311';
const token = jwt.sign({ id: 'staging-verifier', name: 'Staging Verifier', email: 'jason@hubonlewis.com', role: 'super_admin', entity: 'HUB', location: 'Wichita', tenantId: 'hub-wichita' }, env.JWT_SECRET, { expiresIn: '10m' });
const tsxCli = `${process.cwd()}${process.platform === 'win32' ? '\\node_modules\\tsx\\dist\\cli.mjs' : '/node_modules/tsx/dist/cli.mjs'}`;
const child = spawn(process.execPath, [tsxCli, 'packages/api/src/server.ts'], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });
try {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch {}
  }
  if (!ready) throw new Error(`Staging API did not become ready. ${output.slice(-1000)}`);
  const headers = { Authorization: `Bearer ${token}` };
  const get = async path => { const response = await fetch(`${base}${path}`, { headers }); return { status: response.status, body: await response.json() }; };
  const contacts = await get('/api/contacts?limit=1');
  const deals = await get('/api/deals?limit=1');
  const payments = await get('/api/financial/payments');
  const dealId = deals.body?.data?.[0]?._id;
  const proposals = dealId ? await get(`/api/proposals?eventId=${encodeURIComponent(dealId)}`) : { status: null, body: null };
  console.log(JSON.stringify({ health: 200, contacts: { status: contacts.status, total: contacts.body?.total }, deals: { status: deals.status, total: deals.body?.total }, importedPayments: { status: payments.status, total: payments.body?.data?.length }, proposals: { status: proposals.status, count: proposals.body?.data?.length } }, null, 2));
} finally { child.kill(); }
