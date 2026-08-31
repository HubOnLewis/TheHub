/**
 * Venue calendar engine — week/day grids, space lanes, conflict detection.
 */

import type { CrmEventRow } from '../lib/crmEvents.js';
import { getEventDate } from '../lib/liveEventHelpers.js';
import {
  detectSpaceConflicts,
  findHardConflictsForProposal,
  isAssignedSpace,
  normalizeVenueSpace,
  parseEventTimeRange as parseRangeShared,
  parseTimeToMinutes as parseTimeShared,
  type OccupancySlot,
  type SpaceConflict as SharedSpaceConflict,
} from '@hub-crm/shared';

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
  startMin: number;
  endMin: number;
  dateKey: string;
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

const DEFAULT_START = 9 * 60;
const DEFAULT_END = 17 * 60;
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

export const parseTimeToMinutes = parseTimeShared;
export const parseEventTimeRange = parseRangeShared;
export const normalizeSpace = normalizeVenueSpace;
export { isAssignedSpace };

export function formatMinutes(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(mm)} ${ap}`;
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

function toSlot(block: CalendarBlock): OccupancySlot {
  return {
    id: block.id,
    title: block.title,
    dateKey: block.dateKey,
    startMin: block.startMin,
    endMin: block.endMin,
    space: block.space,
    status: block.row.pvStatus || block.row.status,
  };
}

function hydrateConflict(c: SharedSpaceConflict, byId: Map<string, CalendarBlock>): CalendarConflict | null {
  const eventA = byId.get(c.eventA.id);
  const eventB = byId.get(c.eventB.id);
  if (!eventA || !eventB) return null;
  return { ...c, eventA, eventB };
}

export function detectConflicts(blocks: CalendarBlock[]): CalendarConflict[] {
  const byId = new Map(blocks.map(b => [b.id, b]));
  return detectSpaceConflicts(blocks.map(toSlot))
    .map(c => hydrateConflict(c, byId))
    .filter((c): c is CalendarConflict => c != null);
}

export function conflictIdsForBlock(blockId: string, conflicts: CalendarConflict[]): Set<string> {
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
  return [
    ...preferred.filter(s => set.has(s) || s === 'Main Hall' || s === 'Gallery' || s === 'Patio'),
    ...extras.filter(s => !preferred.includes(s)),
  ];
}

export function hourSlots(fromHour = 8, toHour = 24): number[] {
  const slots: number[] = [];
  for (let h = fromHour; h < toHour; h++) slots.push(h * 60);
  return slots;
}

export { DAY_START, DAY_END, DEFAULT_START, DEFAULT_END };

export function findConflictsForProposal(input: {
  dateKey: string;
  startMin: number;
  endMin: number;
  space: string;
  excludeId?: string;
  blocks: CalendarBlock[];
}): CalendarConflict[] {
  const hard = findHardConflictsForProposal({
    dateKey: input.dateKey,
    startMin: input.startMin,
    endMin: input.endMin,
    space: input.space,
    excludeId: input.excludeId,
    slots: input.blocks.map(toSlot),
  });
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
  const byId = new Map(input.blocks.map(b => [b.id, b]));
  byId.set(proposed.id, proposed);
  return hard.map(c => hydrateConflict(c, byId)).filter((c): c is CalendarConflict => c != null);
}