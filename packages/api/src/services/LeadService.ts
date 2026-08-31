// packages/api/src/services/LeadService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { LeadRepository, type LeadFilter } from '../repositories/LeadRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateLeadPayload } from '@hub-crm/shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { buildTenantId } from '@hub-crm/shared';
import type { Entity, Location } from '@hub-crm/shared';
import { DealRepository } from '../repositories/DealRepository.js';

export class LeadService {
  async list(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    return LeadRepository.listLeads(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const lead = await LeadRepository.findById(db, ctx, id);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateLeadPayload) {
    // Always derive a valid slug-format tenantId; never fall back to a hardcoded location
    const tenantId   = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    // Default to the authenticated user's name if no assignedTo provided
    const assignedTo = payload.assignedTo?.trim() || ctx.userName;
    return LeadRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      assignedTo,
      tenantId,
      createdAt:     new Date(),
      updatedAt:     new Date(),
      lastTouchedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateLeadPayload> & { convertedDealId?: string; dealId?: string }) {
    const current = await LeadRepository.findById(db, ctx, id);
    if (!current) throw new NotFoundError('Lead');

    if (payload.status === 'Converted') {
      const dealId = payload.convertedDealId ?? current.convertedDealId ?? current.dealId;
      if (!dealId) {
        throw new ValidationError('Lead cannot be marked Converted without a valid deal');
      }
      const deal = await DealRepository.findById(db, ctx, dealId);
      if (!deal || deal.leadId !== id) {
        throw new ValidationError('Lead conversion references an invalid or mismatched deal');
      }
      payload.convertedDealId = String(deal._id);
      payload.dealId = String(deal._id);
    }

    // Set lastTouchedAt when any meaningful business field is being changed
    const TOUCH_FIELDS = [
      'status', 'assignedTo', 'notes', 'company', 'contact',
      'email', 'phone', 'eventDate', 'guestCount', 'eventType', 'spacePreference', 'estimatedValue',
    ] as const;
    const isTouched = TOUCH_FIELDS.some(f => f in payload);
    const update = isTouched ? { ...payload, lastTouchedAt: new Date() } : payload;
    const lead = await LeadRepository.updateOne(db, ctx, id, update as never);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await LeadRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Lead');
  }
}

export const leadService = new LeadService();
