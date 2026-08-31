/**
 * Guest payment-summary print from Hub payment_links (amounts, due dates, paid/unpaid).
 * Not a Stripe charge. Same ledger the portal already lists.
 */

import { formatCurrency } from '../utils/index.js';

function escDoc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type PaymentSummaryLedgerRow = {
  kind: string;
  amount: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
};

export type PaymentSummaryDocInput = {
  title: string;
  eventDateDisplay: string;
  packageTotal: number;
  paidTotal: number;
  balanceDue: number;
  payments: PaymentSummaryLedgerRow[];
};

export type PaymentSummaryLedgerFields = {
  kind: string;
  amountLabel: string;
  dueDate: string;
  statusLabel: string;
  paidOn: string;
  paid: boolean;
};

function kindLabel(kind: string): string {
  if (kind === 'deposit') return 'Deposit';
  if (kind === 'balance') return 'Final balance';
  return kind.trim() || 'Payment';
}

function statusLabel(status: string): { label: string; paid: boolean } {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return { label: 'Paid', paid: true };
  if (s === 'void') return { label: 'Void', paid: false };
  if (s === 'expired') return { label: 'Expired', paid: false };
  return { label: 'Unpaid', paid: false };
}

/** Flatten a payment_links row into printable ledger fields. */
export function paymentSummaryLedgerFields(row: PaymentSummaryLedgerRow): PaymentSummaryLedgerFields {
  const st = statusLabel(row.status);
  const due = typeof row.dueDate === 'string' && row.dueDate.trim() ? row.dueDate.trim().slice(0, 10) : '—';
  const paidOn =
    st.paid && typeof row.paidAt === 'string' && row.paidAt.trim() ? row.paidAt.trim().slice(0, 10) : '—';
  return {
    kind: kindLabel(row.kind),
    amountLabel: formatCurrency(row.amount),
    dueDate: due,
    statusLabel: st.label,
    paidOn,
    paid: st.paid,
  };
}

/** HTML fragment: payment_links schedule + package/paid/balance. Used by guest print. */
export function buildGuestPaymentSummaryDocHtml(input: PaymentSummaryDocInput): string {
  const rows = input.payments.length
    ? input.payments
        .map(p => {
          const f = paymentSummaryLedgerFields(p);
          return `<tr><td>${escDoc(f.kind)}</td><td>${escDoc(f.amountLabel)}</td><td>${escDoc(f.dueDate)}</td><td>${escDoc(f.statusLabel)}</td><td>${escDoc(f.paidOn)}</td></tr>`;
        })
        .join('')
    : `<tr><td colspan="5">No payment schedule on file yet</td></tr>`;
  return `<h2>Payment schedule</h2>
  <table>
    <thead><tr><th>Type</th><th>Amount</th><th>Due</th><th>Status</th><th>Paid on</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Package total</span><span>${escDoc(formatCurrency(input.packageTotal))}</span></div>
    <div class="row"><span>Paid</span><span>${escDoc(formatCurrency(input.paidTotal))}</span></div>
    <div class="row strong"><span>Balance</span><span>${escDoc(formatCurrency(input.balanceDue))}</span></div>
  </div>`;
}


/** Public guest-portal payment row. Never includes payment-link token or other secrets. */
export type GuestPortalPayment = {
  id: string;
  eventId: string;
  kind: string;
  amount: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
};

const GUEST_PAYMENT_SECRET_KEYS = ['token'];

/** Pick ledger print fields only — strips token and other payment_links secrets. */
export function toPaymentSummaryLedgerRow(row: {
  kind: string;
  amount: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
}): PaymentSummaryLedgerRow {
  const out: PaymentSummaryLedgerRow = {
    kind: String(row.kind ?? ''),
    amount: typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : 0,
    status: String(row.status ?? ''),
  };
  if (typeof row.dueDate === 'string' && row.dueDate) out.dueDate = row.dueDate;
  if (typeof row.paidAt === 'string' && row.paidAt) out.paidAt = row.paidAt;
  return out;
}

/** Map a payment_links record onto the public guest snapshot shape (no token/secrets). */
export function guestSafePayment(row: {
  id: string;
  eventId: string;
  kind: string;
  amount: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}): GuestPortalPayment {
  const out: GuestPortalPayment = {
    id: String(row.id),
    eventId: String(row.eventId),
    kind: String(row.kind),
    amount: typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : 0,
    status: String(row.status),
    createdAt: String(row.createdAt ?? ''),
  };
  if (typeof row.dueDate === 'string' && row.dueDate) out.dueDate = row.dueDate;
  if (typeof row.paidAt === 'string' && row.paidAt) out.paidAt = row.paidAt;
  return out;
}

export function guestSafePayments(
  rows: Array<Parameters<typeof guestSafePayment>[0]>,
): GuestPortalPayment[] {
  return rows.map(guestSafePayment);
}

/** True when a serialized guest payment object still contains a payment-link secret. */
export function guestPaymentHasSecrets(row: object): boolean {
  const keys = Object.keys(row);
  if (keys.some(k => GUEST_PAYMENT_SECRET_KEYS.includes(k))) return true;
  const json = JSON.stringify(row);
  return /"token"\s*:/.test(json);
}

