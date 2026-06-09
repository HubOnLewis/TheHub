// packages/api/src/repositories/LeadRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { LeadStatus } from '@hub-crm/shared';

export interface LeadDoc extends Document {
  tenantId:   string;
  company:    string;
  contact:    string;
  email?:     string;
  phone?:     string;
  source?:    string;
  notes?:     string;
  assignedTo?: string;
  status:        LeadStatus;
  createdAt:     Date;
  updatedAt:     Date;
  lastTouchedAt?: Date;
}

export interface LeadFilter {
  status?:     LeadStatus;
  assignedTo?: string;
  /** true = exclude terminal statuses (Converted, Lost) */
  activeOnly?: boolean;
  search?:     string;
}

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class LeadRepositoryClass extends BaseRepository<LeadDoc> {
  protected collectionName = 'leads';

  async listLeads(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    const query: Record<string, unknown> = {};

    // Status: specific status takes precedence over activeOnly
    if (filter.status) {
      query['status'] = filter.status;
    } else if (filter.activeOnly) {
      query['status'] = { $nin: ['Converted', 'Lost'] };
    }

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
        { contact: { $regex: safe, $options: 'i' } },
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

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }

  /**
   * Returns operational signal counts for the manager dashboard.
   * Uses lastTouchedAt for staleness with a fallback to updatedAt for older records.
   */
  async dashboardCounts(db: Db, ctx: TenantContext): Promise<{
    staleTotal:   number;
    newUntouched: number;
    unassigned:   number;
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

    const [staleTotal, newUntouched, unassigned] = await Promise.all([
      this.col(db).countDocuments(this.scope(ctx, {
        $or: [
          staleCondition('New',       1),
          staleCondition('Contacted', 3),
          staleCondition('Working',   5),
          staleCondition('Quoted',    7),
        ],
      } as never)),
      this.col(db).countDocuments(this.scope(ctx, staleCondition('New', 1) as never)),
      this.col(db).countDocuments(this.scope(ctx, {
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: '' }, { assignedTo: null }],
      } as never)),
    ]);

    return { staleTotal, newUntouched, unassigned };
  }
}

export const LeadRepository = new LeadRepositoryClass();
