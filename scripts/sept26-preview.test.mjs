import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/preview-sept26-import.mjs', '--root', 'import/sept26'], { encoding: 'utf8' });
const preview = JSON.parse(output);

test('September preview supports every imported entity category', () => {
  assert.equal(preview.entityPreview.eventsDeals.validRows, 486);
  assert.equal(preview.entityPreview.contactsCustomers.validRows, 441);
  assert.equal(preview.entityPreview.proposalsPackages.validRows, 312);
  assert.equal(preview.entityPreview.payments.validRows, 170);
  assert.equal(preview.relationshipPreview.proposalEventLinks, 309);
  assert.equal(preview.relationshipPreview.orphanPaymentRows, 0);
});

test('September preview preserves source conflicts instead of inventing relationships', () => {
  assert.equal(preview.entityPreview.contactsCustomers.conflicts, 12);
  assert.equal(preview.entityPreview.proposalsPackages.conflicts, 5);
  assert.equal(preview.entityPreview.proposalsPackages.rejects, 1);
  assert.equal(preview.databaseComparison.status, 'blocked');
});
