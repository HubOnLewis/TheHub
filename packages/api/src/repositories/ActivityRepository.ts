// packages/api/src/repositories/ActivityRepository.ts
import { ObjectId } from 'mongodb';
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { ActivityType } from '@hub-crm/shared';

export interface ActivityDoc extends Document {
  tenantId:          string;
  source:            string;
  sourceId:          string;
  /** Resolved _id of the matching CompanyDoc, if found */
  companyId?:        string;
  companyNameRaw:    string;
  contactNameRaw?:   string;
  activityTypeRaw:   string;
  activityType:      ActivityType;
  createdAt:         Date;
  createdByName:     string;
  milesFromCompany?: number;
  body:              string;
  /** Flags parsed from the Note field — e.g. { "Follow-up": true, "Quote": true } */
  tags:              Record<string, boolean>;
  importMeta?:       Record<string, unknown>;
  updatedAt:         Date;
  // ── Manually-entered interaction fields (all optional, backward-compatible) ──
  title?:         string;
  outcome?:       string;
  followUpAt?:    Date;
  followUpNote?:  string;
  relatedDealId?: string;
}

export interface ActivityFilter {
  companyId?:   string;
  activityType?: ActivityType;
  createdBy?:   string;
  search?:      string;
}

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ActivityRepositoryClass extends BaseRepository<ActivityDoc> {
  protected collectionName = 'activities';

  /**
   * Upsert by (tenantId, source, sourceId). Returns the document's _id as a string.
   * createdAt is preserved on updates (only set on first insert).
   */
  async upsertBySourceId(
    db: Db,
    tenantId: string,
    source: string,
    sourceId: string,
    payload: Omit<ActivityDoc, '_id'>,
  ): Promise<string> {
    const { createdAt, ...rest } = payload;
    const result = await this.col(db).findOneAndUpdate(
      { tenantId, source, sourceId } as Parameters<typeof this.col>[0] extends never ? never : object,
      {
        $set:         { ...rest, updatedAt: new Date() },
        $setOnInsert: { createdAt } as Partial<ActivityDoc>,
      },
      { upsert: true, returnDocument: 'after' },
    );
    return (result!._id as ObjectId).toString();
  }

  async listActivities(
    db: Db,
    ctx: TenantContext,
    filter: ActivityFilter,
    options: ListOptions,
  ) {
    const query: Record<string, unknown> = {};

    if (filter.companyId)    query['companyId']    = filter.companyId;
    if (filter.activityType) query['activityType'] = filter.activityType;
    if (filter.createdBy)    query['createdByName'] = filter.createdBy;

    if (filter.search) {
      const safe = escapeRegex(filter.search);
      query['$or'] = [
        { companyNameRaw:  { $regex: safe, $options: 'i' } },
        { contactNameRaw:  { $regex: safe, $options: 'i' } },
        { body:            { $regex: safe, $options: 'i' } },
      ];
    }

    return this.list(db, ctx, query as Parameters<typeof this.list>[2], options);
  }

  /**
   * Returns all activities for a single company, newest first.
   * Strictly tenant-scoped — no cross-tenant fallback.
   */
  async listForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
    options: ListOptions,
  ) {
    return this.list(
      db, ctx,
      { companyId } as Parameters<typeof this.list>[2],
      options,
    );
  }
}

export const ActivityRepository = new ActivityRepositoryClass();
