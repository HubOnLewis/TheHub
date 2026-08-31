import type { Db } from 'mongodb';
import {
  applyPlaybookToImportMeta,
  applyClientDetailsToImportMeta,
  parseClientDetails,
  playbookFromImportMeta,
  resolveEventType,
  setDocumentOnFile,
  setPlaybookTaskStatus,
  type ClientDetails,
  type EventType,
  type PlaybookTask,
} from '@hub-crm/shared';
import { NotFoundError } from '../errors/index.js';
import { DealRepository } from '../repositories/DealRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import { paymentService } from './PaymentService.js';


/** Non-empty eventType on a new booking — used to auto-apply playbook. Blank is not known. */
export function knownEventTypeFromCreate(meta?: Record<string, unknown> | null): EventType | null {
  const raw = meta && typeof meta.eventType === 'string' ? meta.eventType.trim() : '';
  if (!raw) return null;
  return resolveEventType(raw);
}
function metaOf(deal: { importMeta?: Record<string, unknown> }): Record<string, unknown> {
  return deal.importMeta && typeof deal.importMeta === 'object'
    ? { ...deal.importMeta }
    : {};
}

/** Pure: apply event-type playbook onto a deal's importMeta. */
export function applyPlaybookToDealMeta(
  deal: { amount?: number; importMeta?: Record<string, unknown> },
  eventType?: unknown,
  now?: Date,
): Record<string, unknown> {
  const meta = metaOf(deal);
  if (typeof deal.amount === 'number' && typeof meta.grandTotal !== 'number') {
    meta.grandTotal = deal.amount;
  }
  return applyPlaybookToImportMeta(meta, eventType ?? meta.eventType, now);
}

/** Pure: persist portal client details onto a deal's importMeta. */
export function persistClientDetailsOnDealMeta(
  deal: { importMeta?: Record<string, unknown> },
  patch: unknown,
  now?: Date,
): Record<string, unknown> {
  return applyClientDetailsToImportMeta(metaOf(deal), patch, now);
}

export class PlaybookService {
  async apply(db: Db, ctx: TenantContext, dealId: string, eventType?: string) {
    const deal = await DealRepository.findById(db, ctx, dealId);
    if (!deal) throw new NotFoundError('Event');
    const type = eventType ? resolveEventType(eventType) : undefined;
    const importMeta = applyPlaybookToDealMeta(deal, type);
    const updated = await DealRepository.updateOne(db, ctx, dealId, { importMeta } as never);
    if (!updated) throw new NotFoundError('Event');

    const playbook = playbookFromImportMeta(importMeta);
    const grandTotal =
      (typeof importMeta.grandTotal === 'number' && importMeta.grandTotal) ||
      (typeof deal.amount === 'number' ? deal.amount : 0);
    if (playbook) {
      await paymentService.upsertPlaybookSchedule(db, ctx, dealId, {
        eventTitle: String(deal.title ?? 'Event'),
        schedule: playbook.paymentSchedule,
        grandTotal,
      });
    }
    return updated;
  }

  /**
   * Staff check-off for playbook tasks lives on the deal (importMeta.playbook.tasks).
   * Venue events are not production_jobs (those require a unit/build).
   */
  async setTaskStatus(
    db: Db,
    ctx: TenantContext,
    dealId: string,
    taskId: string,
    status: PlaybookTask['status'],
  ) {
    const deal = await DealRepository.findById(db, ctx, dealId);
    if (!deal) throw new NotFoundError('Event');
    const importMeta = setPlaybookTaskStatus(metaOf(deal), taskId, status);
    if (!importMeta) throw new NotFoundError('Playbook task');
    const updated = await DealRepository.updateOne(db, ctx, dealId, { importMeta } as never);
    if (!updated) throw new NotFoundError('Event');
    return updated;
  }

  /** Seeded playbook docs use the existing importMeta.documents on-file flags. */
  async setDocumentFlag(db: Db, ctx: TenantContext, dealId: string, key: string, onFile: boolean) {
    const deal = await DealRepository.findById(db, ctx, dealId);
    if (!deal) throw new NotFoundError('Event');
    const importMeta = setDocumentOnFile(metaOf(deal), key, onFile);
    if (!importMeta) throw new NotFoundError('Playbook document');
    const updated = await DealRepository.updateOne(db, ctx, dealId, { importMeta } as never);
    if (!updated) throw new NotFoundError('Event');
    return updated;
  }

  async persistDetails(db: Db, ctx: TenantContext, dealId: string, patch: ClientDetails | unknown) {
    const deal = await DealRepository.findById(db, ctx, dealId);
    if (!deal) throw new NotFoundError('Event');
    const importMeta = persistClientDetailsOnDealMeta(deal, parseClientDetails(patch));
    const updated = await DealRepository.updateOne(db, ctx, dealId, { importMeta } as never);
    if (!updated) throw new NotFoundError('Event');
    return updated;
  }
}

export const playbookService = new PlaybookService();
