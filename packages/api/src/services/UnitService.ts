// packages/api/src/services/UnitService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { UnitRepository, type UnitFilter } from '../repositories/UnitRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateUnitPayload, UnitStatus } from '@mtte-core/shared';
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
    return unit;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateUnitPayload) {
    const tenantId = buildTenantId(payload.entity as Entity, payload.location as Location);
    return UnitRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      dealId: null,
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
