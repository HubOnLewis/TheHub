import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { ProductionTaskCategory, ProductionTaskStatus } from '@mtte-core/shared';

export interface ProductionTaskDoc extends Document {
  tenantId: string;
  productionJobId: string;
  buildId: string;
  unitId: string;
  category: ProductionTaskCategory;
  title: string;
  description?: string;
  status: ProductionTaskStatus;
  sequence?: number;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedTeam?: string;
  blockedReason?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

class ProductionTaskRepositoryClass extends BaseRepository<ProductionTaskDoc> {
  protected collectionName = 'production_tasks';

  async listTasks(
    db: Db,
    ctx: TenantContext,
    filter: { productionJobId?: string; status?: ProductionTaskStatus; assignedTeam?: string; q?: string },
    options: ListOptions,
  ) {
    const q: Filter<ProductionTaskDoc> = {};
    if (filter.productionJobId) (q as any).productionJobId = filter.productionJobId;
    if (filter.status) (q as any).status = filter.status;
    if (filter.assignedTeam) (q as any).assignedTeam = filter.assignedTeam;
    if (filter.q?.trim()) {
      const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      (q as any).$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { blockedReason: { $regex: safe, $options: 'i' } },
        { notes: { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, q, options);
  }

  async listByProductionJobIds(db: Db, ctx: TenantContext, productionJobIds: string[]) {
    if (productionJobIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { productionJobId: { $in: productionJobIds } } as any)).toArray();
    return rows.map(r => this.serialize(r as any));
  }
}

export const ProductionTaskRepository = new ProductionTaskRepositoryClass();
