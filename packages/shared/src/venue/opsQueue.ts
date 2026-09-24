/**
 * Deterministic venue operations queue from a deal row.
 * Completions / snoozes live on importMeta.opsActions so they persist without a new collection.
 */

import { clientDetailsFromImportMeta } from './clientDetails.js';
import {
  HOLD_EXPIRING_WITHIN_DAYS,
  holdExpiresAtFromMeta,
  resolveHoldLifecycle,
  venueStageFromDeal,
} from './holds.js';
import { playbookFromImportMeta } from './playbooks.js';

export const VENUE_OPS_KINDS = [
  'stale_inquiry',
  'hold_expiring',
  'hold_expired',
  'walkthrough',
  'proposal_followup',
  'deposit_due',
  'balance_due',
  'missing_details',
  'beo_missing',
  'playbook_overdue',
  'prep',
] as const;

export type VenueOpsKind = (typeof VENUE_OPS_KINDS)[number];
export type VenueOpsPriority = 'high' | 'medium' | 'low';
export type VenueOpsAssigneeType = 'user' | 'agent';

export type VenueOpsAssignee = {
  type: VenueOpsAssigneeType;
  id: string;
  name: string;
  reason: string;
};

export type VenueOpsTask = {
  id: string;
  dealId: string;
  kind: VenueOpsKind;
  title: string;
  reason: string;
  priority: VenueOpsPriority;
  dueAt: string | null;
  dueLabel: string;
  eventTitle: string;
  contact: string;
  value: number;
  balanceDue: number;
  playbookTaskId?: string;
  assignee: VenueOpsAssignee;
};

export type VenueOpsActionState = {
  status: 'done' | 'snoozed';
  at: string;
  by?: string;
  snoozeUntil?: string;
};

export type VenueOpsDealInput = {
  _id: string;
  title?: string;
  contact?: string;
  status?: string | null;
  amount?: number;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  lastTouchedAt?: Date | string | null;
  importMeta?: Record<string, unknown> | null;
};

const DAY_MS = 86_400_000;
const PRIORITY_RANK: Record<VenueOpsPriority, number> = { high: 0, medium: 1, low: 2 };

const FOLLOW_UP_KINDS: ReadonlySet<VenueOpsKind> = new Set([
  'stale_inquiry',
  'hold_expiring',
  'hold_expired',
  'walkthrough',
  'proposal_followup',
  'deposit_due',
  'balance_due',
]);

export function defaultVenueOpsAssignee(task: Pick<VenueOpsTask, 'kind' | 'priority' | 'balanceDue'>): VenueOpsAssignee {
  // Routine coordination belongs to Hannah; deterministic drafting/analysis can
  // be handled by Lewis. Jason receives only owner-level payment exceptions.
  if ((task.kind === 'balance_due' || task.kind === 'deposit_due') && task.priority === 'high' && task.balanceDue >= 2500) {
    return { type: 'user', id: 'jason', name: 'Jason', reason: 'High-value payment escalation' };
  }
  if (task.kind === 'stale_inquiry' || task.kind === 'proposal_followup') {
    return { type: 'agent', id: 'lewis', name: 'Lewis', reason: 'Draft and triage routine follow-up' };
  }
  return { type: 'user', id: 'hannah', name: 'Hannah', reason: 'Venue coordination owner' };
}

function isoDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / DAY_MS);
}

function eventDateKey(meta: Record<string, unknown>): string | null {
  return isoDateOnly(meta.eventDateIso) || isoDateOnly(meta.eventDate);
}

function daysUntilEvent(meta: Record<string, unknown>, nowMs: number): number | null {
  const key = eventDateKey(meta);
  if (!key) return null;
  const eventMs = Date.parse(`${key}T12:00:00`);
  if (!Number.isFinite(eventMs)) return null;
  const today = new Date(nowMs);
  today.setHours(12, 0, 0, 0);
  return Math.round((eventMs - today.getTime()) / DAY_MS);
}

function money(meta: Record<string, unknown>, dealAmount?: number): { value: number; balanceDue: number } {
  const value =
    (typeof meta.grandTotal === 'number' && meta.grandTotal) ||
    (typeof dealAmount === 'number' ? dealAmount : 0);
  const paid = typeof meta.amountPaid === 'number' ? meta.amountPaid : 0;
  const balance =
    typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, value - paid);
  return { value, balanceDue: balance };
}

function dueLabelFromIso(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return fallback;
  const days = Math.round((ms - Date.now()) / DAY_MS);
  if (days <= 0) return 'Overdue';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function opsActionsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): Record<string, VenueOpsActionState> {
  const raw = meta && typeof meta === 'object' ? meta.opsActions : null;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, VenueOpsActionState> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    if (row.status !== 'done' && row.status !== 'snoozed') continue;
    const at = typeof row.at === 'string' ? row.at : '';
    if (!at) continue;
    out[key] = {
      status: row.status,
      at,
      by: typeof row.by === 'string' ? row.by : undefined,
      snoozeUntil: typeof row.snoozeUntil === 'string' ? row.snoozeUntil : undefined,
    };
  }
  return out;
}

export function isVenueOpsTaskSuppressed(
  taskId: string,
  actions: Record<string, VenueOpsActionState>,
  nowMs = Date.now(),
): boolean {
  const action = actions[taskId];
  if (!action) return false;
  if (action.status === 'done') return true;
  if (action.status === 'snoozed' && action.snoozeUntil) {
    const until = Date.parse(action.snoozeUntil);
    return Number.isFinite(until) && until > nowMs;
  }
  return false;
}

export function applyVenueOpsAction(
  meta: Record<string, unknown>,
  taskId: string,
  patch: VenueOpsActionState,
): Record<string, unknown> {
  const current = opsActionsFromMeta(meta);
  return {
    ...meta,
    opsActions: {
      ...current,
      [taskId]: patch,
    },
  };
}

export function isFollowUpKind(kind: VenueOpsKind): boolean {
  return FOLLOW_UP_KINDS.has(kind);
}

export function evaluateVenueOps(
  deal: VenueOpsDealInput,
  nowMs = Date.now(),
): VenueOpsTask[] {
  if (deal.status === 'Lost') return [];
  const meta = deal.importMeta && typeof deal.importMeta === 'object' ? deal.importMeta : {};
  const stage = venueStageFromDeal(deal);
  if (stage === 'lost' || stage === 'completed') return [];

  const dealId = String(deal._id);
  const eventTitle = String(deal.title || 'Event');
  const contact = String(deal.contact || 'Guest');
  const { value, balanceDue } = money(meta, deal.amount);
  const actions = opsActionsFromMeta(meta);
  const life = resolveHoldLifecycle(deal, nowMs);
  const untilEvent = daysUntilEvent(meta, nowMs);
  const details = clientDetailsFromImportMeta(meta);
  const playbook = playbookFromImportMeta(meta);
  const lastTouch = toMs(deal.lastTouchedAt) ?? toMs(deal.updatedAt) ?? toMs(deal.createdAt);
  const createdMs = toMs(deal.createdAt);
  const tasks: VenueOpsTask[] = [];

  const base = {
    dealId,
    eventTitle,
    contact,
    value,
    balanceDue,
  };

  const push = (task: Omit<VenueOpsTask, 'assignee'>) => {
    if (isVenueOpsTaskSuppressed(task.id, actions, nowMs)) return;
    tasks.push(task);
  };

  if (stage === 'inquiry') {
    const idleDays =
      lastTouch != null ? daysBetween(lastTouch, nowMs) : createdMs != null ? daysBetween(createdMs, nowMs) : 1;
    if (idleDays >= 1) {
      push({
        ...base,
        id: `stale_inquiry:${dealId}`,
        kind: 'stale_inquiry',
        title: `First-touch follow-up — ${eventTitle}`,
        reason: idleDays <= 1 ? 'New inquiry waiting more than a business day' : `No activity in ${idleDays} days`,
        priority: idleDays >= 2 ? 'high' : 'medium',
        dueAt: lastTouch != null ? new Date(lastTouch + DAY_MS).toISOString() : new Date(nowMs).toISOString(),
        dueLabel: idleDays <= 1 ? 'Due now' : `${idleDays} days idle`,
      });
    }
  }

  if (life === 'expiring') {
    const expires = holdExpiresAtFromMeta(meta);
    push({
      ...base,
      id: `hold_expiring:${dealId}`,
      kind: 'hold_expiring',
      title: `Hold expiring — ${eventTitle}`,
      reason: `Date hold ends within ${HOLD_EXPIRING_WITHIN_DAYS} days unless extended or converted`,
      priority: 'high',
      dueAt: expires,
      dueLabel: dueLabelFromIso(expires, 'Soon'),
    });
  }

  if (life === 'expired') {
    push({
      ...base,
      id: `hold_expired:${dealId}`,
      kind: 'hold_expired',
      title: `Expired hold — ${eventTitle}`,
      reason: 'Hold lapsed and the date is back on the public calendar',
      priority: 'high',
      dueAt: holdExpiresAtFromMeta(meta),
      dueLabel: 'Expired',
    });
  }

  if (meta.walkthroughRequested === true) {
    push({
      ...base,
      id: `walkthrough:${dealId}`,
      kind: 'walkthrough',
      title: `Schedule walkthrough — ${contact}`,
      reason: 'Guest requested a site walkthrough on the public inquiry',
      priority: 'medium',
      dueAt: null,
      dueLabel: 'This week',
    });
  }

  if (stage === 'proposal') {
    push({
      ...base,
      id: `proposal_followup:${dealId}`,
      kind: 'proposal_followup',
      title: `Follow up on proposal — ${eventTitle}`,
      reason: 'Proposal is out and still needs a decision',
      priority: 'high',
      dueAt: null,
      dueLabel: 'This week',
    });
  }

  if (stage === 'deposit' || (balanceDue > 0 && (stage === 'inquiry' || stage === 'qualified' || stage === 'proposal') && value > 0)) {
    push({
      ...base,
      id: `deposit_due:${dealId}`,
      kind: 'deposit_due',
      title: `Collect deposit — ${eventTitle}`,
      reason: 'Deposit is required to convert the hold into a confirmed booking',
      priority: 'high',
      dueAt: null,
      dueLabel: 'As soon as possible',
    });
  }

  if (balanceDue > 0 && (stage === 'confirmed' || stage === 'prep' || stage === 'deposit' || (untilEvent != null && untilEvent <= 21))) {
    push({
      ...base,
      id: `balance_due:${dealId}`,
      kind: 'balance_due',
      title: `Collect balance — ${eventTitle}`,
      reason: `Outstanding balance of ${Math.round(balanceDue)}`,
      priority: untilEvent != null && untilEvent <= 14 ? 'high' : 'medium',
      dueAt: null,
      dueLabel: untilEvent != null && untilEvent >= 0 ? `Event in ${untilEvent} days` : 'As soon as possible',
    });
  }

  if ((stage === 'confirmed' || stage === 'prep') && (!details.layout || details.guestCount == null)) {
    push({
      ...base,
      id: `missing_details:${dealId}`,
      kind: 'missing_details',
      title: `Capture event details — ${eventTitle}`,
      reason: 'Layout or guest count is still missing from the client BEO fields',
      priority: untilEvent != null && untilEvent <= 14 ? 'high' : 'medium',
      dueAt: null,
      dueLabel: 'Before BEO lock',
    });
  }

  const docFlags =
    meta.documents && typeof meta.documents === 'object'
      ? (meta.documents as Record<string, unknown>)
      : {};
  const beoOnFile = docFlags.staffBeo === true || docFlags.beo === true;
  const beoGenerated = typeof meta.beoGeneratedAt === 'string' && meta.beoGeneratedAt.trim().length > 0;
  if ((stage === 'confirmed' || stage === 'prep') && untilEvent != null && untilEvent <= 14 && untilEvent >= 0 && !beoOnFile && !beoGenerated) {
    push({
      ...base,
      id: `beo_missing:${dealId}`,
      kind: 'beo_missing',
      title: `Generate staff BEO — ${eventTitle}`,
      reason: 'Confirmed event is inside the 14-day window without a BEO snapshot',
      priority: untilEvent <= 7 ? 'high' : 'medium',
      dueAt: null,
      dueLabel: untilEvent <= 2 ? 'Day-of window' : `Event in ${untilEvent} days`,
    });
  }

  if (playbook) {
    const todayKey = new Date(nowMs).toISOString().slice(0, 10);
    for (const task of playbook.tasks) {
      if (task.status === 'done') continue;
      if (!task.dueDate || task.dueDate > todayKey) continue;
      const id = `playbook:${dealId}:${task.id}`;
      push({
        ...base,
        id,
        kind: 'playbook_overdue',
        title: task.label,
        reason: `Playbook task is due${task.dueLabel ? ` (${task.dueLabel})` : ''}`,
        priority: task.dueDate < todayKey ? 'high' : 'medium',
        dueAt: `${task.dueDate}T12:00:00.000Z`,
        dueLabel: task.dueDate < todayKey ? 'Overdue' : 'Due today',
        playbookTaskId: task.id,
      });
    }
  }

  if ((stage === 'confirmed' || stage === 'prep') && untilEvent != null && untilEvent >= 0 && untilEvent <= 14) {
    push({
      ...base,
      id: `prep:${dealId}`,
      kind: 'prep',
      title: `Prepare for event — ${eventTitle}`,
      reason: 'Confirmed event is inside the two-week ops window',
      priority: untilEvent <= 7 ? 'high' : 'medium',
      dueAt: null,
      dueLabel: untilEvent === 0 ? 'Today' : untilEvent === 1 ? 'Tomorrow' : `In ${untilEvent} days`,
    });
  }

  for (const task of tasks) {
    task.assignee = defaultVenueOpsAssignee(task);
  }

  return tasks.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return a.title.localeCompare(b.title);
  });
}

export function summarizeVenueOps(tasks: VenueOpsTask[]): {
  total: number;
  high: number;
  followUps: number;
  holds: number;
} {
  return {
    total: tasks.length,
    high: tasks.filter(t => t.priority === 'high').length,
    followUps: tasks.filter(t => isFollowUpKind(t.kind)).length,
    holds: tasks.filter(t => t.kind === 'hold_expiring' || t.kind === 'hold_expired').length,
  };
}
