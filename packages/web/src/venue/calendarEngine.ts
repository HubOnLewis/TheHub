/**
 * Venue calendar engine — week/day grids, space lanes, conflict detection.
 */

import type { CrmEventRow } from '../lib/crmEvents.js';
import { getEventDate } from '../lib/liveEventHelpers.js';

export type CalendarViewMode = 'week' | 'day' | 'month';

export type CalendarBlock = {
  id: string;
  title: string;
  contact: string;
  space: string;
  href: string;
  statusLabel: string;
  value: number;
  balanceDue: number;
  /** Minutes from midnight local */
  startMin: number;
  endMin: number;
  dateKey: string; // YYYY-MM-DD
  allDay: boolean;
  guests: number;
  owner: string;
  row: CrmEventRow;
};

export type CalendarConflict = {
  id: string;
  space: string;
  dateKey: string;
  eventA: CalendarBlock;
  eventB: CalendarBlock;
  reason: string;
  severity: 'hard' | 'soft';
};

const DEFAULT_START = 9 * 60; // 9:00
const DEFAULT_END = 17 * 60; // 17:00
const DAY_START = 8 * 60;
const DAY_END = 24 * 60;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y!, m! - 1, day!, 12, 0, 0, 0);
}

export function startOfWeek(ref: Date, weekStartsOn = 0): Date {
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function weekDateKeys(anchor: Date): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

/** Parse "5:00 PM", "17:00", "5pm", "9:00am - 12:00am next day" fragments */
export function parseTimeToMinutes(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  // 24h
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const m = Number(m24[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
  }
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = Number(m12[1]);
    const m = Number(m12[2] ?? 0);
    const ap = m12[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }
  return null;
}

export function parseEventTimeRange(eventTime: string): { startMin: number; endMin: number; allDay: boolean } {
  if (!eventTime?.trim()) {
    return { startMin: DEFAULT_START, endMin: DEFAULT_END, allDay: true };
  }
  const cleaned = eventTime
    .replace(/next day/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned.split(/\s*[-–—]\s*/);
  const startMin = parseTimeToMinutes(parts[0]) ?? DEFAULT_START;
  let endMin = parseTimeToMinutes(parts[1]) ?? startMin + 4 * 60;
  // Overnight: end before start → push to next calendar day logic handled by end > 24h
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin, allDay: false };
}

export function formatMinutes(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(mm)} ${ap}`;
}

export function normalizeSpace(space: string | null | undefined): string {
  const s = (space ?? '').trim();
  if (!s || s === '—' || s.toLowerCase() === 'tbd') return 'TBD';
  // Full venue conflicts with every space
  if (/full\s*venue/i.test(s)) return 'Full venue';
  // Take first space if comma list
  return s.split(',')[0]!.trim() || 'TBD';
}

export function rowsToCalendarBlocks(rows: CrmEventRow[]): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  for (const row of rows) {
    const d = getEventDate(row);
    if (!d) continue;
    const dateKey = toDateKey(d);
    const { startMin, endMin, allDay } = parseEventTimeRange(row.eventTime);
    blocks.push({
      id: row.id,
      title: row.title,
      contact: row.contact,
      space: normalizeSpace(row.space),
      href: row.href,
      statusLabel: row.statusLabel,
      value: row.value,
      balanceDue: row.balanceDue ?? 0,
      startMin,
      endMin,
      dateKey,
      allDay,
      guests: row.guests,
      owner: row.owner,
      row,
    });
  }
  return blocks.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startMin - b.startMin);
}

function timesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function spacesConflict(a: string, b: string): boolean {
  if (a === 'Full venue' || b === 'Full venue') return true;
  if (a === 'TBD' || b === 'TBD') return false; // soft only later
  return a.toLowerCase() === b.toLowerCase();
}

export function detectConflicts(blocks: CalendarBlock[]): CalendarConflict[] {
  const conflicts: CalendarConflict[] = [];
  const byDate = new Map<string, CalendarBlock[]>();
  for (const b of blocks) {
    const arr = byDate.get(b.dateKey) ?? [];
    arr.push(b);
    byDate.set(b.dateKey, arr);
  }

  for (const [dateKey, list] of byDate) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (!timesOverlap(a.startMin, a.endMin, b.startMin, b.endMin)) continue;
        const hard = spacesConflict(a.space, b.space);
        if (!hard && a.space !== 'TBD' && b.space !== 'TBD') continue;
        if (!hard && !(a.space === 'TBD' || b.space === 'TBD')) continue;
        // TBD vs assigned same day overlapping → soft
        const isTbdSoft =
          (a.space === 'TBD' || b.space === 'TBD') &&
          !spacesConflict(
            a.space === 'TBD' ? '__' : a.space,
            b.space === 'TBD' ? '__' : b.space,
          );
        if (isTbdSoft || (a.space === 'TBD' && b.space === 'TBD')) {
          conflicts.push({
            id: `soft-${a.id}-${b.id}`,
            space: a.space === 'TBD' ? b.space : a.space,
            dateKey,
            eventA: a,
            eventB: b,
            reason: 'Overlapping times with unassigned space (TBD)',
            severity: 'soft',
          });
          continue;
        }
        if (hard) {
          const spaceLabel =
            a.space === 'Full venue' || b.space === 'Full venue'
              ? 'Full venue'
              : a.space;
          conflicts.push({
            id: `hard-${a.id}-${b.id}`,
            space: spaceLabel,
            dateKey,
            eventA: a,
            eventB: b,
            reason:
              spaceLabel === 'Full venue'
                ? `Full venue booking overlaps another event (${a.title} ↔ ${b.title})`
                : `${spaceLabel} double-booked: “${a.title}” and “${b.title}”`,
            severity: 'hard',
          });
        }
      }
    }
  }
  return conflicts;
}

export function conflictIdsForBlock(
  blockId: string,
  conflicts: CalendarConflict[],
): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    if (c.eventA.id === blockId || c.eventB.id === blockId) set.add(c.id);
  }
  return set;
}

export function blocksForDate(blocks: CalendarBlock[], dateKey: string): CalendarBlock[] {
  return blocks.filter(b => b.dateKey === dateKey);
}

export function uniqueSpaces(blocks: CalendarBlock[]): string[] {
  const set = new Set<string>();
  for (const b of blocks) set.add(b.space || 'TBD');
  const preferred = ['Main Hall', 'Gallery', 'Patio', 'Lobby', 'Full venue', 'TBD'];
  const extras = [...set].filter(s => !preferred.includes(s)).sort();
  return [...preferred.filter(s => set.has(s) || s === 'Main Hall' || s === 'Gallery' || s === 'Patio'), ...extras.filter(s => !preferred.includes(s))];
}

export function hourSlots(fromHour = 8, toHour = 24): number[] {
  const slots: number[] = [];
  for (let h = fromHour; h < toHour; h++) slots.push(h * 60);
  return slots;
}

export { DAY_START, DAY_END, DEFAULT_START, DEFAULT_END };

/** Check proposed booking against existing blocks */
export function findConflictsForProposal(input: {
  dateKey: string;
  startMin: number;
  endMin: number;
  space: string;
  excludeId?: string;
  blocks: CalendarBlock[];
}): CalendarConflict[] {
  const proposed: CalendarBlock = {
    id: input.excludeId ?? '__proposed__',
    title: 'New event',
    contact: '',
    space: normalizeSpace(input.space),
    href: '#',
    statusLabel: 'Draft',
    value: 0,
    balanceDue: 0,
    startMin: input.startMin,
    endMin: input.endMin,
    dateKey: input.dateKey,
    allDay: false,
    guests: 0,
    owner: '',
    row: {} as CrmEventRow,
  };
  const others = input.blocks.filter(
    b => b.dateKey === input.dateKey && b.id !== input.excludeId,
  );
  return detectConflicts([...others, proposed]).filter(
    c => c.eventA.id === proposed.id || c.eventB.id === proposed.id,
  );
}
