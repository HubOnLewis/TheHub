import type { PublicAvailabilityDay, PublicDayStatus, PublicOccupancySlot } from '@hub-crm/shared';

export type CalendarCell = {
  date: string | null;
  inMonth: boolean;
  status?: PublicDayStatus;
};

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatBookDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatClock(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function buildMonthCells(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push({ date: null, inMonth: false });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    cells.push({ date: `${year}-${mm}-${dd}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, inMonth: false });
  return cells;
}

export function statusLabel(status: PublicDayStatus): string {
  if (status === 'available') return 'Open';
  if (status === 'partial') return 'Partial';
  if (status === 'hold') return 'Hold';
  if (status === 'booked') return 'Booked';
  return 'Closed';
}

export function slotStatusLabel(status: PublicAvailabilityDay['morning']): string {
  if (status === 'available') return 'Open';
  if (status === 'hold') return 'Hold';
  if (status === 'booked') return 'Booked';
  return 'Closed';
}

export function normalizePublicDay(raw: {
  date: string;
  status: PublicDayStatus;
  morning?: PublicAvailabilityDay['morning'];
  evening?: PublicAvailabilityDay['evening'];
}): PublicAvailabilityDay {
  if (raw.morning && raw.evening) {
    return { date: raw.date, status: raw.status, morning: raw.morning, evening: raw.evening };
  }
  if (raw.status === 'available' || raw.status === 'partial') {
    return { date: raw.date, status: raw.status, morning: 'available', evening: 'available' };
  }
  const blocked = raw.status;
  return { date: raw.date, status: blocked, morning: blocked, evening: blocked };
}

export function preferredSlot(day: PublicAvailabilityDay): PublicOccupancySlot | '' {
  const morning = day.morning === 'available';
  const evening = day.evening === 'available';
  if (morning && evening) return 'evening';
  if (morning) return 'morning';
  if (evening) return 'evening';
  return '';
}

export function dayAriaLabel(date: string, day: PublicAvailabilityDay, past: boolean, selectable: boolean): string {
  if (past) return `${date}, past date, unavailable`;
  return `${date}, morning ${slotStatusLabel(day.morning)}, evening ${slotStatusLabel(day.evening)}${
    selectable ? ', select this date' : ', unavailable'
  }`;
}
