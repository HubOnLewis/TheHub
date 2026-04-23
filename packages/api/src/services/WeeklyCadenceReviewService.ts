import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { WeeklyCadenceReviewRepository, type WeeklyCadenceReviewDoc } from '../repositories/WeeklyCadenceReviewRepository.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

function canManage(role: string): boolean {
  return role === 'management' || role === 'admin' || role === 'super_admin';
}

export class WeeklyCadenceReviewService {
  async list(
    db: Db,
    ctx: TenantContext,
    filter: {
      ownerUserId?: string;
      weekStart?: string;
      weekEnd?: string;
      reviewedByUserId?: string;
    },
    page = 1,
    limit = 50,
  ) {
    if (!canManage(ctx.userRole)) throw new ValidationError('Management/admin role required');
    return WeeklyCadenceReviewRepository.listReviews(
      db,
      ctx,
      filter,
      { page, limit, sort: 'weekStart', order: 'desc' },
    );
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    if (!canManage(ctx.userRole)) throw new ValidationError('Management/admin role required');
    const row = await WeeklyCadenceReviewRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('WeeklyCadenceReview');
    return row;
  }

  async create(
    db: Db,
    ctx: TenantContext,
    payload: Pick<WeeklyCadenceReviewDoc, 'ownerUserId' | 'ownerName' | 'weekStart' | 'weekEnd' | 'summary' | 'priorities' | 'risks' | 'commitments'>,
  ) {
    if (!canManage(ctx.userRole)) throw new ValidationError('Management/admin role required');
    if (!ctx.tenantId) throw new ValidationError('Tenant scope required to create weekly review');
    return WeeklyCadenceReviewRepository.insertOne(db, ctx, {
      ...payload,
      tenantId: ctx.tenantId,
      reviewedAt: new Date().toISOString(),
      reviewedByUserId: ctx.userId,
      reviewedByName: ctx.userName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(
    db: Db,
    ctx: TenantContext,
    id: string,
    payload: Partial<Pick<WeeklyCadenceReviewDoc, 'summary' | 'priorities' | 'risks' | 'commitments' | 'ownerUserId' | 'ownerName' | 'weekStart' | 'weekEnd'>>,
  ) {
    if (!canManage(ctx.userRole)) throw new ValidationError('Management/admin role required');
    const row = await WeeklyCadenceReviewRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('WeeklyCadenceReview');
    const updated = await WeeklyCadenceReviewRepository.updateOne(db, ctx, id, {
      ...payload,
      reviewedAt: new Date().toISOString(),
      reviewedByUserId: ctx.userId,
      reviewedByName: ctx.userName,
    });
    if (!updated) throw new NotFoundError('WeeklyCadenceReview');
    return updated;
  }
}

export const weeklyCadenceReviewService = new WeeklyCadenceReviewService();
