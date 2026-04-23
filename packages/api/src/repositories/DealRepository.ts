// packages/api/src/repositories/DealRepository.ts
import { ObjectId } from 'mongodb';
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { DealStatus } from '@mtte-core/shared';

export interface DealDoc extends Document {
  tenantId:   string;
  companyId?: string;
  title:      string;
  company:    string;
  contact:    string;
  amount:     number;
  assignedTo?: string;
  leadId?:    string;
  unitId?:    string;
  unitIds?:   string[];
  primaryUnitId?: string;
  notes?:     string;
  status:        DealStatus;
  ownerUserId?:  string;
  lastStageChangeAt?: Date;
  atRisk?: {
    flagged: boolean;
    reason?: string;
    flaggedAt?: Date | string;
    flaggedByUserId?: string;
    flaggedByName?: string;
  };
  managementReview?: {
    reviewedAt?: Date | string;
    reviewedByUserId?: string;
    reviewedByName?: string;
    status?: 'approved' | 'challenged' | 'watch';
    notes?: string;
  };
  createdAt:     Date;
  updatedAt:     Date;
  lastTouchedAt?: Date;
}

export interface DealFilter {
  status?:     DealStatus;
  assignedTo?: string;
  /** true = exclude terminal statuses (Delivered, Lost) */
  activeOnly?: boolean;
  search?:     string;
  company?:    string;
  companyId?:  string;
  ownerUserId?: string;
  stage?: DealStatus;
}

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Deal statuses that are terminal/closed — not in conflict for unit-linking */
const CLOSED_DEAL_STATUSES: DealStatus[] = ['Delivered', 'Lost'];

class DealRepositoryClass extends BaseRepository<DealDoc> {
  protected collectionName = 'deals';

  async listDeals(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    const query: Record<string, unknown> = {};

    // Status: specific status takes precedence over activeOnly
    if (filter.status) {
      query['status'] = filter.status;
    } else if (filter.stage) {
      query['status'] = filter.stage;
    } else if (filter.activeOnly) {
      query['status'] = { $nin: ['Delivered', 'Lost'] };
    }
    if (filter.company) query['company'] = filter.company;
    if (filter.companyId) query['companyId'] = filter.companyId;
    if (filter.ownerUserId) query['ownerUserId'] = filter.ownerUserId;

    // Assignment: '__unassigned__' sentinel matches missing/null/empty
    const isUnassigned = filter.assignedTo === '__unassigned__';
    if (!isUnassigned && filter.assignedTo) {
      query['assignedTo'] = filter.assignedTo;
    }

    // Search + unassigned: combine with $and when both are active to avoid $or conflicts
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      const searchOr = [
        { company: { $regex: safe, $options: 'i' } },
        { title:   { $regex: safe, $options: 'i' } },
      ];
      if (isUnassigned) {
        query['$and'] = [
          { $or: [{ assignedTo: { $exists: false } }, { assignedTo: '' }, { assignedTo: null }] },
          { $or: searchOr },
        ];
      } else {
        query['$or'] = searchOr;
      }
    } else if (isUnassigned) {
      query['$or'] = [{ assignedTo: { $exists: false } }, { assignedTo: '' }, { assignedTo: null }];
    }

    return this.list(db, ctx, query as never, options);
  }

  /**
   * Returns the first active (non-terminal) deal linked to the given unitId,
   * optionally excluding one deal by ID (used during updates to skip self).
   * Respects tenant scoping via ctx.
   */
  async findActiveByUnitId(
    db:         Db,
    ctx:        TenantContext,
    unitId:     string,
    excludeId?: string,
  ): Promise<(DealDoc & { _id: string }) | null> {
    const filter: Record<string, unknown> = {
      unitId,
      status: { $nin: CLOSED_DEAL_STATUSES },
    };
    if (excludeId) {
      let oid: ObjectId;
      try { oid = new ObjectId(excludeId); } catch { return null; }
      filter['_id'] = { $ne: oid };
    }
    const doc = await this.col(db).findOne(this.scope(ctx, filter as never));
    return doc ? this.serialize(doc as DealDoc & { _id: ObjectId }) : null;
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }

  /**
   * Returns operational signal counts for the manager dashboard.
   * Uses lastTouchedAt for staleness with a fallback to updatedAt for older records.
   */
  async dashboardCounts(db: Db, ctx: TenantContext): Promise<{
    staleTotal:          number;
    pendingApprovalStale: number;
    unassigned:          number;
  }> {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    /**
     * Staleness condition: prefer lastTouchedAt; fall back to updatedAt for records
     * that existed before Phase 3C when the field was introduced.
     */
    const staleCondition = (status: string, days: number) => ({
      status,
      $or: [
        { lastTouchedAt: { $lt: daysAgo(days) } },
        { lastTouchedAt: { $exists: false }, updatedAt: { $lt: daysAgo(days) } },
      ],
    });

    const [staleTotal, pendingApprovalStale, unassigned] = await Promise.all([
      this.col(db).countDocuments(this.scope(ctx, {
        $or: [
          staleCondition('Draft',            5),
          staleCondition('Pending Approval', 2),
          staleCondition('Approved',         7),
          staleCondition('Won',              14),
          staleCondition('In Build',         30),
        ],
      } as never)),
      this.col(db).countDocuments(this.scope(ctx, staleCondition('Pending Approval', 2) as never)),
      this.col(db).countDocuments(this.scope(ctx, {
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: '' }, { assignedTo: null }],
      } as never)),
    ]);

    return { staleTotal, pendingApprovalStale, unassigned };
  }

  /** Returns all deals for a given company name (tenant-scoped). */
  async listByCompanyName(
    db: Db,
    ctx: TenantContext,
    companyName: string,
  ): Promise<Array<DealDoc & { _id: string }>> {
    const docs = await this.col(db)
      .find(this.scope(ctx, { company: companyName } as never))
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map(d => this.serialize(d as DealDoc & { _id: ObjectId }));
  }

  async listByCompanyId(
    db: Db,
    ctx: TenantContext,
    companyId: string,
  ): Promise<Array<DealDoc & { _id: string }>> {
    const docs = await this.col(db)
      .find(this.scope(ctx, { companyId } as never))
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map(d => this.serialize(d as DealDoc & { _id: ObjectId }));
  }
}

export const DealRepository = new DealRepositoryClass();
