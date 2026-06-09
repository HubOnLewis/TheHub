// packages/api/src/repositories/InteractionRepository.ts
import { ObjectId } from 'mongodb';
import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type {
  InteractionDirection,
  InteractionOutcome,
  InteractionStatus,
  InteractionType,
} from '@hub-crm/shared';

export interface InteractionAttachment {
  id:         string;
  type:       'image' | 'document';
  url:        string;
  fileName:   string;
  mimeType:   string;
  sizeBytes:  number;
  originalFileName: string;
  storageKey: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: Date;
}

export interface InteractionAiInsights {
  suggestedFollowUp?: Date;
  detectedIntent?:  string;
  sentiment?:        string;
}

export interface InteractionDoc extends Document {
  tenantId:         string;
  companyId:        string;
  /** Denormalized for queue / search without a join */
  companyName:      string;
  contactId?:       string;
  relatedDealId?:   string;
  unitId?:          string;
  buildId?:         string;
  parentInteractionId?: string;
  type:             InteractionType;
  direction:        InteractionDirection;
  summary:          string;
  body:             string;
  outcome:          InteractionOutcome;
  status:           InteractionStatus;
  followUpAt?:      Date;
  createdAt:        Date;
  createdByUserId:  string;
  createdByName:    string;
  ownerUserId:      string;
  ownerName:        string;
  completedAt?:     Date;
  completedByUserId?: string;
  completedByName?: string;
  lastEditedAt?:    Date;
  lastEditedByUserId?: string;
  lastEditedByName?: string;
  attachments:      InteractionAttachment[];
  metadata:         Record<string, unknown>;
  aiInsights?:      InteractionAiInsights;
  updatedAt:        Date;
}

class InteractionRepositoryClass extends BaseRepository<InteractionDoc> {
  protected collectionName = 'interactions';

  private makeSearchFilter(q?: string): Filter<InteractionDoc> | null {
    if (!q?.trim()) return null;
    return { $text: { $search: q.trim() } } as Filter<InteractionDoc>;
  }

  async listForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
    filter: {
      type?: string;
      status?: string;
      ownerUserId?: string;
      hasFollowUp?: boolean;
      q?: string;
    },
    options: ListOptions,
  ) {
    const query: Filter<InteractionDoc> = { companyId } as Filter<InteractionDoc>;
    if (filter.type) (query as Record<string, unknown>)['type'] = filter.type;
    if (filter.status) (query as Record<string, unknown>)['status'] = filter.status;
    if (filter.ownerUserId) (query as Record<string, unknown>)['ownerUserId'] = filter.ownerUserId;
    if (filter.hasFollowUp === true) (query as Record<string, unknown>)['followUpAt'] = { $exists: true, $ne: null };
    if (filter.hasFollowUp === false) (query as Record<string, unknown>)['followUpAt'] = { $exists: false };
    const search = this.makeSearchFilter(filter.q);
    const scoped = search ? ({ $and: [query, search] } as Filter<InteractionDoc>) : query;
    return this.list(
      db, ctx,
      scoped,
      { ...options, sort: options.sort || 'createdAt', order: options.order || 'desc' },
    );
  }

  async listFollowUpQueue(
    db: Db,
    ctx: TenantContext,
    filter: {
      mine: boolean;
      ownerUserId?: string;
      overdueOnly?: boolean;
      status?: InteractionStatus;
      q?: string;
    },
    options: ListOptions,
  ) {
    const q: Filter<InteractionDoc> = {
      status:     filter.status ?? 'open',
      followUpAt: { $exists: true, $ne: null } as never,
    };
    if (filter.mine) (q as Record<string, unknown>)['ownerUserId'] = ctx.userId;
    if (filter.ownerUserId) (q as Record<string, unknown>)['ownerUserId'] = filter.ownerUserId;
    if (filter.overdueOnly) (q as Record<string, unknown>)['followUpAt'] = { $lt: new Date(), $exists: true };
    const search = this.makeSearchFilter(filter.q);
    const scoped = search ? ({ $and: [q, search] } as Filter<InteractionDoc>) : q;
    return this.list(db, ctx, scoped, { ...options, sort: 'followUpAt', order: 'asc' });
  }

  async countOverdueOpen(db: Db, ctx: TenantContext, ownerUserId?: string): Promise<number> {
    const now = new Date();
    return this.col(db).countDocuments(
      this.scope(ctx, {
        status:     'open',
        followUpAt: { $lt: now, $exists: true },
        ...(ownerUserId ? { ownerUserId } : {}),
      } as Filter<InteractionDoc>),
    );
  }

  async countDueTodayOpen(db: Db, ctx: TenantContext): Promise<number> {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return this.col(db).countDocuments(
      this.scope(ctx, {
        status: 'open',
        followUpAt: { $gte: start, $lte: end },
      } as Filter<InteractionDoc>),
    );
  }

  async countNoActivityCompanies(
    db: Db,
    ctx: TenantContext,
  ): Promise<number> {
    const tenantId = ctx.tenantId;
    const companies = db.collection('companies');
    if (!tenantId) {
      const total = await companies.countDocuments({});
      const active = await this.col(db).distinct('companyId', {});
      return Math.max(0, total - active.length);
    }
    const total = await companies.countDocuments({ tenantId });
    const active = await this.col(db).distinct('companyId', { tenantId });
    return Math.max(0, total - active.length);
  }

  async countStaleCompanies(
    db: Db,
    ctx: TenantContext,
    staleDays: number,
  ): Promise<number> {
    const threshold = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const pipeline = this.scopedAggregate(ctx, [
      { $group: { _id: '$companyId', lastInteractionAt: { $max: '$createdAt' } } },
      { $match: { lastInteractionAt: { $lt: threshold } } },
      { $count: 'count' },
    ]);
    const result = await this.col(db).aggregate<{ count: number }>(pipeline).toArray();
    return result[0]?.count ?? 0;
  }

  async getLatestByCompanyIds(
    db: Db,
    ctx: TenantContext,
    companyIds: string[],
  ): Promise<Map<string, Date>> {
    if (companyIds.length === 0) return new Map();
    const pipeline = this.scopedAggregate(ctx, [
      { $match: { companyId: { $in: companyIds } } },
      { $group: { _id: '$companyId', lastInteractionAt: { $max: '$createdAt' } } },
    ]);
    const rows = await this.col(db).aggregate<{ _id: string; lastInteractionAt: Date }>(pipeline).toArray();
    return new Map(rows.map(r => [r._id, new Date(r.lastInteractionAt)]));
  }

  async listOpenByOwnerWithoutFollowUp(
    db: Db,
    ctx: TenantContext,
    ownerUserId: string,
    limit = 100,
  ): Promise<Array<InteractionDoc & { _id: string }>> {
    const rows = await this.col(db)
      .find(
        this.scope(ctx, {
          ownerUserId,
          status: 'open',
          followUpAt: { $exists: false },
        } as Filter<InteractionDoc>),
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return rows.map(r => this.serialize(r as InteractionDoc & { _id: ObjectId }));
  }

  async listByRelatedDealIds(
    db: Db,
    ctx: TenantContext,
    dealIds: string[],
  ): Promise<Array<InteractionDoc & { _id: string }>> {
    if (dealIds.length === 0) return [];
    const rows = await this.col(db)
      .find(
        this.scope(ctx, {
          relatedDealId: { $in: dealIds },
        } as Filter<InteractionDoc>),
      )
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map(r => this.serialize(r as InteractionDoc & { _id: ObjectId }));
  }

  async getNextFollowUpForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
  ): Promise<(InteractionDoc & { _id: string }) | null> {
    const rows = await this.col(db)
      .find(
        this.scope(ctx, {
          companyId,
          status:     'open',
          followUpAt: { $exists: true, $ne: null } as never,
        } as Filter<InteractionDoc>),
      )
      .sort({ followUpAt: 1 })
      .limit(1)
      .toArray();
    const row = rows[0];
    if (!row) return null;
    return this.serialize(row as InteractionDoc & { _id: ObjectId });
  }

  async pushAttachment(
    db: Db,
    ctx: TenantContext,
    id: string,
    attachment: InteractionAttachment,
  ): Promise<(InteractionDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }
    const r = await this.col(db).updateOne(
      this.scope(ctx, { _id: oid } as Filter<InteractionDoc>),
      { $set: { updatedAt: new Date() }, $push: { attachments: attachment } } as never,
    );
    if (r.matchedCount === 0) return null;
    return this.findById(db, ctx, id);
  }

  async removeAttachment(
    db: Db,
    ctx: TenantContext,
    id: string,
    attachmentId: string,
  ): Promise<(InteractionDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }
    const r = await this.col(db).updateOne(
      this.scope(ctx, { _id: oid } as Filter<InteractionDoc>),
      {
        $set: { updatedAt: new Date() },
        $pull: { attachments: { id: attachmentId } },
      } as never,
    );
    if (r.matchedCount === 0) return null;
    return this.findById(db, ctx, id);
  }

  async updateWithSetUnset(
    db: Db,
    ctx: TenantContext,
    id: string,
    setDoc: Partial<InteractionDoc>,
    unsetDoc: Record<string, ''> = {},
  ): Promise<(InteractionDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }
    const update: Record<string, unknown> = {
      $set: { ...setDoc, updatedAt: new Date() },
    };
    if (Object.keys(unsetDoc).length > 0) update['$unset'] = unsetDoc;
    const r = await this.col(db).updateOne(
      this.scope(ctx, { _id: oid } as Filter<InteractionDoc>),
      update as never,
    );
    if (r.matchedCount === 0) return null;
    return this.findById(db, ctx, id);
  }

  /**
   * Remove followUpAt (PATCH null).
   */
  async clearFollowUpAt(
    db: Db,
    ctx: TenantContext,
    id: string,
  ): Promise<(InteractionDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }
    const r = await this.col(db).updateOne(
      this.scope(ctx, { _id: oid } as Filter<InteractionDoc>),
      { $set: { updatedAt: new Date() }, $unset: { followUpAt: '' } } as never,
    );
    if (r.matchedCount === 0) return null;
    return this.findById(db, ctx, id);
  }
}

export const InteractionRepository = new InteractionRepositoryClass();
