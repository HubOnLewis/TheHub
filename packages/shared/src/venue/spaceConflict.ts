/**
 * Venue space occupancy + hard overlap rules.
 * Shared by Hub API (block saves) and web calendar.
 */

export type OccupancySlot = {
  id: string;
  title: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  space: string;
  status?: string | null;
};

export type SpaceConflict = {
  id: string;
  space: string;
  dateKey: string;
  eventA: OccupancySlot;
  eventB: OccupancySlot;
  reason: string;
  severity: 'hard' | 'soft';
};

const DEFAULT_START = 9 * 60;
const DEFAULT_END = 17 * 60;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseTimeToMinutes(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
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

export function parseEventTimeRange(eventTime: string | null | undefined): {
  startMin: number;
  endMin: number;
  allDay: boolean;
} {
  if (!eventTime?.trim()) {
    return { startMin: DEFAULT_START, endMin: DEFAULT_END, allDay: true };
  }
  const cleaned = eventTime.replace(/next day/gi, '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/\s*[-–—]\s*/);
  const startMin = parseTimeToMinutes(parts[0]) ?? DEFAULT_START;
  let endMin = parseTimeToMinutes(parts[1]) ?? startMin + 4 * 60;
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin, allDay: false };
}

export function normalizeVenueSpace(space: string | null | undefined): string {
  const s = (space ?? '').trim();
  if (!s || s === '—' || s.toLowerCase() === 'tbd' || s.toLowerCase() === 'not captured yet') {
    return 'TBD';
  }
  if (/full\s*venue/i.test(s)) return 'Full venue';
  return s.split(',')[0]!.trim() || 'TBD';
}

export function isAssignedSpace(space: string | null | undefined): boolean {
  const n = normalizeVenueSpace(space);
  return n !== 'TBD' && n.length > 0;
}

export function timesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function spacesHardConflict(a: string, b: string): boolean {
  const na = normalizeVenueSpace(a);
  const nb = normalizeVenueSpace(b);
  if (na === 'TBD' || nb === 'TBD') return false;
  if (na === 'Full venue' || nb === 'Full venue') return true;
  return na.toLowerCase() === nb.toLowerCase();
}

function isLostStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'lost' || s === 'cancelled' || s === 'canceled';
}

export function detectSpaceConflicts(
  slots: OccupancySlot[],
  opts?: { includeLost?: boolean },
): SpaceConflict[] {
  const includeLost = opts?.includeLost === true;
  const active = includeLost ? slots : slots.filter(s => !isLostStatus(s.status));
  const conflicts: SpaceConflict[] = [];
  const byDate = new Map<string, OccupancySlot[]>();
  for (const b of active) {
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
        const hard = spacesHardConflict(a.space, b.space);
        const aTbd = normalizeVenueSpace(a.space) === 'TBD';
        const bTbd = normalizeVenueSpace(b.space) === 'TBD';
        if (hard) {
          const spaceLabel =
            normalizeVenueSpace(a.space) === 'Full venue' || normalizeVenueSpace(b.space) === 'Full venue'
              ? 'Full venue'
              : normalizeVenueSpace(a.space);
          conflicts.push({
            id: `hard-${a.id}-${b.id}`,
            space: spaceLabel,
            dateKey,
            eventA: a,
            eventB: b,
            reason:
              spaceLabel === 'Full venue'
                ? `Full venue booking overlaps another event (${a.title} <-> ${b.title})`
                : `${spaceLabel} double-booked: "${a.title}" and "${b.title}"`,
            severity: 'hard',
          });
        } else if (aTbd || bTbd) {
          conflicts.push({
            id: `soft-${a.id}-${b.id}`,
            space: aTbd ? normalizeVenueSpace(b.space) : normalizeVenueSpace(a.space),
            dateKey,
            eventA: a,
            eventB: b,
            reason: 'Overlapping times with unassigned space (TBD)',
            severity: 'soft',
          });
        }
      }
    }
  }
  return conflicts;
}

export function findHardConflictsForProposal(input: {
  dateKey: string;
  startMin: number;
  endMin: number;
  space: string;
  excludeId?: string;
  slots: OccupancySlot[];
}): SpaceConflict[] {
  const proposed: OccupancySlot = {
    id: input.excludeId ?? '__proposed__',
    title: 'New event',
    dateKey: input.dateKey,
    startMin: input.startMin,
    endMin: input.endMin,
    space: normalizeVenueSpace(input.space),
    status: 'Draft',
  };
  const others = input.slots.filter(
    b => b.dateKey === input.dateKey && b.id !== input.excludeId,
  );
  return detectSpaceConflicts([...others, proposed]).filter(
    c => c.severity === 'hard' && (c.eventA.id === proposed.id || c.eventB.id === proposed.id),
  );
}

const SPACE_KEYS = [
  'Space',
  'Spaces',
  'Selected Spaces',
  'Selected Space',
  'Room',
  'Rooms',
  'Venue Space',
  'Event Space',
  'space',
  'spaces',
];

/** First non-empty space-like field from a PV export row or importMeta. */
export function pickSpaceFromRecord(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  for (const key of SPACE_KEYS) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() && v.trim() !== '\u2014') return v.trim();
    if (Array.isArray(v)) {
      const joined = v.map(x => String(x ?? '').trim()).filter(Boolean).join(', ');
      if (joined) return joined;
    }
  }
  return '';
}

export function occupancyFromImportMeta(input: {
  id: string;
  title: string;
  status?: string | null;
  importMeta?: Record<string, unknown> | null;
}): OccupancySlot | null {
  const meta = input.importMeta ?? {};
  const dateRaw =
    (typeof meta.eventDateIso === 'string' && meta.eventDateIso) ||
    (typeof meta.eventDate === 'string' && meta.eventDate) ||
    '';
  if (!dateRaw) return null;
  const dateKey = dateRaw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const startTime = typeof meta.startTime === 'string' ? meta.startTime : '';
  const endTime = typeof meta.endTime === 'string' ? meta.endTime : '';
  const range = parseEventTimeRange(
    startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime,
  );
  return {
    id: input.id,
    title: input.title || 'Event',
    dateKey,
    startMin: range.startMin,
    endMin: range.endMin,
    space: normalizeVenueSpace(pickSpaceFromRecord(meta) || (typeof meta.space === 'string' ? meta.space : '')),
    status: input.status ?? null,
  };
}

export function requiredSpaceError(space: string | null | undefined, hasDate: boolean): string | null {
  if (!hasDate) return null;
  if (!isAssignedSpace(space)) {
    return 'Space is required for dated events. Pick a room (TBD is not allowed).';
  }
  return null;
}