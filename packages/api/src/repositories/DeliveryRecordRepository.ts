import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { DeliveryRecordStatus } from '@mtte-core/shared';

export interface DeliveryRecordDoc extends Document {
  tenantId: string;
  productionJobId: string;
  buildId: string;
  unitId: string;
  dealId?: string;
  companyId?: string;
  status: DeliveryRecordStatus;
  scheduledDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryContactName?: string;
  deliveryNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

class DeliveryRecordRepositoryClass extends BaseRepository<DeliveryRecordDoc> {
  protected collectionName = 'delivery_records';

  async listRecords(
    db: Db,
    ctx: TenantContext,
    filter: { status?: DeliveryRecordStatus; productionJobId?: string; buildId?: string; q?: string },
    options: ListOptions,
  ) {
    const q: Filter<DeliveryRecordDoc> = {};
    if (filter.status) (q as any).status = filter.status;
    if (filter.productionJobId) (q as any).productionJobId = filter.productionJobId;
    if (filter.buildId) (q as any).buildId = filter.buildId;
    if (filter.q?.trim()) {
      const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      (q as any).$or = [{ deliveryContactName: { $regex: safe, $options: 'i' } }, { deliveryNotes: { $regex: safe, $options: 'i' } }];
    }
    return this.list(db, ctx, q, options);
  }

  async listByProductionJobIds(db: Db, ctx: TenantContext, productionJobIds: string[]) {
    if (productionJobIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { productionJobId: { $in: productionJobIds } } as any)).toArray();
    return rows.map(r => this.serialize(r as any));
  }

  async findByProductionJobId(db: Db, ctx: TenantContext, productionJobId: string) {
    const row = await this.col(db).findOne(this.scope(ctx, { productionJobId } as any));
    return row ? this.serialize(row as any) : null;
  }

  async listByCompanyId(
    db: Db,
    ctx: TenantContext,
    companyId: string,
    filter: { status?: DeliveryRecordStatus; q?: string },
    options: ListOptions,
  ) {
    const q: Filter<DeliveryRecordDoc> = { companyId } as Filter<DeliveryRecordDoc>;
    if (filter.status) (q as any).status = filter.status;
    if (filter.q?.trim()) {
      const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      (q as any).$or = [{ deliveryContactName: { $regex: safe, $options: 'i' } }, { deliveryNotes: { $regex: safe, $options: 'i' } }];
    }
    return this.list(db, ctx, q, options);
  }
}

export const DeliveryRecordRepository = new DeliveryRecordRepositoryClass();
