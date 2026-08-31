/**
 * Client-side payment link ledger — works offline / demo / until Stripe webhooks land.
 * Survives reloads; optional sync into deal.importMeta via onPersist callback.
 */

export type PaymentLinkKind = 'deposit' | 'balance' | 'custom';

export type PaymentLinkRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  kind: PaymentLinkKind;
  amount: number;
  currency: string;
  status: 'created' | 'sent' | 'paid' | 'void' | 'expired';
  createdAt: string;
  paidAt?: string;
  note?: string;
  /** Simulated public token */
  token: string;
};

const STORAGE_KEY = 'hub-crm-payment-links';

function readAll(): PaymentLinkRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentLinkRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: PaymentLinkRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function token(): string {
  return `hub_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function listPaymentLinks(eventId?: string): PaymentLinkRecord[] {
  const all = readAll();
  if (!eventId) return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all
    .filter(r => r.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPaymentLink(input: {
  eventId: string;
  eventTitle: string;
  kind: PaymentLinkKind;
  amount: number;
  note?: string;
}): PaymentLinkRecord {
  const record: PaymentLinkRecord = {
    id: `plink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    eventId: input.eventId,
    eventTitle: input.eventTitle,
    kind: input.kind,
    amount: Math.max(0, Math.round(input.amount * 100) / 100),
    currency: 'USD',
    status: 'created',
    createdAt: new Date().toISOString(),
    note: input.note,
    token: token(),
  };
  const all = readAll();
  all.push(record);
  writeAll(all);
  return record;
}

export function markPaymentLinkSent(id: string): PaymentLinkRecord | null {
  const all = readAll();
  const i = all.findIndex(r => r.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i]!, status: 'sent' };
  writeAll(all);
  return all[i]!;
}

export function markPaymentLinkPaid(id: string): PaymentLinkRecord | null {
  const all = readAll();
  const i = all.findIndex(r => r.id === id);
  if (i < 0) return null;
  all[i] = {
    ...all[i]!,
    status: 'paid',
    paidAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[i]!;
}

export function voidPaymentLink(id: string): PaymentLinkRecord | null {
  const all = readAll();
  const i = all.findIndex(r => r.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i]!, status: 'void' };
  writeAll(all);
  return all[i]!;
}

export function paymentLinkUrl(record: PaymentLinkRecord): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/portal/login?event=${encodeURIComponent(record.eventId)}&pay=${encodeURIComponent(record.token)}`;
}

export function suggestedDeposit(grandTotal: number, percent = 0.25): number {
  if (!(grandTotal > 0)) return 0;
  return Math.round(grandTotal * percent * 100) / 100;
}

/** Build importMeta payment patch after simulate-paid */
export function paymentImportMetaPatch(input: {
  existingPaid: number;
  existingBalance: number | null;
  grandTotal: number;
  paymentAmount: number;
  paymentType: string;
}): {
  amountPaid: number;
  balanceDue: number;
  paymentEntry: {
    amount: number;
    paymentDate: string;
    method: string;
    paymentType: string;
  };
} {
  const amountPaid = Math.round((input.existingPaid + input.paymentAmount) * 100) / 100;
  const balanceDue = Math.max(
    0,
    Math.round(((input.grandTotal || amountPaid) - amountPaid) * 100) / 100,
  );
  return {
    amountPaid,
    balanceDue,
    paymentEntry: {
      amount: input.paymentAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
        method: 'Staff-recorded (not Stripe)',
      paymentType: input.paymentType,
    },
  };
}
