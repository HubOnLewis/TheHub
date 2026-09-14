import { resolveVenueStage, type VenueStage } from './stages.js';

export const PUBLIC_DAY_STATUSES = ['available', 'hold', 'booked', 'closed'] as const;
export type PublicDayStatus = (typeof PUBLIC_DAY_STATUSES)[number];

export type PublicAvailabilityDay = {
  date: string;
  status: PublicDayStatus;
};

export type PublicAvailabilityRange = {
  startDate: string;
  endDate: string;
  days: PublicAvailabilityDay[];
};

/** Internal occupancy used only to project public status — never serialized. */
export type PublicOccupancySignal = {
  date: string;
  block: Exclude<PublicDayStatus, 'available'>;
};

export const PUBLIC_AVAILABILITY_MAX_DAYS = 93;
export const AVAILABILITY_CHANGED_CODE = 'AVAILABILITY_CHANGED';
export const AVAILABILITY_CHANGED_MESSAGE =
  'That date changed while you were completing your request. Your event details have been preserved so you can choose another date.';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const RANK: Record<PublicDayStatus, number> = {
  available: 0,
  hold: 1,
  booked: 2,
  closed: 3,
};

const BOOKED_STAGES: ReadonlySet<VenueStage> = new Set(['deposit', 'confirmed', 'prep', 'completed']);
const HOLD_STAGES: ReadonlySet<VenueStage> = new Set(['inquiry', 'qualified', 'proposal']);

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

export function enumerateIsoDates(startDate: string, endDate: string): string[] {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) return [];
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  return enumerateIsoDates(startDate, endDate).length;
}

export function mergePublicStatus(current: PublicDayStatus, next: PublicDayStatus): PublicDayStatus {
  return RANK[next] > RANK[current] ? next : current;
}

export function projectPublicDays(
  startDate: string,
  endDate: string,
  signals: readonly PublicOccupancySignal[],
): PublicAvailabilityDay[] {
  const byDate = new Map<string, PublicDayStatus>();
  for (const signal of signals) {
    if (!isIsoDate(signal.date)) continue;
    const prev = byDate.get(signal.date) ?? 'available';
    byDate.set(signal.date, mergePublicStatus(prev, signal.block));
  }
  return enumerateIsoDates(startDate, endDate).map(date => ({
    date,
    status: byDate.get(date) ?? 'available',
  }));
}

export function toPublicAvailabilityDto(
  startDate: string,
  endDate: string,
  days: PublicAvailabilityDay[],
): PublicAvailabilityRange {
  return {
    startDate,
    endDate,
    days: days.map(day => ({ date: day.date, status: day.status })),
  };
}

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function eventDateFromMeta(meta: Record<string, unknown> | null | undefined): string {
  const raw = metaString(meta, 'eventDateIso') || metaString(meta, 'eventDate');
  return raw.slice(0, 10);
}

export function isCoworkingInventory(input: {
  unitId?: string | null;
  unitIds?: string[] | null;
  importMeta?: Record<string, unknown> | null;
}): boolean {
  const meta = input.importMeta ?? {};
  const inventory = metaString(meta, 'inventoryType') || metaString(meta, 'inventory');
  if (inventory === 'office' || inventory === 'coworking') return true;
  if (meta.coworking === true || meta.officeInventory === true) return true;
  const date = eventDateFromMeta(meta);
  const hasUnit = Boolean(input.unitId) || Boolean(input.unitIds && input.unitIds.length);
  return !date && hasUnit;
}

function isExpiredHold(meta: Record<string, unknown> | null | undefined, nowMs: number): boolean {
  const raw = metaString(meta, 'holdExpiresAt') || metaString(meta, 'holdExpires');
  if (!raw) return false;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) && ms <= nowMs;
}

function isClosedBlock(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  if (meta.blackout === true || meta.closed === true) return true;
  const block = metaString(meta, 'availabilityBlock').toLowerCase();
  return block === 'closed' || block === 'blackout';
}

export function occupancySignalFromDeal(
  deal: {
    status?: string | null;
    unitId?: string | null;
    unitIds?: string[] | null;
    importMeta?: Record<string, unknown> | null;
  },
  nowMs = Date.now(),
): PublicOccupancySignal | null {
  if (deal.status === 'Lost') return null;
  if (isCoworkingInventory(deal)) return null;
  const date = eventDateFromMeta(deal.importMeta);
  if (!isIsoDate(date)) return null;
  if (isExpiredHold(deal.importMeta, nowMs)) return null;
  if (isClosedBlock(deal.importMeta)) return { date, block: 'closed' };

  const stage = resolveVenueStage({
    dealStatus: deal.status,
    pvStatus: metaString(deal.importMeta, 'pvStatus') || null,
    balanceDue: typeof deal.importMeta?.balanceDue === 'number' ? deal.importMeta.balanceDue : null,
    amountPaid: typeof deal.importMeta?.amountPaid === 'number' ? deal.importMeta.amountPaid : null,
    grandTotal: typeof deal.importMeta?.grandTotal === 'number' ? deal.importMeta.grandTotal : null,
  });

  if (BOOKED_STAGES.has(stage)) return { date, block: 'booked' };
  if (HOLD_STAGES.has(stage)) return { date, block: 'hold' };
  return { date, block: 'hold' };
}

const PUBLIC_DAY_KEYS = new Set(['date', 'status']);

export function publicAvailabilityLeaksInternal(payload: unknown): string[] {
  const leaks: string[] = [];
  const forbidden = [
    '_id',
    'leadId',
    'dealId',
    'eventId',
    'contactId',
    'companyId',
    'email',
    'phone',
    'notes',
    'title',
    'contact',
    'assignedTo',
    'importMeta',
  ];
  const asText = JSON.stringify(payload ?? '');
  for (const key of forbidden) {
    if (new RegExp(`"${key}"\\s*:`).test(asText)) leaks.push(key);
  }
  if (payload && typeof payload === 'object' && payload !== null && 'days' in payload) {
    const days = (payload as { days?: unknown }).days;
    if (Array.isArray(days)) {
      for (const day of days) {
        if (!day || typeof day !== 'object') continue;
        for (const key of Object.keys(day as object)) {
          if (!PUBLIC_DAY_KEYS.has(key)) leaks.push(key);
        }
      }
    }
  }
  return [...new Set(leaks)];
}
