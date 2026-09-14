import assert from 'node:assert/strict';
import http from 'node:http';
import test, { mock } from 'node:test';
import express from 'express';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/hub_test';
process.env.JWT_SECRET ??= 'public-availability-route-test-secret-32!!';
process.env.SUPER_ADMIN_EMAILS ??= 'jason@hubonlewis.com';

const { default: publicAvailabilityRoutes } = await import('./publicAvailability.js');
const { default: dealRoutes } = await import('./deals.js');
const { publicAvailabilityService } = await import('../services/PublicAvailabilityService.js');
const { publicAvailabilityLeaksInternal } = await import('@hub-crm/shared');

test.afterEach(() => {
  mock.restoreAll();
});

async function listen(app: express.Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return { server, port: addr.port };
}

test('anonymous visitor can retrieve public availability DTO only', async () => {
  mock.method(publicAvailabilityService, 'listPublicRange', async () => ({
    startDate: '2026-12-01',
    endDate: '2026-12-01',
    days: [{ date: '2026-12-01', status: 'available' as const }],
  }));
  const app = express();
  app.use('/api/public/availability', publicAvailabilityRoutes);
  const { server, port } = await listen(app);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/public/availability?startDate=2026-12-01&endDate=2026-12-01`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['days', 'endDate', 'startDate']);
    assert.deepEqual(publicAvailabilityLeaksInternal(body), []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  }
});

test('unauthenticated visitor cannot access internal event calendar', async () => {
  const app = express();
  app.use('/api/deals', dealRoutes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err === 'object' && err && 'statusCode' in err ? Number((err as { statusCode: number }).statusCode) : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'error' });
  });
  const { server, port } = await listen(app);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/deals/calendar`);
    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  }
});
