// packages/api/src/services/UnitService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { UnitRepository, type UnitFilter } from '../repositories/UnitRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateUnitPayload, UnitStatus } from '@mtte-core/shared';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { InteractionRepository } from '../repositories/InteractionRepository.js';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';

export class UnitService {
  async list(db: Db, ctx: TenantContext, filter: UnitFilter, options: ListOptions) {
    return UnitRepository.listUnits(db, ctx, filter, options);
  }

  async summary(db: Db, ctx: TenantContext) {
    return UnitRepository.statusSummary(db, ctx);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const unit = await UnitRepository.findById(db, ctx, id);
    if (!unit) throw new NotFoundError('Unit');
    const builds = await BuildRepository.listBuilds(db, ctx, { unitId: id }, { page: 1, limit: 50, sort: 'createdAt', order: 'desc' });
    const interactions = await InteractionRepository.list(
      db,
      ctx,
      { unitId: id } as never,
      { page: 1, limit: 100, sort: 'createdAt', order: 'desc' },
    );
    return { ...unit, builds: builds.data, interactions: interactions.data };
  }

  async create(db: Db, ctx: TenantContext, payload: CreateUnitPayload) {
    const company = await CompanyRepository.findById(db, ctx, payload.companyId);
    if (!company) throw new NotFoundError('Company');
    const tenantId = ctx.tenantId ?? buildTenantId(payload.entity as Entity, payload.location as Location);
    return UnitRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      vin: payload.vin || undefined,
      stockNumber: payload.stockNumber || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async setStatus(db: Db, ctx: TenantContext, id: string, status: UnitStatus) {
    const unit = await UnitRepository.updateOne(db, ctx, id, { status } as never);
    if (!unit) throw new NotFoundError('Unit');
    return unit;
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateUnitPayload>) {
    const unit = await UnitRepository.updateOne(db, ctx, id, payload as never);
    if (!unit) throw new NotFoundError('Unit');
    return unit;
  }
}

export const unitService = new UnitService();
