/**
 * Lead detail view model — API leads + imported inquiry rows.
 * Mirrors Perfect Venue inquiry: contact + event intent + status workflow.
 */

import { LEAD_STATUSES, leadStatusForDisplay, type LeadStatus, type PatchLeadPayload } from '@hub-crm/shared';
import { formatRelativeDate } from '../config/productionData.js';
import { displayOrEmpty } from './eventDetail.js';
import type { LeadIntelRow } from '../data/operationalIntelligence.js';

export type LeadDetailViewModel = {
  id: string;
  title: string;
  contact: string;
  company: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  statusLabel: string;
  source: string | null;
  owner: string;
  createdDisplay: string;
  updatedDisplay: string;
  lastActivityDisplay: string;
  inquirySummary: string | null;
  eventDateHint: string | null;
  guestCount: string | null;
  eventType: string | null;
  spacePreference: string | null;
  estimatedValue: string | null;
  notes: string;
  linkedEventId: string | null;
  canPatch: boolean;
  isReferenceOnly: boolean;
  nextSteps: string[];
};

export type LeadDetailEditForm = {
  company: string;
  contact: string;
  email: string;
  phone: string;
  source: string;
  assignedTo: string;
  status: LeadStatus;
  eventDate: string;
  guestCount: string;
  eventType: string;
  spacePreference: string;
  estimatedValue: string;
  notes: string;
};

const NEXT_BY_STATUS: Record<string, string[]> = {
  New: [
    'Capture complete contact email and phone',
    'Confirm event type and desired date',
    'Qualify guest count and space needs',
  ],
  Contacted: [
    'Confirm event date and guest count',
    'Document space and service preferences',
    'Schedule follow-up with decision maker',
  ],
  Working: [
    'Confirm pricing scope and package fit',
    'Prepare proposal or quote',
    'Set follow-up date for decision',
  ],
  Quoted: [
    'Follow up on proposal status',
    'Confirm deposit requirement',
    'Convert to event when ready to book',
  ],
  Converted: ['Open the linked event record', 'Confirm handoff to operations'],
  Lost: ['Document reason for loss', 'Schedule re-engagement if appropriate'],
};

function nextStepsForStatus(status: string): string[] {
  return NEXT_BY_STATUS[status] ?? NEXT_BY_STATUS.New!;
}

function asLeadStatus(raw: string): LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(raw) ? (raw as LeadStatus) : 'New';
}

function optionalNumberString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function mapApiLeadToViewModel(lead: Record<string, unknown>): LeadDetailViewModel {
  const id = String(lead._id ?? '');
  const status = asLeadStatus(String(lead.status ?? 'New'));
  const createdAt = lead.createdAt as string | undefined;
  const updatedAt = lead.updatedAt as string | undefined;
  const lastTouched = (lead.lastTouchedAt as string | undefined) ?? updatedAt;
  const guestCount = optionalNumberString(lead.guestCount);
  const estimatedValue = optionalNumberString(lead.estimatedValue);
  const eventDate = optionalString(lead.eventDate);
  const eventType = optionalString(lead.eventType);
  const spacePreference = optionalString(lead.spacePreference);

  const inquiryParts = [
    eventType,
    guestCount ? `${guestCount} guests` : null,
    spacePreference,
  ].filter(Boolean);

  return {
    id,
    title: String(lead.company ?? lead.contact ?? 'Lead inquiry'),
    contact: String(lead.contact ?? 'Not captured yet'),
    company: String(lead.company ?? 'Not captured yet'),
    email: optionalString(lead.email),
    phone: optionalString(lead.phone),
    status,
    statusLabel: leadStatusForDisplay(status),
    source: optionalString(lead.source),
    owner: optionalString(lead.assignedTo) ?? 'Not captured yet',
    createdDisplay: createdAt ? formatRelativeDate(createdAt) : 'Not captured yet',
    updatedDisplay: updatedAt ? formatRelativeDate(updatedAt) : 'Not captured yet',
    lastActivityDisplay: lastTouched ? formatRelativeDate(lastTouched) : 'Not captured yet',
    inquirySummary: inquiryParts.length ? inquiryParts.join(' · ') : null,
    eventDateHint: eventDate,
    guestCount,
    eventType,
    spacePreference,
    estimatedValue,
    notes: typeof lead.notes === 'string' ? lead.notes.trim() : '',
    linkedEventId: optionalString(lead.convertedDealId) ?? optionalString(lead.dealId),
    canPatch: true,
    isReferenceOnly: false,
    nextSteps: nextStepsForStatus(status),
  };
}

export function mapImportedLeadToViewModel(row: LeadIntelRow): LeadDetailViewModel {
  return {
    id: row.id,
    title: row.org || row.client,
    contact: row.client,
    company: row.org,
    email: null,
    phone: null,
    status: 'New',
    statusLabel: row.pvStatus ? row.summary.split('·')[0]?.trim() ?? row.summary : row.summary,
    source: row.source || null,
    owner: 'Not captured yet',
    createdDisplay: row.when || 'Not captured yet',
    updatedDisplay: row.when || 'Not captured yet',
    lastActivityDisplay: row.when || 'Not captured yet',
    inquirySummary: row.summary,
    eventDateHint: row.when || null,
    guestCount: null,
    eventType: null,
    spacePreference: null,
    estimatedValue: row.value != null ? String(row.value) : null,
    notes: row.aiAssessment,
    linkedEventId: row.linkId ?? null,
    canPatch: false,
    isReferenceOnly: true,
    nextSteps: nextStepsForStatus('New'),
  };
}

export function leadDetailEditFormFromModel(model: LeadDetailViewModel): LeadDetailEditForm {
  return {
    company: model.company === 'Not captured yet' ? '' : model.company,
    contact: model.contact === 'Not captured yet' ? '' : model.contact,
    email: model.email ?? '',
    phone: model.phone ?? '',
    source: model.source ?? '',
    assignedTo: model.owner === 'Not captured yet' ? '' : model.owner,
    status: model.status,
    eventDate: model.eventDateHint ?? '',
    guestCount: model.guestCount ?? '',
    eventType: model.eventType ?? '',
    spacePreference: model.spacePreference ?? '',
    estimatedValue: model.estimatedValue ?? '',
    notes: model.notes,
  };
}

export function buildLeadDetailPatch(form: LeadDetailEditForm): PatchLeadPayload {
  const guestRaw = form.guestCount.trim();
  const valueRaw = form.estimatedValue.trim();
  const guestCount = guestRaw === '' ? undefined : Number(guestRaw);
  const estimatedValue = valueRaw === '' ? undefined : Number(valueRaw);

  return {
    company: form.company.trim() || 'Inquiry',
    contact: form.contact.trim() || 'Contact',
    email: form.email.trim(),
    phone: form.phone.trim() || undefined,
    source: form.source.trim() || undefined,
    assignedTo: form.assignedTo.trim() || undefined,
    status: form.status,
    eventDate: form.eventDate.trim() || undefined,
    guestCount: Number.isFinite(guestCount) ? guestCount : undefined,
    eventType: form.eventType.trim() || undefined,
    spacePreference: form.spacePreference.trim() || undefined,
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : undefined,
    notes: form.notes.trim() || undefined,
  };
}

export { displayOrEmpty, LEAD_STATUSES };
