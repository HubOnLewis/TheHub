/**
 * In-memory deals for screenshot / offline walkthrough mode.
 * Lets operator create → open → advance → complete a booking without Mongo.
 */

export type ScreenshotDeal = {
  _id: string;
  tenantId: string;
  title: string;
  company: string;
  companyId?: string;
  contact: string;
  amount: number;
  status: string;
  assignedTo?: string;
  ownerUserId?: string;
  notes?: string;
  importMeta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastTouchedAt?: string;
  lastStageChangeAt?: string;
};

const KEY = 'hub-crm-screenshot-deals';

function read(): ScreenshotDeal[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScreenshotDeal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(deals: ScreenshotDeal[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(deals));
}

function id(): string {
  return `ss-deal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listScreenshotDeals(): ScreenshotDeal[] {
  return read().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getScreenshotDeal(dealId: string): ScreenshotDeal | undefined {
  return read().find(d => d._id === dealId);
}

export function createScreenshotDeal(input: {
  title: string;
  company: string;
  contact: string;
  amount?: number;
  assignedTo?: string;
  notes?: string;
  status?: string;
  importMeta?: Record<string, unknown>;
  ownerUserId?: string;
}): ScreenshotDeal {
  const now = new Date().toISOString();
  const amount = Number(input.amount) || 0;
  const importMeta = { ...(input.importMeta ?? {}) };
  if (typeof importMeta.grandTotal !== 'number') importMeta.grandTotal = amount;
  if (typeof importMeta.amountPaid !== 'number') importMeta.amountPaid = 0;
  if (typeof importMeta.balanceDue !== 'number') {
    importMeta.balanceDue = Math.max(0, Number(importMeta.grandTotal) - Number(importMeta.amountPaid));
  }
  if (!importMeta.pvStatus) importMeta.pvStatus = 'lead';

  const deal: ScreenshotDeal = {
    _id: id(),
    tenantId: 'hub-wichita',
    title: input.title.trim(),
    company: input.company.trim(),
    companyId: `ss-co-${Date.now().toString(36)}`,
    contact: input.contact.trim(),
    amount,
    status: input.status || 'Draft',
    assignedTo: input.assignedTo || 'Jason Lavender',
    ownerUserId: input.ownerUserId,
    notes: input.notes,
    importMeta,
    createdAt: now,
    updatedAt: now,
    lastTouchedAt: now,
    lastStageChangeAt: now,
  };
  const all = read();
  all.unshift(deal);
  write(all);
  return deal;
}

export function updateScreenshotDeal(
  dealId: string,
  patch: Partial<ScreenshotDeal> & { importMeta?: Record<string, unknown> },
): ScreenshotDeal | null {
  const all = read();
  const idx = all.findIndex(d => d._id === dealId);
  if (idx < 0) return null;
  const before = all[idx]!;
  const now = new Date().toISOString();
  const importMeta =
    patch.importMeta && typeof patch.importMeta === 'object'
      ? { ...(before.importMeta ?? {}), ...patch.importMeta }
      : before.importMeta;
  const next: ScreenshotDeal = {
    ...before,
    ...patch,
    _id: before._id,
    importMeta,
    updatedAt: now,
    lastTouchedAt: now,
    lastStageChangeAt:
      patch.status && patch.status !== before.status ? now : before.lastStageChangeAt,
  };
  if (patch.amount != null && importMeta && typeof importMeta.grandTotal !== 'number') {
    next.importMeta = { ...importMeta, grandTotal: patch.amount };
  }
  all[idx] = next;
  write(all);
  return next;
}

export function deleteScreenshotDeal(dealId: string): boolean {
  const all = read();
  const next = all.filter(d => d._id !== dealId);
  if (next.length === all.length) return false;
  write(next);
  return true;
}

export function clearScreenshotDeals(): void {
  write([]);
}
