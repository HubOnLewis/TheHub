/**
 * Lead detail view model — API leads + imported inquiry rows.
 */

import { leadStatusForDisplay } from '@hub-crm/shared';
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
  statusLabel: string;
  source: string | null;
  owner: string;
  createdDisplay: string;
  updatedDisplay: string;
  lastActivityDisplay: string;
  inquirySummary: string | null;
  eventDateHint: string | null;
  estimatedValue: string | null;
  notes: string;
  linkedEventId: string | null;
  canPatch: boolean;
  isReferenceOnly: boolean;
  nextSteps: string[];
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
    'Move to event record when confirmed',
  ],
  Converted: ['Review linked event record', 'Confirm handoff to operations'],
  Lost: ['Document reason for loss', 'Schedule re-engagement if appropriate'],
};

function nextStepsForStatus(status: string): string[] {
  return NEXT_BY_STATUS[status] ?? NEXT_BY_STATUS.New!;
}

export function mapApiLeadToViewModel(lead: Record<string, unknown>): LeadDetailViewModel {
  const id = String(lead._id ?? '');
  const status = String(lead.status ?? 'New');
  const createdAt = lead.createdAt as string | undefined;
  const updatedAt = lead.updatedAt as string | undefined;
  const lastTouched = (lead.lastTouchedAt as string | undefined) ?? updatedAt;

  return {
    id,
    title: String(lead.company ?? lead.contact ?? 'Lead inquiry'),
    contact: String(lead.contact ?? 'Not captured yet'),
    company: String(lead.company ?? 'Not captured yet'),
    email: typeof lead.email === 'string' && lead.email.trim() ? lead.email.trim() : null,
    phone: typeof lead.phone === 'string' && lead.phone.trim() ? lead.phone.trim() : null,
    statusLabel: leadStatusForDisplay(status),
    source: typeof lead.source === 'string' && lead.source.trim() ? lead.source.trim() : null,
    owner: typeof lead.assignedTo === 'string' && lead.assignedTo.trim() ? lead.assignedTo.trim() : 'Not captured yet',
    createdDisplay: createdAt ? formatRelativeDate(createdAt) : 'Not captured yet',
    updatedDisplay: updatedAt ? formatRelativeDate(updatedAt) : 'Not captured yet',
    lastActivityDisplay: lastTouched ? formatRelativeDate(lastTouched) : 'Not captured yet',
    inquirySummary: null,
    eventDateHint: null,
    estimatedValue: null,
    notes: typeof lead.notes === 'string' ? lead.notes.trim() : '',
    linkedEventId: null,
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
    statusLabel: row.pvStatus ? row.summary.split('·')[0]?.trim() ?? row.summary : row.summary,
    source: row.source || null,
    owner: 'Not captured yet',
    createdDisplay: row.when || 'Not captured yet',
    updatedDisplay: row.when || 'Not captured yet',
    lastActivityDisplay: row.when || 'Not captured yet',
    inquirySummary: row.summary,
    eventDateHint: row.when || null,
    estimatedValue: row.value != null ? String(row.value) : null,
    notes: row.aiAssessment,
    linkedEventId: row.linkId ?? null,
    canPatch: false,
    isReferenceOnly: true,
    nextSteps: nextStepsForStatus('New'),
  };
}

export { displayOrEmpty };
