import { dealOccupiesCalendar } from './holds.js';
import { parseEventTimeRange } from './spaceConflict.js';
import { resolveVenueStage, type VenueStage } from './stages.js';

export const PUBLIC_DAY_STATUSES = ['available', 'partial', 'hold', 'booked', 'closed'] as const;
export type PublicDayStatus = (typeof PUBLIC_DAY_STATUSES)[number];
export type PublicSlotName = 'morning' | 'evening';
export type PublicOccupancySlot = PublicSlotName | 'allDay';

export const PUBLIC_SLOT_SPLIT_MIN = 15 * 60;
export const PUBLIC_MORNING_START = '09:00';
export const PUBLIC_MORNING_END = '14:00';
export const PUBLIC_EVENING_START = '17:00';
export const PUBLIC_EVENING_END = '22:00';

export type PublicAvailabilityDay = {
  date: string;
  status: PublicDayStatus;
  morning: Exclude<PublicDayStatus, 'partial'>;
  evening: Exclude<PublicDayStatus, 'partial'>;
};

export type PublicAvailabilityRange = {
  startDate: string;
  endDate: string;
  days: PublicAvailabilityDay[];
};

/** Internal occupancy used only to project public status — never serialized. */
export type PublicOccupancySignal = {
  date: string;
  block: Exclude<PublicDayStatus, 'available' | 'partial'>;
  slot?: PublicOccupancySlot;
};

export const PUBLIC_AVAILABILITY_MAX_DAYS = 93;
export const AVAILABILITY_CHANGED_CODE = 'AVAILABILITY_CHANGED';
export const AVAILABILITY_CHANGED_MESSAGE =
  'That date changed while you were completing your request. Your event details have been preserved so you can choose another date.';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type SlotStatus = PublicAvailabilityDay['morning'];

const RANK: Record<SlotStatus, number> = {
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

export function mergePublicStatus(current: SlotStatus, next: SlotStatus): SlotStatus {
  return RANK[next] > RANK[current] ? next : current;
}

export function occupancySlotFromTimes(startTime?: string, endTime?: string): PublicOccupancySlot {
  const start = startTime?.trim() ?? '';
  const end = endTime?.trim() ?? '';
  if (!start && !end) return 'allDay';
  const range = parseEventTimeRange(start && end ? `${start} - ${end}` : start || end);
  if (range.allDay) return 'allDay';
  if (range.endMin <= PUBLIC_SLOT_SPLIT_MIN) return 'morning';
  if (range.startMin >= PUBLIC_SLOT_SPLIT_MIN) return 'evening';
  return 'allDay';
}

export function timesForPublicSlot(slot: PublicOccupancySlot): { startTime: string; endTime: string } {
  if (slot === 'morning') return { startTime: PUBLIC_MORNING_START, endTime: PUBLIC_MORNING_END };
  if (slot === 'evening') return { startTime: PUBLIC_EVENING_START, endTime: PUBLIC_EVENING_END };
  return { startTime: PUBLIC_MORNING_START, endTime: PUBLIC_EVENING_END };
}

export function summarizePublicDay(date: string, morning: SlotStatus, evening: SlotStatus): PublicAvailabilityDay {
  const morningOpen = morning === 'available';
  const eveningOpen = evening === 'available';
  let status: PublicDayStatus;
  if (morningOpen && eveningOpen) status = 'available';
  else if (morningOpen || eveningOpen || morning !== evening) status = 'partial';
  else status = morning;
  return { date, status, morning, evening };
}

export function isPublicWindowOpen(
  day: PublicAvailabilityDay | undefined,
  startTime?: string,
  endTime?: string,
): boolean {
  if (!day) return true;
  const slot = occupancySlotFromTimes(startTime, endTime);
  if (slot === 'morning' || slot === 'allDay') {
    if (day.morning !== 'available') return false;
  }
  if (slot === 'evening' || slot === 'allDay') {
    if (day.evening !== 'available') return false;
  }
  return true;
}

export function dayHasOpenSlot(day: PublicAvailabilityDay | undefined): boolean {
  if (!day) return true;
  return day.morning === 'available' || day.evening === 'available';
}

export function projectPublicDays(
  startDate: string,
  endDate: string,
  signals: readonly PublicOccupancySignal[],
): PublicAvailabilityDay[] {
  const byDate = new Map<string, { morning: SlotStatus; evening: SlotStatus }>();
  for (const signal of signals) {
    if (!isIsoDate(signal.date)) continue;
    const prev = byDate.get(signal.date) ?? { morning: 'available', evening: 'available' };
    const slot = signal.slot ?? 'allDay';
    if (slot === 'morning' || slot === 'allDay') {
      prev.morning = mergePublicStatus(prev.morning, signal.block);
    }
    if (slot === 'evening' || slot === 'allDay') {
      prev.evening = mergePublicStatus(prev.evening, signal.block);
    }
    byDate.set(signal.date, prev);
  }
  return enumerateIsoDates(startDate, endDate).map(date => {
    const slots = byDate.get(date) ?? { morning: 'available', evening: 'available' };
    return summarizePublicDay(date, slots.morning, slots.evening);
  });
}

export function toPublicAvailabilityDto(
  startDate: string,
  endDate: string,
  days: PublicAvailabilityDay[],
): PublicAvailabilityRange {
  return {
    startDate,
    endDate,
    days: days.map(day => ({
      date: day.date,
      status: day.status,
      morning: day.morning,
      evening: day.evening,
    })),
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
  if (isClosedBlock(deal.importMeta)) return { date, block: 'closed', slot: 'allDay' };
  if (!dealOccupiesCalendar(deal, nowMs)) return null;
  const slot = occupancySlotFromTimes(
    metaString(deal.importMeta, 'startTime') || metaString(deal.importMeta, 'eventTime'),
    metaString(deal.importMeta, 'endTime'),
  );

  if (deal.status === 'Won' || deal.status === 'In Build' || deal.status === 'Delivered') {
    return { date, block: 'booked', slot };
  }

  const stage = resolveVenueStage({
    dealStatus: deal.status,
    pvStatus: metaString(deal.importMeta, 'pvStatus') || null,
    balanceDue: typeof deal.importMeta?.balanceDue === 'number' ? deal.importMeta.balanceDue : null,
    amountPaid: typeof deal.importMeta?.amountPaid === 'number' ? deal.importMeta.amountPaid : null,
    grandTotal: typeof deal.importMeta?.grandTotal === 'number' ? deal.importMeta.grandTotal : null,
  });

  if (BOOKED_STAGES.has(stage)) return { date, block: 'booked', slot };
  if (HOLD_STAGES.has(stage)) return { date, block: 'hold', slot };
  return { date, block: 'hold', slot };
}

const PUBLIC_DAY_KEYS = new Set(['date', 'status', 'morning', 'evening']);

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
