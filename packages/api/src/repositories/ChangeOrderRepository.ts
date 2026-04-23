import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { ChangeOrderStatus } from '@mtte-core/shared';

export interface ChangeOrderDoc extends Document {
  tenantId: string;
  buildId: string;
  fromVersionId: string;
  toVersionId: string;
  reason: string;
  description?: string;
  costDelta?: number;
  sellDelta?: number;
  marginDelta?: number;
  status: ChangeOrderStatus;
  requestedByUserId: string;
  requestedByName: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

class ChangeOrderRepositoryClass extends BaseRepository<ChangeOrderDoc> {
  protected collectionName = 'change_orders';

  async listForBuild(db: Db, ctx: TenantContext, buildId: string, options: ListOptions) {
    return this.list(db, ctx, { buildId } as Filter<ChangeOrderDoc>, options);
  }

  async listByBuildIds(db: Db, ctx: TenantContext, buildIds: string[]) {
    if (buildIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { buildId: { $in: buildIds } } as any)).toArray();
    return rows.map(r => this.serialize(r as any));
  }
}

export const ChangeOrderRepository = new ChangeOrderRepositoryClass();
