/**
 * Normalized event/deal detail view model — API deals + Perfect Venue refresh enrichment.
 */

import { dealStatusForDisplay, formatCurrency } from '@hub-crm/shared';
import type { DealStatus, PatchDealPayload } from '@hub-crm/shared';
import { pvStatusDisplay, type PvEventStatus } from '../data/perfectVenueSeed.js';
import { daysSince, formatRelativeDate } from '../config/productionData.js';
import type { HubRefreshEvent } from '../data/hubRefreshTypes.js';
import type { InteractionRow } from '../hooks/useInteractions.js';
import { getHubRefreshEventById } from '../data/hubRefreshDataLayer.js';
import { getFullPvEventById } from '../data/pvDataLayer.js';
import { FULL_PV_PAYMENTS } from '../data/perfectVenueFullExport.js';
import type { PvFullEvent } from '../data/pvFullTypes.js';

export type EventPipelineStage =
  | 'lead'
  | 'qualified'
  | 'proposal_sent'
  | 'confirmed'
  | 'balance_due'
  | 'completed'
  | 'lost';

export type EventDetailViewModel = {
  id: string;
  title: string;
  company: string;
  contact: string;
  contactEmail: string | null;
  contactPhone: string | null;
  eventType: string | null;
  statusLabel: string;
  pipelineStage: EventPipelineStage;
  crmStatus: string;
  pvStatus: string | null;
  eventDateIso: string | null;
  eventDateDisplay: string;
  startTime: string | null;
  endTime: string | null;
  eventTimeDisplay: string;
  guests: number | null;
  space: string | null;
  owner: string;
  leadSource: string | null;
  createdAt: string | null;
  createdDisplay: string;
  updatedAt: string | null;
  updatedDisplay: string;
  lastContacted: string | null;
  lastContactedDisplay: string;
  grandTotal: number | null;
  amountPaid: number | null;
  balanceDue: number | null;
  depositAmount: number | null;
  paymentStatus: string;
  revenueStatus: string;
  paidInFull: boolean;
  notes: string;
  enrichmentNotes: string[];
  documents: Array<{ key: string; label: string; onFile: boolean }>;
  documentLinks: Array<{ label: string; fileName: string }>;
  payments: Array<{ amount: number; date: string | null; method: string | null; type: string | null }>;
  companyId: string | null;
  canPatch: boolean;
  sourceLabel: string;
  daysUntilEvent: number | null;
  daysSinceEvent: number | null;
  followUpRisk: boolean;
  urgencyNote: string | null;
  nextSteps: string[];
  primaryActionLabel: string;
  statusQuickActions: Array<{ label: string; patchStatus?: DealStatus; description?: string }>;
  timeline: Array<{ id: string; label: string; when: string | null; display: string; kind: 'milestone' | 'activity' | 'payment' }>;
  planFields: Array<{ label: string; value: string }>;
  noteSections: Array<{ title: string; body: string }>;
  isReferenceOnly: boolean;
};

export type EventDetailEditForm = {
  title: string;
  company: string;
  contact: string;
  amount: number;
  assignedTo: string;
  notes: string;
  status: DealStatus;
  eventDateIso: string;
  startTime: string;
  endTime: string;
  guests: string;
  space: string;
  amountPaid: string;
  balanceDue: string;
  lastContactedIso: string;
};

export type EventDetailMapOptions = {
  canPatch?: boolean;
  sourceLabel?: string;
  isReferenceOnly?: boolean;
};

const EMPTY = 'Not captured yet';

export function displayOrEmpty(value: string | number | null | undefined): string {
  if (value == null) return EMPTY;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return EMPTY;
    return String(value);
  }
  const t = value.trim();
  return t.length ? t : EMPTY;
}

export function normalizeMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeWhen(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const days = daysSince(iso);
  if (days == null) return EMPTY;
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 0) return `In ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days < 14) return `${days} days ago`;
  return formatRelativeDate(iso);
}

function crmStatusToPipeline(status: string, balanceDue: number | null, pvStatus: string | null): EventPipelineStage {
  if (pvStatus) return normalizePvStage(pvStatus);
  switch (status) {
    case 'Draft':
      return 'lead';
    case 'Pending Approval':
      return 'qualified';
    case 'Approved':
      return 'proposal_sent';
    case 'Won':
    case 'In Build':
      return balanceDue != null && balanceDue > 0 ? 'balance_due' : 'confirmed';
    case 'Delivered':
      return 'completed';
    case 'Lost':
      return 'lost';
    default:
      return 'lead';
  }
}

function normalizePvStage(raw: string): EventPipelineStage {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  if (s.includes('balance')) return 'balance_due';
  if (s.includes('proposal')) return 'proposal_sent';
  if (s.includes('confirm')) return 'confirmed';
  if (s.includes('complete')) return 'completed';
  if (s.includes('qualif')) return 'qualified';
  if (s.includes('lost')) return 'lost';
  if (s.includes('lead')) return 'lead';
  return 'lead';
}

export function getPaymentStatus(
  grandTotal: number | null,
  amountPaid: number | null,
  balanceDue: number | null,
): string {
  if (grandTotal == null || grandTotal <= 0) {
    if (amountPaid != null && amountPaid > 0) return 'Partial payment recorded';
    return 'No total captured';
  }
  const paid = amountPaid ?? 0;
  const balance = balanceDue ?? Math.max(0, grandTotal - paid);
  if (balance <= 0 && paid >= grandTotal) return 'Paid in full';
  if (balance > 0 && paid > 0) return 'Balance due';
  if (paid > 0) return 'Deposit or partial payment recorded';
  return 'No payment recorded';
}

export function getEventNextSteps(stage: EventPipelineStage): string[] {
  switch (stage) {
    case 'lead':
      return [
        'Confirm event details with the client',
        'Capture contact email and phone',
        'Confirm guest count and space needs',
        'Move to Qualified when intake is complete',
      ];
    case 'qualified':
      return [
        'Prepare proposal or package pricing',
        'Confirm menu and service level',
        'Schedule follow-up with decision maker',
      ];
    case 'proposal_sent':
      return [
        'Follow up on proposal status',
        'Confirm deposit requirement and due date',
        'Update proposal if scope changed',
      ];
    case 'confirmed':
      return [
        'Confirm final guest count',
        'Verify balance due and payment schedule',
        'Prepare event execution notes for the team',
      ];
    case 'balance_due':
      return [
        'Collect remaining balance',
        'Confirm payment deadline with client',
        'Review contract and payment status',
      ];
    case 'completed':
      return [
        'Review final payment and closeout',
        'Capture post-event notes',
        'Archive or close the record',
      ];
    case 'lost':
      return ['Document reason for loss', 'Schedule re-engagement if appropriate'];
    default:
      return ['Review event record and next actions'];
  }
}

function primaryActionForStage(stage: EventPipelineStage): string {
  switch (stage) {
    case 'lead':
      return 'Qualify Event';
    case 'qualified':
      return 'Prepare Proposal';
    case 'proposal_sent':
      return 'Follow Up';
    case 'confirmed':
      return 'Review Event Plan';
    case 'balance_due':
      return 'Collect Balance';
    case 'completed':
      return 'Review Record';
    case 'lost':
      return 'Review Record';
    default:
      return 'Review Event';
  }
}

const CRM_NEXT_STATUS: Partial<Record<EventPipelineStage, DealStatus>> = {
  lead: 'Pending Approval',
  qualified: 'Approved',
};

export function getStatusQuickActions(
  stage: EventPipelineStage,
  crmStatus: string,
): Array<{ label: string; patchStatus?: DealStatus; description?: string }> {
  const actions: Array<{ label: string; patchStatus?: DealStatus; description?: string }> = [];
  const next = CRM_NEXT_STATUS[stage];
  if (next && next !== crmStatus) {
    actions.push({
      label: stage === 'lead' ? 'Move to Qualified' : 'Mark Proposal Sent',
      patchStatus: next,
    });
  }
  if (stage === 'proposal_sent' && crmStatus === 'Approved') {
    actions.push({
      label: 'Log follow-up',
      description: 'Add a note to record client follow-up',
    });
  }
  if (stage === 'balance_due') {
    actions.push({
      label: 'Record payment follow-up',
      description: 'Add a note about balance collection',
    });
  }
  return actions;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function importMeta(deal: Record<string, unknown>): Record<string, unknown> | null {
  return deal.importMeta && typeof deal.importMeta === 'object'
    ? (deal.importMeta as Record<string, unknown>)
    : null;
}

export function mapDealToEventDetailViewModel(
  deal: Record<string, unknown>,
  hubRefresh?: HubRefreshEvent | null,
  interactions: InteractionRow[] = [],
  options?: EventDetailMapOptions,
): EventDetailViewModel {
  const meta = importMeta(deal);
  const id = String(deal._id ?? hubRefresh?.id ?? '');
  const pvStatus = meta?.pvStatus ? String(meta.pvStatus) : hubRefresh?.pvStatus ?? null;
  const crmStatus = String(deal.status ?? 'Draft');

  const eventDateIso =
    (meta?.eventDateIso as string) ?? hubRefresh?.eventDateIso ?? null;
  const startTime = (meta?.startTime as string) ?? hubRefresh?.startTime ?? null;
  const endTime = (meta?.endTime as string) ?? hubRefresh?.endTime ?? null;
  const guests =
    normalizeMoney(meta?.guests) ?? hubRefresh?.guests ?? null;
  const space = (meta?.space as string) ?? hubRefresh?.space ?? null;

  const grandTotal =
    normalizeMoney(meta?.grandTotal) ??
    normalizeMoney(deal.amount) ??
    hubRefresh?.grandTotal ??
    null;
  const amountPaid =
    normalizeMoney(meta?.amountPaid) ?? hubRefresh?.amountPaid ?? null;
  const balanceDue =
    normalizeMoney(meta?.balanceDue) ??
    hubRefresh?.balanceDue ??
    (grandTotal != null && amountPaid != null ? Math.max(0, grandTotal - amountPaid) : null);

  const depositAmount =
    amountPaid != null && grandTotal != null && amountPaid < grandTotal && amountPaid > 0
      ? amountPaid
      : null;

  const lastContacted =
    (meta?.lastContactedIso as string) ??
    hubRefresh?.lastContactedIso ??
    (deal.lastTouchedAt as string) ??
    null;
  const createdAt = (deal.createdAt as string) ?? hubRefresh?.createdOnIso ?? null;
  const updatedAt = (deal.updatedAt as string) ?? null;

  const pipelineStage = crmStatusToPipeline(crmStatus, balanceDue, pvStatus);
  const statusLabel = pvStatus
    ? pvStatusDisplay(pvStatus as PvEventStatus)
    : dealStatusForDisplay(crmStatus);

  const paymentStatus = getPaymentStatus(grandTotal, amountPaid, balanceDue);
  const paidInFull = paymentStatus === 'Paid in full';

  let revenueStatus = 'Open pipeline';
  if (pipelineStage === 'completed') revenueStatus = 'Completed event';
  else if (pipelineStage === 'lost') revenueStatus = 'Closed — lost';
  else if (paidInFull) revenueStatus = 'Revenue collected';
  else if (balanceDue != null && balanceDue > 0) revenueStatus = 'Outstanding balance';

  const daysUntilEvent = daysUntil(eventDateIso);
  const daysSinceEvent =
    eventDateIso && daysUntilEvent != null && daysUntilEvent < 0 ? Math.abs(daysUntilEvent) : null;

  const followUpRisk =
    pipelineStage !== 'completed' &&
    pipelineStage !== 'lost' &&
    lastContacted != null &&
    (daysSince(lastContacted) ?? 0) > 7;

  let urgencyNote: string | null = null;
  if (balanceDue != null && balanceDue > 0) {
    urgencyNote = `${formatCurrency(balanceDue)} balance due`;
  } else if (followUpRisk) {
    urgencyNote = 'Follow-up may be overdue';
  } else if (daysUntilEvent != null && daysUntilEvent >= 0 && daysUntilEvent <= 14) {
    urgencyNote = `Event in ${daysUntilEvent} day${daysUntilEvent === 1 ? '' : 's'}`;
  } else if (daysSinceEvent != null) {
    urgencyNote = 'Past event';
  }

  const docFlags =
    (meta?.documents as Record<string, boolean> | undefined) ??
    (hubRefresh?.documents as Record<string, boolean> | undefined);
  const documentDefs = [
    { key: 'agreement', label: 'Agreement' },
    { key: 'eventSummary', label: 'Event summary' },
    { key: 'beo', label: 'Banquet event order' },
    { key: 'staffBeo', label: 'Staff BEO' },
    { key: 'invoice', label: 'Invoice' },
    { key: 'menu', label: 'Menu' },
  ];
  const documents = documentDefs.map(d => ({
    ...d,
    onFile: Boolean(docFlags?.[d.key]),
  }));
  const documentFiles: Array<{ label: string; fileName: string }> = [];
  const docFiles = (meta?.documentFiles ?? hubRefresh?.documentFiles) as
    | Record<string, string>
    | undefined;
  if (docFiles) {
    for (const d of documentDefs) {
      const fileName = docFiles[d.key];
      if (fileName) documentFiles.push({ label: d.label, fileName });
    }
  }

  const rawPayments = (Array.isArray(meta?.payments) ? meta.payments : hubRefresh?.payments) ?? [];
  const payments = (rawPayments as Array<Record<string, unknown>>).map(p => ({
    amount: normalizeMoney(p.amount) ?? 0,
    date: p.paymentDate ? String(p.paymentDate).slice(0, 10) : null,
    method: p.method ? String(p.method) : null,
    type: p.paymentType ? String(p.paymentType) : null,
  }));

  const notes = typeof deal.notes === 'string' ? deal.notes.trim() : '';
  const enrichmentNotes = [
    ...(Array.isArray(meta?.enrichmentNotes) ? (meta.enrichmentNotes as string[]) : []),
    ...(hubRefresh?.enrichmentNotes ?? []),
  ].filter(Boolean);

  const noteSections: Array<{ title: string; body: string }> = [];
  if (notes) noteSections.push({ title: 'General notes', body: notes });
  for (const n of enrichmentNotes) {
    noteSections.push({ title: 'Event notes', body: n });
  }
  for (const ix of interactions.filter(i => i.type === 'note' || i.summary)) {
    noteSections.push({
      title: ix.summary || 'Activity note',
      body: ix.body || ix.summary,
    });
  }

  const timeline: EventDetailViewModel['timeline'] = [];
  const pushTimeline = (
    id: string,
    label: string,
    when: string | null,
    kind: EventDetailViewModel['timeline'][number]['kind'],
  ) => {
    if (!when) return;
    timeline.push({ id, label, when, display: relativeWhen(when), kind });
  };

  pushTimeline('created', 'Record created', createdAt, 'milestone');
  pushTimeline('last-contact', 'Last contacted', lastContacted, 'milestone');
  pushTimeline('updated', 'Last updated', updatedAt, 'milestone');
  pushTimeline('event-date', 'Event date', eventDateIso, 'milestone');
  if (hubRefresh?.latestPaymentDate) {
    pushTimeline('payment', 'Latest payment', hubRefresh.latestPaymentDate, 'payment');
  }
  for (const p of payments) {
    if (p.date) {
      pushTimeline(`pay-${p.date}-${p.amount}`, 'Payment received', p.date, 'payment');
    }
  }
  for (const ix of interactions) {
    pushTimeline(
      ix._id,
      ix.summary || 'Activity',
      ix.createdAt,
      'activity',
    );
  }
  timeline.sort((a, b) => {
    const ta = a.when ? new Date(a.when).getTime() : 0;
    const tb = b.when ? new Date(b.when).getTime() : 0;
    return tb - ta;
  });

  const planFields: Array<{ label: string; value: string }> = [
    { label: 'Space / room', value: displayOrEmpty(space) },
    { label: 'Guest count', value: guests != null ? String(guests) : EMPTY },
    { label: 'Food & beverage notes', value: EMPTY },
    { label: 'Setup notes', value: EMPTY },
    { label: 'AV / equipment notes', value: EMPTY },
    { label: 'Special requests', value: EMPTY },
    { label: 'Event package', value: displayOrEmpty(hubRefresh?.eventType ?? (meta?.eventType as string)) },
    { label: 'Timeline notes', value: EMPTY },
    { label: 'Internal notes', value: notes || EMPTY },
  ];

  const hasRefreshSource =
    meta?.source === 'perfect_venue_refresh' ||
    (meta?.source && String(meta.source).includes('perfect_venue')) ||
    Boolean(hubRefresh);
  const defaultSourceLabel = hasRefreshSource ? 'Venue CRM record' : 'Live workspace record';
  const canPatch = options?.canPatch ?? true;
  const sourceLabel = options?.sourceLabel ?? defaultSourceLabel;
  const isReferenceOnly = options?.isReferenceOnly ?? false;

  return {
    id,
    title: String(deal.title ?? hubRefresh?.title ?? 'Event'),
    company: String(deal.company ?? hubRefresh?.company ?? EMPTY),
    contact: String(deal.contact ?? hubRefresh?.contact ?? EMPTY),
    contactEmail: hubRefresh?.contactEmail?.trim() || (meta?.contactEmail as string)?.trim() || null,
    contactPhone: hubRefresh?.contactPhone?.trim() || (meta?.contactPhone as string)?.trim() || null,
    eventType: hubRefresh?.eventType ?? (meta?.eventType as string) ?? null,
    statusLabel,
    pipelineStage,
    crmStatus,
    pvStatus,
    eventDateIso,
    eventDateDisplay: formatEventDate(eventDateIso),
    startTime: startTime?.trim() || null,
    endTime: endTime?.trim() || null,
    eventTimeDisplay:
      startTime && endTime
        ? `${startTime} – ${endTime}`
        : startTime || endTime || EMPTY,
    guests,
    space: space?.trim() || null,
    owner: String(deal.assignedTo ?? hubRefresh?.owner ?? meta?.owner ?? EMPTY),
    leadSource: hubRefresh?.leadSource?.trim() || (meta?.leadSource as string)?.trim() || null,
    createdAt,
    createdDisplay: createdAt ? formatRelativeDate(createdAt) : EMPTY,
    updatedAt,
    updatedDisplay: updatedAt ? formatRelativeDate(updatedAt) : EMPTY,
    lastContacted,
    lastContactedDisplay: lastContacted ? relativeWhen(lastContacted) : EMPTY,
    grandTotal,
    amountPaid,
    balanceDue,
    depositAmount,
    paymentStatus,
    revenueStatus,
    paidInFull,
    notes,
    enrichmentNotes,
    documents,
    documentLinks: documentFiles,
    payments,
    companyId: typeof deal.companyId === 'string' ? deal.companyId : null,
    canPatch,
    sourceLabel,
    isReferenceOnly,
    daysUntilEvent,
    daysSinceEvent,
    followUpRisk,
    urgencyNote,
    nextSteps: getEventNextSteps(pipelineStage),
    primaryActionLabel: primaryActionForStage(pipelineStage),
    statusQuickActions: canPatch ? getStatusQuickActions(pipelineStage, crmStatus) : [],
    timeline,
    planFields,
    noteSections,
  };
}

function pvFullEventToPseudoDeal(e: PvFullEvent): Record<string, unknown> {
  const payments = FULL_PV_PAYMENTS.filter(
    p => p.eventId === e.id && p.status === 'Paid',
  ).map(p => ({
    amount: p.amount,
    paymentDate: p.paidOnIso,
    method: p.method,
    paymentType: p.paymentType,
  }));

  return {
    _id: e.id,
    title: e.title,
    company: e.account || e.client,
    contact: e.client,
    amount: e.proposalTotal || e.value || 0,
    assignedTo: e.owner,
    notes: '',
    status: 'Draft',
    createdAt: e.createdOn,
    importMeta: {
      pvStatus: e.pvStatus,
      eventDateIso: e.eventDateIso,
      startTime: e.startTime,
      endTime: e.endTime,
      guests: e.guests,
      space: e.spaces?.length ? e.spaces.join(', ') : e.space,
      grandTotal: e.proposalTotal || e.value,
      amountPaid: e.totalPaid,
      balanceDue: e.balanceDue,
      lastContactedIso: e.lastContacted,
      contactEmail: e.private?.email,
      contactPhone: e.private?.phone,
      leadSource: e.source || e.origin,
      eventType: e.eventType,
      owner: e.owner,
      payments,
    },
  };
}

/** Reference/import-only events — same layout as API deals, read-only. */
export function mapReferenceEventToEventDetailViewModel(dealId: string): EventDetailViewModel | null {
  const hubRefresh = getHubRefreshEventById(dealId);
  if (hubRefresh) {
    return mapDealToEventDetailViewModel({}, hubRefresh, [], {
      canPatch: false,
      sourceLabel: 'Reference event record',
      isReferenceOnly: true,
    });
  }

  const pv = getFullPvEventById(dealId);
  if (pv) {
    return mapDealToEventDetailViewModel(pvFullEventToPseudoDeal(pv), null, [], {
      canPatch: false,
      sourceLabel: 'Reference event record',
      isReferenceOnly: true,
    });
  }

  return null;
}

export function eventDetailEditFormFromModel(model: EventDetailViewModel): EventDetailEditForm {
  return {
    title: model.title,
    company: model.company === EMPTY ? '' : model.company,
    contact: model.contact === EMPTY ? '' : model.contact,
    amount: model.grandTotal ?? 0,
    assignedTo: model.owner === EMPTY ? '' : model.owner,
    notes: model.notes,
    status: model.crmStatus as DealStatus,
    eventDateIso: model.eventDateIso?.slice(0, 10) ?? '',
    startTime: model.startTime ?? '',
    endTime: model.endTime ?? '',
    guests: model.guests != null ? String(model.guests) : '',
    space: model.space && model.space !== EMPTY ? model.space : '',
    amountPaid: model.amountPaid != null ? String(model.amountPaid) : '',
    balanceDue: model.balanceDue != null ? String(model.balanceDue) : '',
    lastContactedIso: model.lastContacted?.slice(0, 10) ?? '',
  };
}

export function buildEventDetailPatch(form: EventDetailEditForm): PatchDealPayload {
  const patch: PatchDealPayload = {
    title: form.title.trim(),
    company: form.company.trim(),
    contact: form.contact.trim(),
    amount: form.amount,
    assignedTo: form.assignedTo.trim() || undefined,
    notes: form.notes,
    status: form.status,
  };

  const importMeta: Record<string, unknown> = {};
  if (form.eventDateIso.trim()) importMeta.eventDateIso = form.eventDateIso.trim();
  if (form.startTime.trim()) importMeta.startTime = form.startTime.trim();
  if (form.endTime.trim()) importMeta.endTime = form.endTime.trim();
  const guests = form.guests.trim() ? Number(form.guests) : NaN;
  if (Number.isFinite(guests) && guests >= 0) importMeta.guests = guests;
  if (form.space.trim()) importMeta.space = form.space.trim();
  const amountPaid = form.amountPaid.trim() ? Number(form.amountPaid) : NaN;
  if (Number.isFinite(amountPaid) && amountPaid >= 0) importMeta.amountPaid = amountPaid;
  const balanceDue = form.balanceDue.trim() ? Number(form.balanceDue) : NaN;
  if (Number.isFinite(balanceDue) && balanceDue >= 0) importMeta.balanceDue = balanceDue;
  if (form.lastContactedIso.trim()) importMeta.lastContactedIso = form.lastContactedIso.trim();
  if (form.amount > 0) importMeta.grandTotal = form.amount;

  if (Object.keys(importMeta).length > 0) {
    patch.importMeta = importMeta;
  }

  return patch;
}
