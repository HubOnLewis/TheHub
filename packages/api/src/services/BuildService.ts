import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateBuildPayload, PatchBuildPayload } from '@mtte-core/shared';
import { buildMarginService } from './BuildMarginService.js';
import { buildChangeService } from './BuildChangeService.js';
import { ChangeOrderRepository } from '../repositories/ChangeOrderRepository.js';
import { ProductionJobRepository } from '../repositories/ProductionJobRepository.js';
import { identityIntegrityService } from './IdentityIntegrityService.js';

function withSpecIds(items: Array<any>) {
  return (items ?? []).map(i => ({ id: i.id ?? `spec_${Math.random().toString(36).slice(2, 10)}`, ...i }));
}

export class BuildService {
  private enrich(row: any) {
    const evaluated = buildMarginService.evaluate(row);
    return { ...row, specItems: evaluated.normalizedLines, buildBomSummary: evaluated.buildBomSummary };
  }

  async list(
    db: Db,
    ctx: TenantContext,
    filter: {
      unitId?: string;
      dealId?: string;
      status?: any;
      q?: string;
      marginRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
      incompleteCosting?: boolean;
      hasSubstitutions?: boolean;
      incompletePricing?: boolean;
    },
    options: ListOptions,
  ) {
    const base = await BuildRepository.listBuilds(
      db,
      ctx,
      { unitId: filter.unitId, dealId: filter.dealId, status: filter.status, q: filter.q, hasSubstitutions: filter.hasSubstitutions },
      { page: 1, limit: 5000, sort: options.sort, order: options.order },
    );
    let rows = base.data.map(x => this.enrich(x as any));
    const changeOrders = await ChangeOrderRepository.listByBuildIds(db, ctx, rows.map(r => r._id));
    const jobs = await ProductionJobRepository.listByBuildIds(db, ctx, rows.map(r => r._id));
    const byBuild = new Map<string, Array<any>>();
    for (const co of changeOrders) {
      const list = byBuild.get(co.buildId) ?? [];
      list.push(co);
      byBuild.set(co.buildId, list);
    }
    rows = rows.map(r => ({
      ...r,
      hasUnapprovedChanges: (byBuild.get(r._id) ?? []).some(c => c.status === 'draft' || c.status === 'pending_approval'),
      pendingChangeOrderCount: (byBuild.get(r._id) ?? []).filter(c => c.status === 'pending_approval').length,
      productionImpact: (() => {
        const linkedJobs = jobs.filter(j => j.buildId === r._id);
        const linkedChanges = byBuild.get(r._id) ?? [];
        const reasons: string[] = [];
        if (linkedJobs.some(j => j.status === 'ready' || j.status === 'in_progress') && linkedChanges.some(c => c.status === 'pending_approval')) {
          reasons.push('Active production job has pending spec changes');
        }
        if (linkedJobs.some(j => j.actualStartDate) && linkedChanges.some(c => c.status === 'approved' && new Date(c.updatedAt).getTime() > new Date(linkedJobs[0]!.createdAt).getTime())) {
          reasons.push('Change order approved after production start');
        }
        if (linkedJobs.some(j => j.buildVersionId !== r.activeVersionId)) {
          reasons.push('Spec version mismatch with production job');
        }
        return { hasImpact: reasons.length > 0, reasons };
      })(),
    }));
    if (filter.marginRiskLevel) rows = rows.filter(r => r.buildBomSummary.marginRiskLevel === filter.marginRiskLevel);
    if (typeof filter.incompleteCosting === 'boolean') rows = rows.filter(r => r.buildBomSummary.incompleteCosting === filter.incompleteCosting);
    if (typeof filter.incompletePricing === 'boolean') rows = rows.filter(r => r.buildBomSummary.incompletePricing === filter.incompletePricing);
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / options.limit));
    const start = (options.page - 1) * options.limit;
    const data = rows.slice(start, start + options.limit);
    return { data, total, page: options.page, pages, limit: options.limit };
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const row = await BuildRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('Build');
    await buildChangeService.ensureInitialVersion(db, ctx, id, (row.specItems ?? []) as any);
    const [versions, changeOrders, jobs] = await Promise.all([
      buildChangeService.listVersions(db, ctx, id),
      buildChangeService.listChangeOrders(db, ctx, id),
      ProductionJobRepository.listByBuildIds(db, ctx, [id]),
    ]);
    const productionImpactReasons: string[] = [];
    if (jobs.some(j => (j.status === 'ready' || j.status === 'in_progress') && changeOrders.data.some(c => c.status === 'pending_approval'))) {
      productionImpactReasons.push('Active production job has pending spec changes');
    }
    if (jobs.some(j => j.buildVersionId !== row.activeVersionId)) productionImpactReasons.push('Spec version mismatch with production job');
    return {
      ...this.enrich(row as any),
      versions: versions.data,
      changeOrders: changeOrders.data,
      productionJobs: jobs,
      hasUnapprovedChanges: changeOrders.data.some(c => c.status === 'draft' || c.status === 'pending_approval'),
      productionImpact: { hasImpact: productionImpactReasons.length > 0, reasons: productionImpactReasons },
    };
  }

  async create(db: Db, ctx: TenantContext, payload: CreateBuildPayload) {
    const { unit } = await identityIntegrityService.validateBuildChain(db, ctx, {
      unitId: payload.unitId,
      dealId: payload.dealId,
    });
    const created = await BuildRepository.insertOne(db, ctx, {
      tenantId: unit.tenantId,
      unitId: payload.unitId,
      dealId: payload.dealId,
      name: payload.name,
      status: payload.status,
      estimatedPrice: payload.estimatedPrice,
      actualPrice: payload.actualPrice,
      templateKey: (payload as any).templateKey,
      templateName: (payload as any).templateName,
      isTemplateDerived: (payload as any).isTemplateDerived,
      specItems: withSpecIds(payload.specItems).map((x: any) => ({ ...x, buildId: undefined })),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const initial = await buildChangeService.ensureInitialVersion(db, ctx, created._id, created.specItems as any);
    const out = await BuildRepository.updateOne(db, ctx, created._id, { activeVersionId: initial._id, latestVersionId: initial._id } as never);
    return out ?? created;
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: PatchBuildPayload) {
    const existing = await BuildRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('Build');
    await buildChangeService.ensureInitialVersion(db, ctx, id, (existing.specItems ?? []) as any);
    const hasSpecChange = Array.isArray(payload.specItems);
    const pendingOrders = await buildChangeService.listChangeOrders(db, ctx, id);
    const hasBlockingPending = pendingOrders.data.some(c => c.status === 'pending_approval');
    if ((existing.status === 'approved' || existing.status === 'in_production' || existing.status === 'completed') && hasSpecChange) {
      throw new ValidationError('Approved/production builds require a change order; direct spec overwrite is blocked');
    }
    if (existing.status !== 'draft' && hasSpecChange) {
      await buildChangeService.createVersion(db, ctx, id, {
        reason: (payload as any).changeReason ?? 'Spec update',
        specItems: withSpecIds(payload.specItems as any).map((x: any) => ({
          ...x,
          buildId: id,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedByUserId: ctx.userId,
          lastModifiedByName: ctx.userName,
        })),
      });
    }
    if ((payload.status === 'in_production' || payload.status === 'completed') && hasBlockingPending) {
      throw new ValidationError('Cannot continue build status while change orders are pending approval');
    }
    const updateDoc: Record<string, unknown> = { ...payload };
    if (payload.specItems && existing.status === 'draft') {
      updateDoc.specItems = withSpecIds(payload.specItems).map((x: any) => ({
        ...x,
        buildId: id,
        createdAt: x.createdAt ?? new Date().toISOString(),
        createdByUserId: x.createdByUserId ?? ctx.userId,
        createdByName: x.createdByName ?? ctx.userName,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedByUserId: ctx.userId,
        lastModifiedByName: ctx.userName,
      }));
    } else if (payload.specItems && existing.status !== 'draft') {
      delete updateDoc.specItems;
    }
    const row = await BuildRepository.updateOne(db, ctx, id, updateDoc as never);
    if (!row) throw new NotFoundError('Build');
    return this.enrich(row as any);
  }

  async economicsCounts(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx, {}, { page: 1, limit: 5000, sort: 'createdAt', order: 'desc' });
    const list = rows.data as Array<any>;
    const changeOrders = await ChangeOrderRepository.listByBuildIds(db, ctx, list.map(x => x._id));
    const pendingByBuild = new Set(changeOrders.filter(c => c.status === 'pending_approval').map(c => c.buildId));
    return {
      quotedBuilds: list.filter(b => b.status === 'quoted').length,
      approvedBuilds: list.filter(b => b.status === 'approved').length,
      buildsWithIncompleteCosting: list.filter(b => b.buildBomSummary?.incompleteCosting).length,
      buildsWithIncompletePricing: list.filter(b => b.buildBomSummary?.incompletePricing).length,
      highMarginRiskBuilds: list.filter(b => b.buildBomSummary?.marginRiskLevel === 'high').length,
      criticalMarginRiskBuilds: list.filter(b => b.buildBomSummary?.marginRiskLevel === 'critical').length,
      buildsWithSubstitutions: list.filter(b => b.buildBomSummary?.hasSubstitutions).length,
      buildsWithUnapprovedChanges: list.filter(b => pendingByBuild.has(b._id)).length,
      pendingChangeOrders: changeOrders.filter(c => c.status === 'pending_approval').length,
      approvedChangeOrdersRecently: changeOrders.filter(c => c.status === 'approved' && c.approvedAt && (Date.now() - new Date(c.approvedAt).getTime()) <= (7 * 24 * 60 * 60 * 1000)).length,
      rejectedChangeOrders: changeOrders.filter(c => c.status === 'rejected').length,
    };
  }
}

export const buildService = new BuildService();
