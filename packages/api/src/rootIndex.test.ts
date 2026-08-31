import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import express from 'express';

const { getApiRoot, apiRootPayload, HUB_ADMIN_URL } = await import('./rootIndex.js');

test('GET / returns 200 JSON with status, productMode, health pointer, and adminUrl', async () => {
  const app = express();
  app.get('/', getApiRoot);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(undefined));
    server.on('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no listen port');
  try {
    const res = await fetch('http://127.0.0.1:' + addr.port + '/');
    assert.equal(res.status, 200);
    assert.equal(res.redirected, false);
    assert.match(String(res.headers.get('content-type') ?? ''), /json/i);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.productMode, apiRootPayload().productMode);
    assert.equal(body.health, '/health');
    assert.equal(body.adminUrl, HUB_ADMIN_URL);
    assert.equal(body.adminUrl, 'https://admin.hubonlewis.com');
    assert.ok(!String(res.headers.get('content-type') ?? '').includes('text/html'));
  } finally {
    await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve(undefined))));
  }
});

test('apiRootPayload is JSON-serializable and does not redirect', () => {
  const body = apiRootPayload();
  assert.equal(body.status, 'ok');
  assert.ok(body.productMode === 'venue' || body.productMode === 'equipment');
  assert.equal(body.health, '/health');
  assert.equal(body.adminUrl, 'https://admin.hubonlewis.com');
  const json = JSON.stringify(body);
  assert.match(json, /"status":"ok"/);
  assert.doesNotMatch(json, /<!DOCTYPE/i);
});
