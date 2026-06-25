/**
 * Row mappers for CRM event sources — isolated to avoid circular imports.
 */

import { dealStatusForDisplay } from '@hub-crm/shared';
import { opportunityDetailPath } from '../config/paths.js';
import { daysSince, formatRelativeDate } from '../config/productionData.js';
import { getFullPvEvents } from '../data/pvDataLayer.js';
import { pvStatusDisplay, type PvEventStatus, type PvSeedEvent } from '../data/perfectVenueSeed.js';
import type { PfParsedEvent } from '../data/pfEventsTypes.js';
import type { HubRefreshEvent } from '../data/hubRefreshTypes.js';
import type { CrmEventRow } from './crmEvents.js';

function formatEventDate(iso: string | null | undefined, fallback = ''): string {
  if (!iso) return fallback;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeLabel(iso: string | null | undefined, rawRelative?: string): string {
  if (rawRelative?.trim()) return rawRelative.trim();
  if (!iso) return '—';
  const days = daysSince(iso);
  if (days == null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

export function mapFullPvToRow(e: ReturnType<typeof getFullPvEvents>[number]): CrmEventRow {
  const dateIso = e.eventDateIso ?? e.eventDate ?? null;
  const time =
    e.startTime && e.endTime
      ? `${e.startTime} - ${e.endTime}`
      : e.startTime || e.endTime || '';
  return {
    id: e.id,
    title: e.title,
    contact: e.client,
    status: e.pvStatus,
    statusLabel: pvStatusDisplay(e.pvStatus),
    eventDate: dateIso,
    eventDateDisplay: formatEventDate(dateIso, e.dayLabel || '—'),
    eventTime: time,
    guests: e.guests ?? 0,
    space: e.spaces?.join(', ') || e.space || '',
    value: e.proposalTotal || e.value || 0,
    lastContacted: e.lastContacted ?? null,
    lastContactedDisplay: e.lastContacted
      ? `${formatRelativeDate(e.lastContacted)} · ${relativeLabel(e.lastContacted)}`
      : '—',
    createdAt: e.createdOn ?? null,
    createdDisplay: e.createdOn
      ? `${formatRelativeDate(e.createdOn)} · ${relativeLabel(e.createdOn)}`
      : '—',
    owner: e.owner || '—',
    href: opportunityDetailPath(e.id),
    source: 'import',
  };
}

export function mapPfParsedToRow(e: PfParsedEvent): CrmEventRow {
  return {
    id: e.id,
    title: e.title,
    contact: e.contact,
    status: e.pvStatus,
    statusLabel: pvStatusDisplay(e.pvStatus),
    eventDate: e.eventDateIso,
    eventDateDisplay: e.eventDateDisplay || formatEventDate(e.eventDateIso),
    eventTime: e.timeRange || '',
    guests: e.guests ?? 0,
    space: e.space || '',
    value: e.value ?? 0,
    lastContacted: e.lastContactedIso ?? null,
    lastContactedDisplay: e.lastContactedDisplay || '—',
    createdAt: e.createdIso ?? null,
    createdDisplay: e.createdDisplay || '—',
    owner: e.owner || '—',
    href: opportunityDetailPath(e.id),
    source: 'import',
  };
}

export function mapDemoSeedToRow(e: PvSeedEvent): CrmEventRow {
  return {
    id: e.id,
    title: e.title,
    contact: e.client,
    status: e.pvStatus,
    statusLabel: pvStatusDisplay(e.pvStatus),
    eventDate: e.eventDate,
    eventDateDisplay: e.eventDate,
    eventTime: e.eventTime || '',
    guests: e.guests,
    space: e.spaces?.join(', ') || '',
    value: e.value,
    lastContacted: null,
    lastContactedDisplay: '—',
    createdAt: null,
    createdDisplay: '—',
    owner: '—',
    href: opportunityDetailPath(e.id),
    source: 'import',
  };
}

export function mapHubRefreshToRow(e: HubRefreshEvent): CrmEventRow {
  const time =
    e.startTime && e.endTime
      ? `${e.startTime} - ${e.endTime}`
      : e.startTime || e.endTime || '';
  return {
    id: e.id,
    title: e.title,
    contact: e.contact,
    status: e.pvStatus,
    statusLabel: pvStatusDisplay(e.pvStatus as PvEventStatus),
    pvStatus: e.pvStatus,
    eventDate: e.eventDateIso,
    eventDateDisplay: formatEventDate(e.eventDateIso),
    eventTime: time,
    guests: e.guests ?? 0,
    space: e.space || '',
    value: e.grandTotal || 0,
    amountPaid: e.amountPaid,
    balanceDue: e.balanceDue,
    lastContacted: e.lastContactedIso ?? null,
    lastContactedDisplay: e.lastContactedIso
      ? `${formatRelativeDate(e.lastContactedIso)} · ${relativeLabel(e.lastContactedIso)}`
      : '—',
    createdAt: e.createdOnIso ?? null,
    createdDisplay: e.createdOnIso
      ? `${formatRelativeDate(e.createdOnIso)} · ${relativeLabel(e.createdOnIso)}`
      : '—',
    owner: e.owner || '—',
    href: opportunityDetailPath(e.id),
    source: 'import',
  };
}

export function mapDealToCrmRow(deal: Record<string, unknown>): CrmEventRow {
  const id = String(deal._id ?? '');
  const status = String(deal.status ?? 'Draft');
  const updatedAt = (deal.updatedAt as string) ?? null;
  const createdAt = (deal.createdAt as string) ?? updatedAt;
  const importMeta =
    deal.importMeta && typeof deal.importMeta === 'object'
      ? (deal.importMeta as Record<string, unknown>)
      : null;
  const pvStatus = importMeta?.pvStatus ? String(importMeta.pvStatus) : undefined;
  const eventDateIso = importMeta?.eventDateIso ? String(importMeta.eventDateIso) : null;
  const startTime = importMeta?.startTime ? String(importMeta.startTime) : '';
  const endTime = importMeta?.endTime ? String(importMeta.endTime) : '';
  const guests = typeof importMeta?.guests === 'number' ? importMeta.guests : 0;
  const space = importMeta?.space ? String(importMeta.space) : '';
  const grandTotal =
    typeof importMeta?.grandTotal === 'number'
      ? importMeta.grandTotal
      : typeof deal.amount === 'number'
        ? deal.amount
        : 0;
  const amountPaid = typeof importMeta?.amountPaid === 'number' ? importMeta.amountPaid : undefined;
  const balanceDue = typeof importMeta?.balanceDue === 'number' ? importMeta.balanceDue : undefined;
  const lastContacted =
    (importMeta?.lastContactedIso as string) ?? (deal.lastTouchedAt as string) ?? updatedAt;
  const owner = String(deal.assignedTo ?? importMeta?.owner ?? deal.ownerUserId ?? '—');
  const time = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || '';

  return {
    id,
    title: String(deal.title ?? 'Event'),
    contact: String(deal.contact ?? ''),
    status: pvStatus ?? status,
    statusLabel: pvStatus ? pvStatusDisplay(pvStatus as PvEventStatus) : dealStatusForDisplay(status),
    pvStatus,
    eventDate: eventDateIso,
    eventDateDisplay: formatEventDate(eventDateIso),
    eventTime: time,
    guests,
    space,
    value: grandTotal,
    amountPaid,
    balanceDue,
    lastContacted,
    lastContactedDisplay: lastContacted
      ? `${formatRelativeDate(lastContacted)} · ${relativeLabel(lastContacted)}`
      : '—',
    createdAt,
    createdDisplay: createdAt
      ? `${formatRelativeDate(createdAt)} · ${relativeLabel(createdAt)}`
      : '—',
    owner,
    ownerUserId: deal.ownerUserId ? String(deal.ownerUserId) : undefined,
    href: opportunityDetailPath(id),
    source: 'api',
  };
}
