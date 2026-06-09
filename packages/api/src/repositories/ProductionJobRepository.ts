import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { ProductionJobStatus } from '@hub-crm/shared';

export interface ProductionJobDoc extends Document {
  tenantId: string;
  buildId: string;
  unitId: string;
  dealId?: string;
  buildVersionId: string;
  jobNumber?: string;
  status: ProductionJobStatus;
  scheduledStartDate?: string;
  actualStartDate?: string;
  completedDate?: string;
  assignedTeam?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

class ProductionJobRepositoryClass extends BaseRepository<ProductionJobDoc> {
  protected collectionName = 'production_jobs';

  async listJobs(
    db: Db,
    ctx: TenantContext,
    filter: { status?: ProductionJobStatus; assignedTeam?: string; buildId?: string; unitId?: string; q?: string },
    options: ListOptions,
  ) {
    const q: Filter<ProductionJobDoc> = {};
    if (filter.status) (q as any).status = filter.status;
    if (filter.assignedTeam) (q as any).assignedTeam = filter.assignedTeam;
    if (filter.buildId) (q as any).buildId = filter.buildId;
    if (filter.unitId) (q as any).unitId = filter.unitId;
    if (filter.q?.trim()) {
      const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      (q as any).$or = [{ jobNumber: { $regex: safe, $options: 'i' } }, { assignedTeam: { $regex: safe, $options: 'i' } }, { notes: { $regex: safe, $options: 'i' } }];
    }
    return this.list(db, ctx, q, options);
  }

  async listByBuildIds(db: Db, ctx: TenantContext, buildIds: string[]) {
    if (buildIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { buildId: { $in: buildIds } } as any)).toArray();
    return rows.map(r => this.serialize(r as any));
  }
}

export const ProductionJobRepository = new ProductionJobRepositoryClass();
