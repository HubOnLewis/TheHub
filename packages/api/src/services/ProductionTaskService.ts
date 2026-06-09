import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/index.js';
import type { CreateProductionTaskPayload, PatchProductionTaskPayload, ProductionTaskCategory, ProductionTaskStatus } from '@hub-crm/shared';
import { ProductionTaskRepository } from '../repositories/ProductionTaskRepository.js';
import { ProductionJobRepository } from '../repositories/ProductionJobRepository.js';
import { BuildVersionRepository } from '../repositories/BuildVersionRepository.js';
import { productionProgressService } from './ProductionProgressService.js';

const UPDATABLE_BY_SHOP = new Set(['service', 'parts', 'management', 'admin', 'super_admin']);
const TASK_TEMPLATE: Array<{ category: ProductionTaskCategory; title: string }> = [
  { category: 'body', title: 'Venue / staging structure' },
  { category: 'hydraulics', title: 'Logistics & heavy equipment' },
  { category: 'electrical', title: 'Power & AV backbone' },
  { category: 'lighting', title: 'Lighting program' },
  { category: 'install', title: 'Final fit-out & accessories' },
  { category: 'inspection', title: 'Quality review' },
  { category: 'final', title: 'Sign-off & handoff prep' },
];

function canUpdateTask(role: string) {
  return UPDATABLE_BY_SHOP.has(role);
}

function normalizeCategory(raw: string): ProductionTaskCategory | null {
  if (raw === 'accessories' || raw === 'misc') return 'install';
  if (raw === 'body') return 'body';
  if (raw === 'hydraulics') return 'hydraulics';
  if (raw === 'electrical') return 'electrical';
  if (raw === 'lighting') return 'lighting';
  if (raw === 'labor') return 'fabrication';
  if (raw === 'freight') return 'install';
  return null;
}

export class ProductionTaskService {
  generateDefaultTasks(
    job: { _id: string; tenantId: string; buildId: string; unitId: string; assignedTeam?: string },
    buildVersion: { specItems: Array<Record<string, unknown>> },
  ) {
    const categoriesInSpec = new Set<ProductionTaskCategory>();
    for (const line of buildVersion.specItems ?? []) {
      const mapped = normalizeCategory(String(line.category ?? ''));
      if (mapped) categoriesInSpec.add(mapped);
    }
    categoriesInSpec.add('inspection');
    categoriesInSpec.add('final');
    categoriesInSpec.add('body');
    const generated = TASK_TEMPLATE
      .filter((t, idx) => {
        if (idx <= 1 && t.category === 'body') return true;
        return categoriesInSpec.has(t.category);
      })
      .map((t, idx) => ({
        tenantId: job.tenantId,
        productionJobId: job._id,
        buildId: job.buildId,
        unitId: job.unitId,
        category: t.category,
        title: t.title,
        status: idx === 0 ? 'ready' as ProductionTaskStatus : 'not_started' as ProductionTaskStatus,
        sequence: idx + 1,
        assignedTeam: job.assignedTeam,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    return generated;
  }

  async ensureGeneratedDefaults(db: Db, ctx: TenantContext, productionJobId: string) {
    const existing = await ProductionTaskRepository.listTasks(db, ctx, { productionJobId }, { page: 1, limit: 1, sort: 'sequence', order: 'asc' });
    if (existing.total > 0) return existing.data;
    const job = await ProductionJobRepository.findById(db, ctx, productionJobId);
    if (!job) throw new NotFoundError('ProductionJob');
    const version = await BuildVersionRepository.findById(db, ctx, job.buildVersionId);
    if (!version) throw new ValidationError('Frozen build version not found for task generation');
    const payloads = this.generateDefaultTasks(job as any, version as any);
    const created = await Promise.all(payloads.map(p => ProductionTaskRepository.insertOne(db, ctx, p as any)));
    return created;
  }

  async listByProductionJobId(db: Db, ctx: TenantContext, productionJobId: string) {
    await this.ensureGeneratedDefaults(db, ctx, productionJobId);
    return ProductionTaskRepository.listTasks(db, ctx, { productionJobId }, { page: 1, limit: 300, sort: 'sequence', order: 'asc' });
  }

  async create(db: Db, ctx: TenantContext, payload: CreateProductionTaskPayload) {
    const job = await ProductionJobRepository.findById(db, ctx, payload.productionJobId);
    if (!job) throw new NotFoundError('ProductionJob');
    const out = await ProductionTaskRepository.insertOne(db, ctx, {
      ...payload,
      tenantId: job.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    return out;
  }

  async update(db: Db, ctx: TenantContext, taskId: string, payload: PatchProductionTaskPayload) {
    const existing = await ProductionTaskRepository.findById(db, ctx, taskId);
    if (!existing) throw new NotFoundError('ProductionTask');
    if (!canUpdateTask(ctx.userRole)) throw new ForbiddenError('Only authorized shop/management roles can update tasks');
    if (payload.status === 'blocked' && !(payload.blockedReason ?? existing.blockedReason)) {
      throw new ValidationError('blockedReason is required when task status is blocked');
    }
    const patch: Record<string, unknown> = { ...payload };
    if (payload.status === 'in_progress' && !existing.startedAt) patch.startedAt = new Date().toISOString();
    if (payload.status === 'completed') {
      patch.completedAt = new Date().toISOString();
      patch.blockedReason = undefined;
    }
    if (payload.status && payload.status !== 'blocked' && payload.blockedReason == null) patch.blockedReason = undefined;
    const out = await ProductionTaskRepository.updateOne(db, ctx, taskId, patch as never);
    if (!out) throw new NotFoundError('ProductionTask');

    const tasks = await ProductionTaskRepository.listTasks(db, ctx, { productionJobId: out.productionJobId }, { page: 1, limit: 500, sort: 'sequence', order: 'asc' });
    const summary = productionProgressService.evaluate((await ProductionJobRepository.findById(db, ctx, out.productionJobId)) as any, tasks.data as any);
    const jobPatch: Record<string, unknown> = {};
    if (payload.status === 'in_progress') {
      const job = await ProductionJobRepository.findById(db, ctx, out.productionJobId);
      if (job && job.status === 'ready') jobPatch.status = 'in_progress';
      if (job && !job.actualStartDate) jobPatch.actualStartDate = new Date().toISOString();
    }
    if ((summary.percentComplete ?? 0) >= 100) jobPatch.notes = `${(await ProductionJobRepository.findById(db, ctx, out.productionJobId))?.notes ?? ''}\nAll execution tasks completed.`.trim();
    if (Object.keys(jobPatch).length > 0) {
      await ProductionJobRepository.updateOne(db, ctx, out.productionJobId, jobPatch as never);
    }
    return out;
  }
}

export const productionTaskService = new ProductionTaskService();
