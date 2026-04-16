// packages/api/src/repositories/UnitRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { UnitStatus } from '@mtte-core/shared';

export interface UnitDoc extends Document {
  tenantId:    string;
  vin:         string;
  stockNumber: string;
  year:        number;
  make:        string;
  model:       string;
  color?:      string;
  spec?:       string;
  notes?:      string;
  msrp?:       number;
  entity:      string;
  location:    string;
  status:      UnitStatus;
  dealId?:     string | null;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface UnitFilter {
  status?: UnitStatus;
  search?: string;
}

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class UnitRepositoryClass extends BaseRepository<UnitDoc> {
  protected collectionName = 'units';

  async listUnits(db: Db, ctx: TenantContext, filter: UnitFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status) mongoFilter['status'] = filter.status;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { vin:         { $regex: safe, $options: 'i' } },
        { stockNumber: { $regex: safe, $options: 'i' } },
        { model:       { $regex: safe, $options: 'i' } },
        { make:        { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusSummary(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 }, totalMsrp: { $sum: '$msrp' } } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }
}

export const UnitRepository = new UnitRepositoryClass();
