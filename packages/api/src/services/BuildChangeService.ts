import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/index.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { BuildVersionRepository } from '../repositories/BuildVersionRepository.js';
import { ChangeOrderRepository } from '../repositories/ChangeOrderRepository.js';
import { buildDiffService } from './BuildDiffService.js';
import { buildMarginService } from './BuildMarginService.js';

function canApprove(role: string) {
  return role === 'management' || role === 'admin' || role === 'super_admin';
}

export class BuildChangeService {
  async ensureInitialVersion(db: Db, ctx: TenantContext, buildId: string, specItems: Array<Record<string, unknown>>) {
    const build = await BuildRepository.findById(db, ctx, buildId);
    if (!build) throw new NotFoundError('Build');
    const existing = await BuildVersionRepository.listByBuildId(db, ctx, buildId, { page: 1, limit: 1, sort: 'versionNumber', order: 'asc' });
    if (existing.total > 0) return existing.data[0];
    const summarySnapshot = buildMarginService.evaluate({ specItems } as any).buildBomSummary as unknown as Record<string, unknown>;
    return BuildVersionRepository.insertOne(db, ctx, {
      tenantId: build.tenantId,
      buildId,
      versionNumber: 1,
      specItems,
      summarySnapshot,
      createdAt: new Date(),
      createdByUserId: ctx.userId,
      createdByName: ctx.userName,
      reason: 'Initial quote',
    } as any);
  }

  async createVersion(
    db: Db,
    ctx: TenantContext,
    buildId: string,
    payload: { specItems: Array<Record<string, unknown>>; reason: string },
  ) {
    const build = await BuildRepository.findById(db, ctx, buildId);
    if (!build) throw new NotFoundError('Build');
    const versions = await BuildVersionRepository.listByBuildId(db, ctx, buildId, { page: 1, limit: 1, sort: 'versionNumber', order: 'desc' });
    const nextNumber = (versions.data[0]?.versionNumber ?? 0) + 1;
    const summarySnapshot = buildMarginService.evaluate({ specItems: payload.specItems } as any).buildBomSummary as unknown as Record<string, unknown>;
    const created = await BuildVersionRepository.insertOne(db, ctx, {
      tenantId: build.tenantId,
      buildId,
      versionNumber: nextNumber,
      specItems: payload.specItems,
      summarySnapshot,
      createdAt: new Date(),
      createdByUserId: ctx.userId,
      createdByName: ctx.userName,
      reason: payload.reason,
    } as any);
    await BuildRepository.updateOne(db, ctx, buildId, {
      latestVersionId: created._id,
      ...(build.status === 'draft' ? { activeVersionId: created._id, specItems: payload.specItems } : {}),
    } as never);
    return created;
  }

  async listVersions(db: Db, ctx: TenantContext, buildId: string) {
    return BuildVersionRepository.listByBuildId(db, ctx, buildId, { page: 1, limit: 200, sort: 'versionNumber', order: 'desc' });
  }

  async createChangeOrder(
    db: Db,
    ctx: TenantContext,
    buildId: string,
    payload: { fromVersionId: string; toVersionId: string; reason: string; description?: string },
  ) {
    const build = await BuildRepository.findById(db, ctx, buildId);
    if (!build) throw new NotFoundError('Build');
    const from = await BuildVersionRepository.findById(db, ctx, payload.fromVersionId);
    const to = await BuildVersionRepository.findById(db, ctx, payload.toVersionId);
    if (!from || !to || from.buildId !== buildId || to.buildId !== buildId) throw new ValidationError('Invalid build version references');
    const diff = buildDiffService.compare(from as any, to as any);
    return ChangeOrderRepository.insertOne(db, ctx, {
      tenantId: build.tenantId,
      buildId,
      fromVersionId: payload.fromVersionId,
      toVersionId: payload.toVersionId,
      reason: payload.reason,
      description: payload.description,
      costDelta: diff.costDelta,
      sellDelta: diff.sellDelta,
      marginDelta: diff.marginDelta,
      status: 'draft',
      requestedByUserId: ctx.userId,
      requestedByName: ctx.userName,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async listChangeOrders(db: Db, ctx: TenantContext, buildId: string) {
    return ChangeOrderRepository.listForBuild(db, ctx, buildId, { page: 1, limit: 200, sort: 'createdAt', order: 'desc' });
  }

  async updateChangeOrderStatus(db: Db, ctx: TenantContext, id: string, status: 'draft' | 'pending_approval' | 'approved' | 'rejected') {
    const row = await ChangeOrderRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('ChangeOrder');
    if (status === 'approved' || status === 'rejected') {
      if (!canApprove(ctx.userRole)) throw new ForbiddenError('Only management/admin can approve or reject change orders');
    }
    if (status === 'approved') {
      const to = await BuildVersionRepository.findById(db, ctx, row.toVersionId);
      if (!to) throw new ValidationError('Change order target version not found');
      await BuildRepository.updateOne(db, ctx, row.buildId, {
        activeVersionId: row.toVersionId,
        latestVersionId: row.toVersionId,
        specItems: to.specItems as any,
      } as never);
    }
    const out = await ChangeOrderRepository.updateOne(db, ctx, id, {
      status,
      ...(status === 'approved' || status === 'rejected'
        ? { approvedAt: new Date().toISOString(), approvedByUserId: ctx.userId, approvedByName: ctx.userName }
        : {}),
    } as never);
    if (!out) throw new NotFoundError('ChangeOrder');
    return out;
  }
}

export const buildChangeService = new BuildChangeService();
