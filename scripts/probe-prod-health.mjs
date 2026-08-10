/**
 * Quick production reachability probe (no secrets).
 * Usage: node scripts/probe-prod-health.mjs
 */
const API = process.env.HUB_API_PUBLIC_URL || 'https://api.hubonlewis.com';
const WEB = process.env.HUB_WEB_PUBLIC_URL || 'https://admin.hubonlewis.com';

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 400) };
}

const health = await get(`${API.replace(/\/$/, '')}/health`);
console.log('API /health', health.status, health.text);

const login = await get(`${WEB.replace(/\/$/, '')}/login`);
console.log('WEB /login', login.status, `len=${login.text.length}`);

try {
  const h = JSON.parse(health.text);
  console.log('AI configured:', h.ai?.configured, 'provider:', h.ai?.provider, 'mode:', h.ai?.mode);
  console.log('productMode:', h.productMode);
} catch {
  /* ignore */
}

console.log('\nNext: reset passwords if login fails — docs/HUB_PRODUCTION_UNLOCK.md');
