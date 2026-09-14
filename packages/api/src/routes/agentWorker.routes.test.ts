/**
 * Regression: GET /jobs/next must not be captured by GET /jobs/:id.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/hub_test';
process.env.JWT_SECRET ??= 'agent-worker-route-test-secret-32ch!!';
process.env.SUPER_ADMIN_EMAILS ??= 'jason@hubonlewis.com';
process.env.HUB_AGENT_READ_TOKEN = 'test-agent-worker-token';
process.env.HUB_AGENT_TENANT_ID = 'hub-wichita';

const express = (await import('express')).default;
const { default: agentWorkerRoutes } = await import('./agentWorker.js');

function getJobGetPaths(): string[] {
  return agentWorkerRoutes.stack
    .filter(layer => {
      const route = layer.route as { methods?: Record<string, boolean>; path?: string } | undefined;
      return Boolean(route?.methods?.get && String(route.path).startsWith('/jobs'));
    })
    .map(layer => String((layer.route as { path: string }).path));
}

test('GET /jobs/next is registered before GET /jobs/:id', () => {
  const paths = getJobGetPaths();
  const nextIdx = paths.indexOf('/jobs/next');
  const idIdx = paths.indexOf('/jobs/:id');
  assert.ok(nextIdx >= 0, 'jobs/next route missing');
  assert.ok(idIdx >= 0, 'jobs/:id route missing');
  assert.ok(
    nextIdx < idIdx,
    `jobs/next (${nextIdx}) must precede jobs/:id (${idIdx}); got ${paths.join(', ')}`,
  );
});

test('GET /api/agent-worker/jobs/next?nodeId=hub-pc-onsite is not captured by /jobs/:id (204 when no job)', async () => {
  const paths = getJobGetPaths();
  const probe = express.Router();
  for (const path of paths) {
    if (path === '/jobs/next') {
      probe.get(path, (_req, res) => {
        res.status(204).end();
      });
    } else if (path === '/jobs/:id') {
      probe.get(path, (req, res) => {
        res.status(404).json({ capturedAsId: req.params['id'] });
      });
    }
  }

  const app = express();
  app.use('/api/agent-worker', probe);
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no listen port');

  try {
    const res = await fetch(
      `http://127.0.0.1:${addr.port}/api/agent-worker/jobs/next?nodeId=hub-pc-onsite`,
    );
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('content-type'), null);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  }
});
