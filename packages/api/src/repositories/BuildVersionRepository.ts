import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';

export interface BuildVersionDoc extends Document {
  tenantId: string;
  buildId: string;
  versionNumber: number;
  specItems: Array<Record<string, unknown>>;
  summarySnapshot?: Record<string, unknown>;
  createdAt: Date;
  createdByUserId: string;
  createdByName: string;
  reason?: string;
}

class BuildVersionRepositoryClass extends BaseRepository<BuildVersionDoc> {
  protected collectionName = 'build_versions';

  async listByBuildId(db: Db, ctx: TenantContext, buildId: string, options: ListOptions) {
    return this.list(db, ctx, { buildId } as Filter<BuildVersionDoc>, options);
  }

  async findByBuildAndVersionNumber(db: Db, ctx: TenantContext, buildId: string, versionNumber: number) {
    const row = await this.col(db).findOne(this.scope(ctx, { buildId, versionNumber } as Filter<BuildVersionDoc>));
    return row ? this.serialize(row as any) : null;
  }
}

export const BuildVersionRepository = new BuildVersionRepositoryClass();
