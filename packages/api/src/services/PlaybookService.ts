import type { Db } from 'mongodb';
import {
  applyPlaybookToImportMeta,
  applyClientDetailsToImportMeta,
  parseClientDetails,
  resolveEventType,
  type ClientDetails,
} from '@hub-crm/shared';
import { NotFoundError } from '../errors/index.js';
import { DealRepository } from '../repositories/DealRepository.js';
import type { TenantContext } from '../tenancy/index.js';

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
