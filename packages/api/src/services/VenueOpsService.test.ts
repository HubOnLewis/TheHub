import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateVenueOps } from '@hub-crm/shared';

test('venue ops queue maps high-priority stale inquiries', () => {
  const tasks = evaluateVenueOps({
    _id: 'abc',
    title: 'Inquiry',
    contact: 'Alex',
    status: 'Draft',
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    importMeta: { pvStatus: 'lead' },
  });
  assert.ok(tasks.some(t => t.kind === 'stale_inquiry' && t.priority === 'high'));
});
