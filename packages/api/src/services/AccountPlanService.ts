import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { AccountPlanRepository } from '../repositories/AccountPlanRepository.js';
import { companyService } from './CompanyService.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { CreateAccountPlanPayload, PatchAccountPlanPayload } from '@hub-crm/shared';

function canManage(role: string): boolean {
  return role === 'management' || role === 'admin' || role === 'super_admin';
}

export class AccountPlanService {
  private assertCanRead(ctx: TenantContext, ownerUserId?: string) {
    if (canManage(ctx.userRole)) return;
    if (!ownerUserId || ownerUserId === ctx.userId) return;
    throw new ValidationError('Insufficient role for this account plan');
  }

  async list(
    db: Db,
    ctx: TenantContext,
    filter: { ownerUserId?: string; status?: 'draft' | 'active' | 'paused' | 'completed'; q?: string; companyId?: string },
    page = 1,
    limit = 50,
  ) {
    if (filter.ownerUserId) this.assertCanRead(ctx, filter.ownerUserId);
    return AccountPlanRepository.listPlans(db, ctx, filter, { page, limit, sort: 'updatedAt', order: 'desc' });
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const row = await AccountPlanRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('AccountPlan');
    this.assertCanRead(ctx, row.ownerUserId);
    return row;
  }

  async getByCompanyId(db: Db, ctx: TenantContext, companyId: string) {
    const row = await AccountPlanRepository.findByCompanyId(db, ctx, companyId);
    if (!row) return null;
    this.assertCanRead(ctx, row.ownerUserId);
    return row;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateAccountPlanPayload) {
    if (!canManage(ctx.userRole) && payload.ownerUserId && payload.ownerUserId !== ctx.userId) {
      throw new ValidationError('Only management/admin can create plans for other owners');
    }
    const company = await companyService.getById(db, ctx, payload.companyId);
    return AccountPlanRepository.insertOne(db, ctx, {
      tenantId: ctx.tenantId ?? company.tenantId,
      companyId: payload.companyId,
      companyName: payload.companyName ?? company.name,
      ownerUserId: payload.ownerUserId ?? ctx.userId,
      ownerName: payload.ownerName ?? ctx.userName,
      status: payload.status,
      objectives: payload.objectives ?? [],
      opportunities: payload.opportunities ?? [],
      risks: payload.risks ?? [],
      nextSteps: payload.nextSteps ?? [],
      reviewedAt: canManage(ctx.userRole) ? new Date().toISOString() : undefined,
      reviewedByUserId: canManage(ctx.userRole) ? ctx.userId : undefined,
      reviewedByName: canManage(ctx.userRole) ? ctx.userName : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: PatchAccountPlanPayload) {
    const existing = await AccountPlanRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('AccountPlan');
    const isOwner = existing.ownerUserId === ctx.userId;
    if (!isOwner && !canManage(ctx.userRole)) {
      throw new ValidationError('Only owner/management/admin can update this plan');
    }
    const out = await AccountPlanRepository.updateOne(db, ctx, id, {
      ...payload,
      reviewedAt: canManage(ctx.userRole) ? new Date().toISOString() : existing.reviewedAt,
      reviewedByUserId: canManage(ctx.userRole) ? ctx.userId : existing.reviewedByUserId,
      reviewedByName: canManage(ctx.userRole) ? ctx.userName : existing.reviewedByName,
    } as never);
    if (!out) throw new NotFoundError('AccountPlan');
    return out;
  }
}

export const accountPlanService = new AccountPlanService();
