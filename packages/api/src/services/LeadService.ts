// packages/api/src/services/LeadService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { LeadRepository, type LeadFilter } from '../repositories/LeadRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateLeadPayload } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';

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

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateLeadPayload>) {
    // Set lastTouchedAt when any meaningful business field is being changed
    const TOUCH_FIELDS = ['status', 'assignedTo', 'notes', 'company', 'contact'] as const;
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
