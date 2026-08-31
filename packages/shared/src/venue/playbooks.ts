/**
 * Event-type playbooks — task list, payment schedule, documents, client timeline.
 * Dates are keyed off the event date using Hub contract terms when present.
 */

export const EVENT_TYPES = [
  'wedding',
  'corporate',
  'social',
  'nonprofit',
  'private',
  'other',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: 'Wedding',
  corporate: 'Corporate',
  social: 'Social / celebration',
  nonprofit: 'Nonprofit / gala',
  private: 'Private event',
  other: 'Other',
};

/** HuB on Lewis default contract windows. Override via importMeta.contractTerms. */
export type HubContractTerms = {
  depositPercent: number;
  depositDueDaysAfterSigned: number;
  finalCountDaysBeforeEvent: number;
  balanceDaysBeforeEvent: number;
  alcoholDocsDaysBeforeEvent: number;
};

export const DEFAULT_HUB_CONTRACT_TERMS: HubContractTerms = {
  depositPercent: 0.25,
  depositDueDaysAfterSigned: 0,
  finalCountDaysBeforeEvent: 14,
  balanceDaysBeforeEvent: 14,
  alcoholDocsDaysBeforeEvent: 21,
};

export type PlaybookTask = {
  id: string;
  label: string;
  owner: 'coordinator' | 'ops' | 'client';
  dueDate: string | null;
  dueLabel: string;
  status: 'open' | 'done';
};

export type PlaybookPayment = {
  id: string;
  kind: 'deposit' | 'balance';
  label: string;
  percent: number;
  dueDate: string | null;
  dueLabel: string;
};

export type PlaybookDocument = {
  key: string;
  label: string;
  audience: 'guest' | 'staff';
  required: boolean;
};

export type PlaybookTimelineStep = {
  id: string;
  label: string;
  dueDate: string | null;
  dueLabel: string;
  owner: 'client' | 'venue';
};

export type AppliedPlaybook = {
  eventType: EventType;
  eventTypeLabel: string;
  appliedAt: string;
  terms: HubContractTerms;
  tasks: PlaybookTask[];
  paymentSchedule: PlaybookPayment[];
  documents: PlaybookDocument[];
  clientTimeline: PlaybookTimelineStep[];
};

const TYPE_ALIASES: Record<string, EventType> = {
  wedding: 'wedding',
  weddings: 'wedding',
  ceremony: 'wedding',
  reception: 'wedding',
  corporate: 'corporate',
  company: 'corporate',
  business: 'corporate',
  meeting: 'corporate',
  conference: 'corporate',
  social: 'social',
  celebration: 'social',
  birthday: 'social',
  shower: 'social',
  'baby shower': 'social',
  party: 'social',
  nonprofit: 'nonprofit',
  gala: 'nonprofit',
  fundraiser: 'nonprofit',
  charity: 'nonprofit',
  private: 'private',
  other: 'other',
};

export function resolveEventType(raw: unknown): EventType {
  if (typeof raw !== 'string' || !raw.trim()) return 'other';
  const key = raw.trim().toLowerCase();
  if ((EVENT_TYPES as readonly string[]).includes(key)) return key as EventType;
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key]!;
  for (const [alias, type] of Object.entries(TYPE_ALIASES)) {
    if (key.includes(alias)) return type;
  }
  return 'other';
}

function num(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export function resolveContractTerms(meta: Record<string, unknown> | null | undefined): HubContractTerms {
  const raw =
    meta && typeof meta.contractTerms === 'object' && meta.contractTerms
      ? (meta.contractTerms as Record<string, unknown>)
      : {};
  const playbook =
    meta && typeof meta.playbook === 'object' && meta.playbook
      ? (meta.playbook as Record<string, unknown>)
      : {};
  const fromPlaybook =
    playbook.terms && typeof playbook.terms === 'object'
      ? (playbook.terms as Record<string, unknown>)
      : {};
  const src = { ...fromPlaybook, ...raw };
  const depositPercent = num(src.depositPercent, DEFAULT_HUB_CONTRACT_TERMS.depositPercent);
  return {
    depositPercent: depositPercent > 1 ? depositPercent / 100 : depositPercent,
    depositDueDaysAfterSigned: Math.max(
      0,
      Math.round(num(src.depositDueDaysAfterSigned, DEFAULT_HUB_CONTRACT_TERMS.depositDueDaysAfterSigned)),
    ),
    finalCountDaysBeforeEvent: Math.max(
      0,
      Math.round(num(src.finalCountDaysBeforeEvent, DEFAULT_HUB_CONTRACT_TERMS.finalCountDaysBeforeEvent)),
    ),
    balanceDaysBeforeEvent: Math.max(
      0,
      Math.round(num(src.balanceDaysBeforeEvent, DEFAULT_HUB_CONTRACT_TERMS.balanceDaysBeforeEvent)),
    ),
    alcoholDocsDaysBeforeEvent: Math.max(
      0,
      Math.round(num(src.alcoholDocsDaysBeforeEvent, DEFAULT_HUB_CONTRACT_TERMS.alcoholDocsDaysBeforeEvent)),
    ),
  };
}

export function shiftDateOnly(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null;
  const key = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dueLabel(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function needsAlcoholDocs(type: EventType): boolean {
  return type === 'wedding' || type === 'social' || type === 'private' || type === 'nonprofit';
}

function task(
  id: string,
  label: string,
  owner: PlaybookTask['owner'],
  dueDate: string | null,
  fallback: string,
): PlaybookTask {
  return { id, label, owner, dueDate, dueLabel: dueLabel(dueDate, fallback), status: 'open' };
}

function timeline(
  id: string,
  label: string,
  owner: PlaybookTimelineStep['owner'],
  dueDate: string | null,
  fallback: string,
): PlaybookTimelineStep {
  return { id, label, owner, dueDate, dueLabel: dueLabel(dueDate, fallback) };
}

function documentsFor(type: EventType): PlaybookDocument[] {
  const base: PlaybookDocument[] = [
    { key: 'agreement', label: 'Agreement / contract', audience: 'guest', required: true },
    { key: 'beo', label: 'Guest event details / BEO', audience: 'guest', required: true },
    { key: 'staffBeo', label: 'Staff BEO', audience: 'staff', required: true },
    { key: 'invoice', label: 'Payment summary', audience: 'guest', required: true },
  ];
  if (type === 'wedding' || type === 'social' || type === 'private') {
    base.push({ key: 'floorPlan', label: 'Floor plan / layout', audience: 'staff', required: true });
    base.push({ key: 'menu', label: 'Menu', audience: 'guest', required: false });
  }
  if (needsAlcoholDocs(type)) {
    base.push({ key: 'alcoholDocs', label: 'Alcohol / liquor liability docs', audience: 'staff', required: true });
  }
  if (type === 'corporate' || type === 'nonprofit') {
    base.push({ key: 'avRider', label: 'AV / tech rider', audience: 'staff', required: true });
    base.push({ key: 'eventSummary', label: 'Event summary', audience: 'guest', required: true });
  }
  if (type === 'wedding') {
    base.push({ key: 'vendorRoster', label: 'Vendor roster', audience: 'staff', required: true });
  }
  return base;
}

function tasksFor(
  type: EventType,
  eventDate: string | null,
  terms: HubContractTerms,
  depositDue: string | null,
  finalCountDue: string | null,
  balanceDue: string | null,
  alcoholDue: string | null,
): PlaybookTask[] {
  const dayOf = eventDate;
  const weekBefore = shiftDateOnly(eventDate, -7);
  const twoDays = shiftDateOnly(eventDate, -2);
  const shared: PlaybookTask[] = [
    task('task-agreement', 'Send / confirm signed agreement', 'coordinator', depositDue, 'On booking'),
    task('task-deposit', 'Collect deposit to hold the date', 'coordinator', depositDue, 'On booking'),
    task('task-final-count', 'Confirm final guest count', 'client', finalCountDue, `${terms.finalCountDaysBeforeEvent} days before event`),
    task('task-balance', 'Collect final balance', 'coordinator', balanceDue, `${terms.balanceDaysBeforeEvent} days before event`),
    task('task-beo-brief', 'Day-of BEO staff brief', 'ops', twoDays, '2 days before event'),
  ];

  if (type === 'wedding') {
    return [
      ...shared,
      task('task-alcohol', 'Collect alcohol / liquor liability docs', 'client', alcoholDue, `${terms.alcoholDocsDaysBeforeEvent} days before event`),
      task('task-layout', 'Confirm ceremony + reception layout', 'client', finalCountDue, 'With final count'),
      task('task-vendors', 'Confirm vendor roster and load-in', 'ops', weekBefore, '7 days before event'),
      task('task-music', 'Confirm music cutoff and DJ / band window', 'client', weekBefore, '7 days before event'),
      task('task-day-of', 'Day-of run of show', 'ops', dayOf, 'Event date'),
    ];
  }
  if (type === 'corporate' || type === 'nonprofit') {
    return [
      ...shared,
      task('task-av', 'Confirm AV / tech rider', 'ops', finalCountDue, 'With final count'),
      task('task-branding', 'Confirm branding / signage needs', 'client', weekBefore, '7 days before event'),
      task('task-fb', 'Confirm F&B guarantee', 'coordinator', finalCountDue, 'With final count'),
      task('task-day-of', 'Day-of run of show', 'ops', dayOf, 'Event date'),
    ];
  }
  if (type === 'social' || type === 'private') {
    return [
      ...shared,
      task('task-alcohol', 'Collect alcohol docs if bar is hosted', 'client', alcoholDue, `${terms.alcoholDocsDaysBeforeEvent} days before event`),
      task('task-layout', 'Confirm room layout', 'client', finalCountDue, 'With final count'),
      task('task-music', 'Confirm music cutoff', 'client', weekBefore, '7 days before event'),
      task('task-day-of', 'Day-of run of show', 'ops', dayOf, 'Event date'),
    ];
  }
  return [
    ...shared,
    task('task-layout', 'Confirm room layout', 'client', finalCountDue, 'With final count'),
    task('task-day-of', 'Day-of run of show', 'ops', dayOf, 'Event date'),
  ];
}

export type ApplyPlaybookInput = {
  eventType?: unknown;
  eventDateIso?: string | null;
  grandTotal?: number | null;
  existingMeta?: Record<string, unknown> | null;
  now?: Date;
};

export type ApplyPlaybookResult = {
  playbook: AppliedPlaybook;
  importMetaPatch: Record<string, unknown>;
};

/**
 * Pure playbook apply. Writes a complete `playbook` object plus eventType onto importMeta.
 * Does not replace existing clientDetails, payments already recorded, or portal tokens.
 */
export function applyEventPlaybook(input: ApplyPlaybookInput): ApplyPlaybookResult {
  const type = resolveEventType(input.eventType ?? input.existingMeta?.eventType);
  const terms = resolveContractTerms(input.existingMeta ?? null);
  const eventDate =
    (typeof input.eventDateIso === 'string' && input.eventDateIso) ||
    (typeof input.existingMeta?.eventDateIso === 'string' && input.existingMeta.eventDateIso) ||
    (typeof input.existingMeta?.eventDate === 'string' && input.existingMeta.eventDate) ||
    null;
  const eventKey = eventDate ? eventDate.slice(0, 10) : null;
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  const depositDue =
    terms.depositDueDaysAfterSigned > 0 ? shiftDateOnly(today, terms.depositDueDaysAfterSigned) : today;
  const finalCountDue = shiftDateOnly(eventKey, -terms.finalCountDaysBeforeEvent);
  const balanceDue = shiftDateOnly(eventKey, -terms.balanceDaysBeforeEvent);
  const alcoholDue = shiftDateOnly(eventKey, -terms.alcoholDocsDaysBeforeEvent);

  const depositPercent = Math.min(0.9, Math.max(0.1, terms.depositPercent));
  const paymentSchedule: PlaybookPayment[] = [
    {
      id: 'pay-deposit',
      kind: 'deposit',
      label: 'Deposit to hold the date',
      percent: depositPercent,
      dueDate: depositDue,
      dueLabel: dueLabel(depositDue, 'On booking'),
    },
    {
      id: 'pay-balance',
      kind: 'balance',
      label: 'Final balance',
      percent: Math.round((1 - depositPercent) * 1000) / 1000,
      dueDate: balanceDue,
      dueLabel: dueLabel(balanceDue, `${terms.balanceDaysBeforeEvent} days before event`),
    },
  ];

  const clientTimeline: PlaybookTimelineStep[] = [
    timeline('tl-deposit', 'Pay deposit', 'client', depositDue, 'On booking'),
  ];
  if (needsAlcoholDocs(type)) {
    clientTimeline.push(
      timeline('tl-alcohol', 'Submit alcohol / liquor docs', 'client', alcoholDue, `${terms.alcoholDocsDaysBeforeEvent} days before`),
    );
  }
  clientTimeline.push(
    timeline('tl-count', 'Confirm final guest count', 'client', finalCountDue, `${terms.finalCountDaysBeforeEvent} days before`),
    timeline('tl-details', 'Confirm layout, bar, vendors, music cutoff', 'client', finalCountDue, 'With final count'),
    timeline('tl-balance', 'Pay remaining balance', 'client', balanceDue, `${terms.balanceDaysBeforeEvent} days before`),
    timeline('tl-day-of', 'Event day', 'venue', eventKey, 'Event date'),
  );

  const docs = documentsFor(type);
  const playbook: AppliedPlaybook = {
    eventType: type,
    eventTypeLabel: EVENT_TYPE_LABELS[type],
    appliedAt: now.toISOString(),
    terms,
    tasks: tasksFor(type, eventKey, terms, depositDue, finalCountDue, balanceDue, alcoholDue),
    paymentSchedule,
    documents: docs,
    clientTimeline,
  };

  const documentFlags: Record<string, boolean> = {};
  for (const d of docs) documentFlags[d.key] = false;

  const existingFlags =
    input.existingMeta?.documents && typeof input.existingMeta.documents === 'object'
      ? (input.existingMeta.documents as Record<string, boolean>)
      : {};

  return {
    playbook,
    importMetaPatch: {
      eventType: type,
      playbook,
      documents: { ...documentFlags, ...existingFlags },
    },
  };
}

export function playbookFromImportMeta(meta: Record<string, unknown> | null | undefined): AppliedPlaybook | null {
  const raw = meta?.playbook;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<AppliedPlaybook>;
  if (!p.eventType || !Array.isArray(p.tasks)) return null;
  return p as AppliedPlaybook;
}

export function applyPlaybookToImportMeta(
  meta: Record<string, unknown>,
  eventType?: unknown,
  now?: Date,
): Record<string, unknown> {
  const { importMetaPatch } = applyEventPlaybook({
    eventType: eventType ?? meta.eventType,
    eventDateIso: (typeof meta.eventDateIso === 'string' && meta.eventDateIso) || (typeof meta.eventDate === 'string' ? meta.eventDate : null),
    grandTotal: typeof meta.grandTotal === 'number' ? meta.grandTotal : null,
    existingMeta: meta,
    now,
  });
  return { ...meta, ...importMetaPatch };
}
