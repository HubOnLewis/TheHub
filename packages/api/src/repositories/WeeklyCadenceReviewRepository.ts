import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';

export interface WeeklyCadenceReviewDoc extends Document {
  tenantId: string;
  ownerUserId: string;
  ownerName?: string;
  weekStart: string;
  weekEnd: string;
  summary?: string;
  priorities?: string[];
  risks?: string[];
  commitments?: string[];
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

class WeeklyCadenceReviewRepositoryClass extends BaseRepository<WeeklyCadenceReviewDoc> {
  protected collectionName = 'weekly_cadence_reviews';

  async listReviews(
    db: Db,
    ctx: TenantContext,
    filter: {
      ownerUserId?: string;
      weekStart?: string;
      weekEnd?: string;
      reviewedByUserId?: string;
    },
    options: ListOptions,
  ) {
    const q: Record<string, unknown> = {};
    if (filter.ownerUserId) q['ownerUserId'] = filter.ownerUserId;
    if (filter.weekStart) q['weekStart'] = { $gte: filter.weekStart };
    if (filter.weekEnd) q['weekEnd'] = { $lte: filter.weekEnd };
    if (filter.reviewedByUserId) q['reviewedByUserId'] = filter.reviewedByUserId;
    return this.list(db, ctx, q as Filter<WeeklyCadenceReviewDoc>, options);
  }
}

export const WeeklyCadenceReviewRepository = new WeeklyCadenceReviewRepositoryClass();
