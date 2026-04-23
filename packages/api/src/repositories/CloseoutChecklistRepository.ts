import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';

export interface CloseoutChecklistDoc extends Document {
  tenantId: string;
  productionJobId: string;
  deliveryRecordId?: string;
  finalInspectionComplete: boolean;
  customerFacingDocsComplete: boolean;
  photosComplete: boolean;
  punchItemsResolved: boolean;
  notes?: string;
  punchItems: Array<{ id: string; title: string; status: 'open' | 'resolved'; notes?: string }>;
  completedAt?: string;
  completedByUserId?: string;
  completedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

class CloseoutChecklistRepositoryClass extends BaseRepository<CloseoutChecklistDoc> {
  protected collectionName = 'closeout_checklists';

  async findByProductionJobId(db: Db, ctx: TenantContext, productionJobId: string) {
    const row = await this.col(db).findOne(this.scope(ctx, { productionJobId } as any));
    return row ? this.serialize(row as any) : null;
  }

  async listByProductionJobIds(db: Db, ctx: TenantContext, productionJobIds: string[]) {
    if (productionJobIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { productionJobId: { $in: productionJobIds } } as Filter<CloseoutChecklistDoc>)).toArray();
    return rows.map(r => this.serialize(r as any));
  }
}

export const CloseoutChecklistRepository = new CloseoutChecklistRepositoryClass();
