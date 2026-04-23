import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../errors/index.js';
import type { CreateProductionJobPayload, PatchProductionJobPayload, ProductionJobStatus } from '@mtte-core/shared';
import { ProductionJobRepository } from '../repositories/ProductionJobRepository.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { ChangeOrderRepository } from '../repositories/ChangeOrderRepository.js';
import { BuildVersionRepository } from '../repositories/BuildVersionRepository.js';
import { UnitRepository } from '../repositories/UnitRepository.js';

const UPDATABLE_BY_SHOP = new Set(['service', 'parts', 'management', 'admin', 'super_admin']);

function canUpdateStatus(role: string) {
  return UPDATABLE_BY_SHOP.has(role);
}

function statusIndex(status: ProductionJobStatus) {
  return ['queued', 'ready', 'in_progress', 'paused', 'completed'].indexOf(status);
}

export class ProductionJobService {
  private async impactForBuild(db: Db, ctx: TenantContext, buildId: string, job?: { createdAt?: Date | string; buildVersionId?: string }) {
    const [changeOrders, build] = await Promise.all([
      ChangeOrderRepository.listForBuild(db, ctx, buildId, { page: 1, limit: 300, sort: 'createdAt', order: 'desc' }),
      BuildRepository.findById(db, ctx, buildId),
    ]);
    const reasons: string[] = [];
    if (!build) return { hasImpact: false, reasons: [] as string[] };
    if (changeOrders.data.some(c => c.status === 'pending_approval')) reasons.push('Pending changes may affect current build');
    if (job?.buildVersionId && build.activeVersionId && job.buildVersionId !== build.activeVersionId) reasons.push('Spec version mismatch with production job');
    const createdAt = job?.createdAt;
    if (createdAt && changeOrders.data.some(c => c.status === 'approved' && new Date(c.updatedAt).getTime() > new Date(createdAt).getTime())) {
      reasons.push('Change order approved after production start');
    }
    return { hasImpact: reasons.length > 0, reasons };
  }

  async list(
    db: Db,
    ctx: TenantContext,
    filter: { status?: ProductionJobStatus; assignedTeam?: string; buildId?: string; unitId?: string; q?: string },
    options: { page: number; limit: number; sort: string; order: 'asc' | 'desc' },
  ) {
    const out = await ProductionJobRepository.listJobs(db, ctx, filter, options);
    const [builds, units] = await Promise.all([
      BuildRepository.listByUnitIds(db, ctx, Array.from(new Set(out.data.map(x => x.unitId)))),
      Promise.all(out.data.map(x => UnitRepository.findById(db, ctx, x.unitId))),
    ]);
    const buildById = new Map(builds.map(b => [b._id, b]));
    const unitById = new Map(units.filter(Boolean).map(u => [u!._id, u!]));
    const withImpact = await Promise.all(out.data.map(async job => ({
      ...job,
      unit: unitById.get(job.unitId),
      build: buildById.get(job.buildId),
      productionImpact: await this.impactForBuild(db, ctx, job.buildId, { createdAt: job.createdAt, buildVersionId: job.buildVersionId }),
    })));
    return { ...out, data: withImpact };
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const job = await ProductionJobRepository.findById(db, ctx, id);
    if (!job) throw new NotFoundError('ProductionJob');
    const [build, unit, version] = await Promise.all([
      BuildRepository.findById(db, ctx, job.buildId),
      UnitRepository.findById(db, ctx, job.unitId),
      BuildVersionRepository.findById(db, ctx, job.buildVersionId),
    ]);
    if (!build) throw new NotFoundError('Build');
    if (!unit) throw new NotFoundError('Unit');
    return {
      ...job,
      build,
      unit,
      frozenVersion: version,
      productionImpact: await this.impactForBuild(db, ctx, job.buildId, { createdAt: job.createdAt, buildVersionId: job.buildVersionId }),
    };
  }

  async create(db: Db, ctx: TenantContext, payload: CreateProductionJobPayload) {
    const build = await BuildRepository.findById(db, ctx, payload.buildId);
    if (!build) throw new NotFoundError('Build');
    const unit = await UnitRepository.findById(db, ctx, payload.unitId);
    if (!unit) throw new NotFoundError('Unit');
    if (!['approved', 'in_production', 'completed'].includes(build.status)) {
      throw new ValidationError('Production job requires an approved build');
    }
    const changeOrders = await ChangeOrderRepository.listForBuild(db, ctx, payload.buildId, { page: 1, limit: 200, sort: 'createdAt', order: 'desc' });
    if (changeOrders.data.some(c => c.status === 'pending_approval')) {
      throw new ValidationError('Cannot create production job while change orders are pending approval');
    }
    if (!build.activeVersionId) throw new ValidationError('Build activeVersionId is required for production handoff');
    const created = await ProductionJobRepository.insertOne(db, ctx, {
      tenantId: build.tenantId,
      buildId: payload.buildId,
      unitId: payload.unitId,
      dealId: payload.dealId,
      buildVersionId: build.activeVersionId,
      jobNumber: payload.jobNumber,
      status: 'queued',
      scheduledStartDate: payload.scheduledStartDate,
      assignedTeam: payload.assignedTeam,
      notes: payload.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return created;
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: PatchProductionJobPayload) {
    const existing = await ProductionJobRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('ProductionJob');
    if ((payload.status || payload.assignedTeam || payload.notes || payload.scheduledStartDate) && !canUpdateStatus(ctx.userRole)) {
      throw new ForbiddenError('Only authorized shop/management roles can update production jobs');
    }
    const nextStatus = payload.status;
    if (nextStatus) {
      if (nextStatus !== 'paused' && statusIndex(nextStatus) < statusIndex(existing.status) && existing.status !== 'paused') {
        throw new ValidationError('Production status cannot move backward');
      }
    }
    const patch: Record<string, unknown> = { ...payload };
    if (nextStatus === 'in_progress' && !existing.actualStartDate) patch.actualStartDate = new Date().toISOString();
    if (nextStatus === 'completed') patch.completedDate = new Date().toISOString();
    const out = await ProductionJobRepository.updateOne(db, ctx, id, patch as never);
    if (!out) throw new NotFoundError('ProductionJob');
    return out;
  }

  async counts(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx, {}, { page: 1, limit: 5000, sort: 'updatedAt', order: 'desc' });
    const jobs = rows.data as Array<any>;
    return {
      queued: jobs.filter(j => j.status === 'queued').length,
      ready: jobs.filter(j => j.status === 'ready').length,
      inProgress: jobs.filter(j => j.status === 'in_progress').length,
      paused: jobs.filter(j => j.status === 'paused').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      jobsWithChangeConflicts: jobs.filter(j => j.productionImpact?.hasImpact).length,
    };
  }
}

export const productionJobService = new ProductionJobService();
