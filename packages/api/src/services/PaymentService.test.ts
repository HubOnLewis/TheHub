import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { applyStaffPaymentToMeta } = await import('./PaymentService.js');

test('staff payment persistence updates amountPaid, balance, and payment schedule on importMeta', () => {
  const first = applyStaffPaymentToMeta(
    { grandTotal: 4000, amountPaid: 0, balanceDue: 4000, payments: [] },
    4000,
    { amount: 1000, kind: 'deposit', paymentLinkId: 'plink_1' },
  );
  assert.equal(first.amountPaid, 1000);
  assert.equal(first.balanceDue, 3000);
  assert.equal(first.depositPaid, true);
  assert.equal(first.paidInFull, false);
  assert.equal(Array.isArray(first.payments) && (first.payments as unknown[]).length, 1);

  const second = applyStaffPaymentToMeta(first, 4000, {
    amount: 3000,
    kind: 'balance',
    paymentLinkId: 'plink_2',
  });
  assert.equal(second.amountPaid, 4000);
  assert.equal(second.balanceDue, 0);
  assert.equal(second.paidInFull, true);
  assert.equal(Array.isArray(second.payments) && (second.payments as unknown[]).length, 2);
});

test('payment ledger entries are appended, not replaced', () => {
  const next = applyStaffPaymentToMeta(
    {
      grandTotal: 2500,
      amountPaid: 500,
      payments: [{ amount: 500, paymentType: 'deposit' }],
    },
    2500,
    { amount: 200, kind: 'custom' },
  );
  const payments = next.payments as Array<{ amount: number }>;
  assert.equal(payments.length, 2);
  assert.equal(payments[1]?.amount, 200);
  assert.equal(next.amountPaid, 700);
  assert.equal(next.balanceDue, 1800);
});
