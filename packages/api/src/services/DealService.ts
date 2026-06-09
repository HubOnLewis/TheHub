// packages/api/src/services/DealService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository, type DealDoc, type DealFilter } from '../repositories/DealRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { UnitRepository } from '../repositories/UnitRepository.js';
import { InteractionRepository } from '../repositories/InteractionRepository.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { ChangeOrderRepository } from '../repositories/ChangeOrderRepository.js';
import { ProductionJobRepository } from '../repositories/ProductionJobRepository.js';
import { ProductionTaskRepository } from '../repositories/ProductionTaskRepository.js';
import { productionProgressService } from './ProductionProgressService.js';
import { DeliveryRecordRepository } from '../repositories/DeliveryRecordRepository.js';
import { DeliveryPacketRepository } from '../repositories/DeliveryPacketRepository.js';
import { PostDeliveryFollowUpRepository } from '../repositories/PostDeliveryFollowUpRepository.js';
import { CloseoutChecklistRepository } from '../repositories/CloseoutChecklistRepository.js';
import { identityIntegrityService } from './IdentityIntegrityService.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateDealPayload, DealStatus, UnitStatus } from '@hub-crm/shared';
import { buildTenantId } from '@hub-crm/shared';
import type { Entity, Location } from '@hub-crm/shared';
import { NotFoundError, ValidationError, ConflictError } from '../errors/index.js';
import { eventBus } from '../jobs/index.js';
import { dealPressureService } from './DealPressureService.js';
import { forecastConfidenceService } from './ForecastConfidenceService.js';
import { buildMarginService } from './BuildMarginService.js';

/** Ordered deal stages — index = position in the forward progression */
const DEAL_STAGE_ORDER: DealStatus[] = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Won',
  'In Build',
  'Delivered',
];

/** Block invalid deal stage transitions before any write occurs */
function validateTransition(before: DealDoc & { _id: string }, payload: Partial<CreateDealPayload>): void {
  const next = payload.status;
  if (!next || next === before.status) return;

  // Terminal-stage rules: nothing moves out of Delivered or Lost
  if (before.status === 'Delivered' || before.status === 'Lost') {
    throw new ValidationError(`Cannot change status of a ${before.status} deal`);
  }

  // Lost is always a valid exit from any active stage
  if (next === 'Lost') return;

  const fromIdx = DEAL_STAGE_ORDER.indexOf(before.status);
  const toIdx   = DEAL_STAGE_ORDER.indexOf(next);

  // Backward movement
  if (toIdx < fromIdx) {
    throw new ValidationError(
      `Cannot move deal backward from "${before.status}" to "${next}"`,
    );
  }

  // Skip forward (must advance exactly one stage)
  if (toIdx > fromIdx + 1) {
    const expected = DEAL_STAGE_ORDER[fromIdx + 1];
    throw new ValidationError(
      `Cannot skip from "${before.status}" to "${next}" — next stage is "${expected}"`,
    );
  }

  // Field-level gates for specific forward transitions
  const amount = payload.amount ?? before.amount;
  const unitId = payload.unitId ?? before.unitId;

  if (next === 'Pending Approval' && !(amount > 0)) {
    throw new ValidationError('Amount must be greater than 0 before submitting for approval');
  }
  if (next === 'Won' && !unitId) {
    throw new ValidationError('A unit must be linked before marking a deal as Won');
  }
}

/** Unit statuses that should follow key deal stage transitions */
const DEAL_TO_UNIT_STATUS: Partial<Record<DealStatus, UnitStatus>> = {
  'Won':       'ordered',
  'In Build':  'in_build',
  'Delivered': 'delivered',
};

function closeoutHandoffComplete(co: {
  finalInspectionComplete?: boolean;
  customerFacingDocsComplete?: boolean;
  photosComplete?: boolean;
  punchItemsResolved?: boolean;
} | null | undefined): boolean {
  if (!co) return false;
  return !!(
    co.finalInspectionComplete &&
    co.customerFacingDocsComplete &&
    co.photosComplete &&
    co.punchItemsResolved
  );
}

export class DealService {
  private enrichDeal(
    deal: DealDoc & { _id: string },
    interactions: Awaited<ReturnType<typeof InteractionRepository.listByRelatedDealIds>>,
    builds: Array<{ _id: string; dealId?: string; unitId: string; status: string; specItems: Array<unknown> }>,
    changeOrders: Array<{ buildId: string; status: string; costDelta?: number; sellDelta?: number; marginDelta?: number }>,
    productionJobs: Array<{ buildId: string; status: string; createdAt: Date | string; actualStartDate?: string }>,
    productionTasks: Array<{ productionJobId: string; status: string; startedAt?: string; completedAt?: string; category: string }>,
    deliveryRecords: Array<{ _id: string; productionJobId: string; status: string; actualDeliveryDate?: string }>,
    deliveryHandoffMaps?: {
      packetByDeliveryId: Map<string, { status: string }>;
      followUpsByDeliveryId: Map<string, Array<{ status: string; dueAt?: Date | string; followUpType?: string }>>;
      closeoutByJobId: Map<string, {
        finalInspectionComplete?: boolean;
        customerFacingDocsComplete?: boolean;
        photosComplete?: boolean;
        punchItemsResolved?: boolean;
      } | null>;
    },
  ) {
    const linked = interactions.filter(i => i.relatedDealId === deal._id);
    const linkedBuilds = builds.filter(b => b.dealId === deal._id || (deal.unitIds ?? []).includes(b.unitId) || deal.unitId === b.unitId);
    const buildSummaries = linkedBuilds.map(b => ({ buildId: b._id, ...(buildMarginService.evaluate(b as any).buildBomSummary) }));
    const dealBuildFinancialSummary = {
      buildCount: linkedBuilds.length,
      totalEstimatedCost: buildSummaries.reduce((n, s) => n + (s.estimatedCostTotal ?? 0), 0),
      totalEstimatedSell: buildSummaries.reduce((n, s) => n + (s.estimatedSellTotal ?? 0), 0),
      totalEstimatedMargin: buildSummaries.reduce((n, s) => n + (s.estimatedGrossMargin ?? 0), 0),
      hasIncompleteBuildCosting: buildSummaries.some(s => s.incompleteCosting || s.incompletePricing),
      hasHighMarginRiskBuilds: buildSummaries.some(s => s.marginRiskLevel === 'high' || s.marginRiskLevel === 'critical'),
    };
    const linkedBuildIds = new Set(linkedBuilds.map(b => b._id));
    const linkedChangeOrders = changeOrders.filter(c => linkedBuildIds.has(c.buildId));
    const linkedProductionJobs = productionJobs.filter(j => linkedBuildIds.has(j.buildId));
    const linkedProgress = linkedProductionJobs.map(j => productionProgressService.evaluate(j as any, productionTasks.filter(t => t.productionJobId === (j as any)._id) as any));
    const linkedDeliveries = deliveryRecords.filter(d => linkedProductionJobs.some(j => (j as any)._id === d.productionJobId));
    const now = Date.now();
    const execution = dealPressureService.evaluate(deal, linked);
    const pipelineWarnings = dealPressureService.buildWarnings(deal, linked, execution, linkedBuilds);
    if (deliveryHandoffMaps) {
      for (const d of linkedDeliveries) {
        if (d.status !== 'delivered' && d.status !== 'closed') continue;
        const packet = deliveryHandoffMaps.packetByDeliveryId.get(d._id);
        const co = deliveryHandoffMaps.closeoutByJobId.get(d.productionJobId) ?? null;
        if (!packet) pipelineWarnings.push('Delivered unit missing customer handoff packet');
        else if (packet.status !== 'issued' || !closeoutHandoffComplete(co)) {
          pipelineWarnings.push('Delivery complete but handoff not fully issued');
        }
        const fus = deliveryHandoffMaps.followUpsByDeliveryId.get(d._id) ?? [];
        const overdueFu = fus.some(f =>
          (f.status === 'pending' || f.status === 'scheduled') &&
          f.dueAt &&
          new Date(f.dueAt).getTime() < now,
        );
        if (overdueFu) pipelineWarnings.push('Post-delivery follow-up is overdue');
        const checkIn = fus.find(f => f.followUpType === 'check_in');
        if (checkIn && (checkIn.status === 'pending' || checkIn.status === 'scheduled') && !overdueFu) {
          const deliveredAt = d.actualDeliveryDate ? new Date(d.actualDeliveryDate).getTime() : 0;
          const staleFollowUp = deliveredAt > 0 && now - deliveredAt > 10 * 86400000;
          if (staleFollowUp) pipelineWarnings.push('Delivered unit has no completed post-delivery follow-up');
        }
      }
    }
    if (dealBuildFinancialSummary.hasIncompleteBuildCosting) pipelineWarnings.push('Active deal has incomplete build costing');
    if (buildSummaries.some(s => s.marginRiskLevel === 'high' || s.marginRiskLevel === 'critical')) pipelineWarnings.push('Build margin risk is high');
    if (deal.status === 'Pending Approval' && dealBuildFinancialSummary.hasIncompleteBuildCosting) pipelineWarnings.push('Quoted build economics are not trusted');
    if (linkedChangeOrders.some(c => c.status === 'pending_approval')) pipelineWarnings.push('Change order awaiting approval');
    if (linkedChangeOrders.some(c => c.status === 'approved') && linkedChangeOrders.some(c => c.status === 'pending_approval' || c.status === 'draft')) pipelineWarnings.push('Approved build has pending change orders');
    if (linkedChangeOrders.some(c => Math.abs((c.marginDelta ?? 0)) > 5000 || Math.abs((c.sellDelta ?? 0)) > 10000)) pipelineWarnings.push('Build changes affecting deal economics');
    if (['Approved', 'Won', 'In Build'].includes(deal.status) && linkedBuilds.length > 0 && linkedProductionJobs.length === 0) {
      pipelineWarnings.push('Production job not started for approved build');
    }
    if (linkedProductionJobs.some(j => j.status === 'paused')) pipelineWarnings.push('Production paused');
    if (linkedProductionJobs.some(j => (j.status === 'queued' || j.status === 'ready') && (Date.now() - new Date(j.createdAt).getTime()) > 7 * 24 * 60 * 60 * 1000)) {
      pipelineWarnings.push('Build delayed in production');
    }
    if (linkedProgress.some(p => p.blockedTasks > 0)) pipelineWarnings.push('Production job has blocked execution tasks');
    if (linkedProgress.some(p => p.progressRiskLevel === 'high' || p.progressRiskLevel === 'critical')) pipelineWarnings.push('Approved build is in shop but progress is stalled');
    if (linkedProductionJobs.some(j => j.status === 'completed') && linkedDeliveries.every(d => d.status !== 'scheduled' && d.status !== 'delivered' && d.status !== 'closed')) {
      pipelineWarnings.push('Production complete but delivery not scheduled');
    }
    if (linkedDeliveries.some(d => d.status === 'ready_for_delivery') && linkedProductionJobs.some(j => j.status !== 'completed')) {
      pipelineWarnings.push('Ready for delivery but closeout items incomplete');
    }
    if (linkedDeliveries.some(d => d.status === 'delivered') && linkedDeliveries.some(d => d.status !== 'closed')) {
      pipelineWarnings.push('Delivered unit not fully closed out');
    }
    const forecastState = forecastConfidenceService.evaluate(deal, execution, pipelineWarnings, linked, linkedBuilds);
    // Forecast hygiene overlays
    if (forecastState.forecastCategory === 'commit' && execution.overdueFollowUps > 0) {
      pipelineWarnings.push('Commit candidate has overdue follow-up');
    }
    if (forecastState.forecastCategory === 'best_case' && !execution.nextActionSummary) {
      pipelineWarnings.push('Best-case candidate has no next action');
    }
    if (['Approved', 'Won', 'In Build'].includes(deal.status) && (execution.daysSinceLastInteraction ?? 999) > 7) {
      pipelineWarnings.push('Advanced stage has no interaction within threshold');
    }
    const daysInStage = Math.floor((Date.now() - new Date(deal.lastStageChangeAt ?? deal.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
    const stageMovedAt = new Date(deal.lastStageChangeAt ?? deal.updatedAt).toISOString();
    return {
      ...deal,
      buildSummary: {
        buildCount: linkedBuilds.length,
        hasBuildDefined: linkedBuilds.length > 0,
        hasStructuredSpec: linkedBuilds.some(b => (b.specItems ?? []).length > 0),
      },
      dealBuildFinancialSummary,
      dealChangeOrderSummary: {
        total: linkedChangeOrders.length,
        pendingApproval: linkedChangeOrders.filter(c => c.status === 'pending_approval').length,
        draft: linkedChangeOrders.filter(c => c.status === 'draft').length,
        approved: linkedChangeOrders.filter(c => c.status === 'approved').length,
      },
      dealProductionSummary: {
        totalJobs: linkedProductionJobs.length,
        pausedJobs: linkedProductionJobs.filter(j => j.status === 'paused').length,
        inProgressJobs: linkedProductionJobs.filter(j => j.status === 'in_progress').length,
        blockedJobs: linkedProgress.filter(p => p.blockedTasks > 0).length,
        deliveryScheduled: linkedDeliveries.filter(d => d.status === 'scheduled').length,
        delivered: linkedDeliveries.filter(d => d.status === 'delivered' || d.status === 'closed').length,
      },
      daysInStage,
      lastStageChangeAt: stageMovedAt,
      dealExecutionState: execution,
      forecastState,
      pipelineWarnings: Array.from(new Set(pipelineWarnings)),
    };
  }

  async listAllActiveEnriched(db: Db, ctx: TenantContext) {
    const first = await this.list(db, ctx, { activeOnly: true }, { page: 1, limit: 200, sort: 'updatedAt', order: 'desc' });
    let rows = [...first.data];
    for (let p = 2; p <= first.pages; p += 1) {
      const next = await this.list(db, ctx, { activeOnly: true }, { page: p, limit: 200, sort: 'updatedAt', order: 'desc' });
      rows = rows.concat(next.data);
    }
    return rows;
  }

  async list(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    const result = await DealRepository.listDeals(db, ctx, filter, options);
    const dealIds = result.data.map(d => d._id);
    const unitIds = result.data.flatMap(d => [d.unitId, ...(d.unitIds ?? [])].filter(Boolean) as string[]);
    const linked = await InteractionRepository.listByRelatedDealIds(db, ctx, dealIds);
    const [dealBuilds, unitBuilds] = await Promise.all([
      BuildRepository.listByDealIds(db, ctx, dealIds),
      BuildRepository.listByUnitIds(db, ctx, unitIds),
    ]);
    const builds = Array.from(new Map([...dealBuilds, ...unitBuilds].map(b => [b._id, b])).values());
    const changeOrders = await ChangeOrderRepository.listByBuildIds(db, ctx, builds.map(b => b._id));
    const productionJobs = await ProductionJobRepository.listByBuildIds(db, ctx, builds.map(b => b._id));
    const productionTasks = await ProductionTaskRepository.listByProductionJobIds(db, ctx, productionJobs.map(j => j._id));
    const deliveryRecords = await DeliveryRecordRepository.listByProductionJobIds(db, ctx, productionJobs.map(j => j._id));
    const drIds = deliveryRecords.map(r => r._id);
    const jobIdsFromDr = deliveryRecords.map(r => r.productionJobId);
    const [deliveryPackets, postDeliveryFollowUps, closeoutsForDeals] = await Promise.all([
      DeliveryPacketRepository.listByDeliveryRecordIds(db, ctx, drIds),
      PostDeliveryFollowUpRepository.listByDeliveryRecordIds(db, ctx, drIds),
      CloseoutChecklistRepository.listByProductionJobIds(db, ctx, jobIdsFromDr),
    ]);
    const packetByDeliveryId = new Map(deliveryPackets.map(p => [p.deliveryRecordId, p]));
    const followUpsByDeliveryId = new Map<string, Array<{ status: string; dueAt?: Date | string; followUpType?: string }>>();
    for (const f of postDeliveryFollowUps) {
      const arr = followUpsByDeliveryId.get(f.deliveryRecordId) ?? [];
      arr.push({ status: f.status, dueAt: f.dueAt, followUpType: f.followUpType });
      followUpsByDeliveryId.set(f.deliveryRecordId, arr);
    }
    const closeoutByJobId = new Map(closeoutsForDeals.map(c => [c.productionJobId, c]));
    const deliveryHandoffMaps = { packetByDeliveryId, followUpsByDeliveryId, closeoutByJobId };
    return {
      ...result,
      data: result.data.map(d => this.enrichDeal(d, linked, builds, changeOrders as any, productionJobs as any, productionTasks as any, deliveryRecords as any, deliveryHandoffMaps)),
    };
  }

  async listPipelinePressure(
    db: Db,
    ctx: TenantContext,
    filter: DealFilter & { pressureLevel?: 'low' | 'medium' | 'high' | 'critical'; q?: string },
    options: ListOptions,
  ) {
    const base = await this.list(db, ctx, { ...filter, activeOnly: true }, options);
    const q = filter.q?.toLowerCase().trim();
    let rows = base.data as Array<Record<string, unknown>>;
    if (filter.pressureLevel) {
      rows = rows.filter(r => (r.dealExecutionState as { pressureLevel?: string })?.pressureLevel === filter.pressureLevel);
    }
    if (q) {
      rows = rows.filter(r =>
        String(r.title ?? '').toLowerCase().includes(q) ||
        String(r.company ?? '').toLowerCase().includes(q) ||
        String(r.assignedTo ?? '').toLowerCase().includes(q),
      );
    }
    const grouped = {
      critical: rows.filter(r => (r.dealExecutionState as { pressureLevel?: string })?.pressureLevel === 'critical'),
      high: rows.filter(r => (r.dealExecutionState as { pressureLevel?: string })?.pressureLevel === 'high'),
      medium: rows.filter(r => (r.dealExecutionState as { pressureLevel?: string })?.pressureLevel === 'medium'),
      low: rows.filter(r => (r.dealExecutionState as { pressureLevel?: string })?.pressureLevel === 'low'),
    };
    return {
      ...base,
      data: rows,
      grouped,
    };
  }

  async listForecastReview(
    db: Db,
    ctx: TenantContext,
    filter: DealFilter & {
      confidence?: 'low' | 'medium' | 'high';
      forecastCategory?: 'commit' | 'best_case' | 'pipeline' | 'excluded';
      needsManagementReview?: boolean;
      q?: string;
    },
    options: ListOptions,
  ) {
    const base = await this.list(db, ctx, { ...filter, activeOnly: true }, options);
    let rows = base.data as Array<Record<string, unknown>>;
    if (filter.confidence) rows = rows.filter(r => (r.forecastState as { confidence?: string })?.confidence === filter.confidence);
    if (filter.forecastCategory) rows = rows.filter(r => (r.forecastState as { forecastCategory?: string })?.forecastCategory === filter.forecastCategory);
    if (typeof filter.needsManagementReview === 'boolean') {
      rows = rows.filter(r => !!(r.forecastState as { needsManagementReview?: boolean })?.needsManagementReview === filter.needsManagementReview);
    }
    const q = filter.q?.toLowerCase().trim();
    if (q) {
      rows = rows.filter(r =>
        String(r.title ?? '').toLowerCase().includes(q) ||
        String(r.company ?? '').toLowerCase().includes(q) ||
        String(r.assignedTo ?? '').toLowerCase().includes(q),
      );
    }
    const grouped = {
      needsReview: rows.filter(r => (r.forecastState as { needsManagementReview?: boolean })?.needsManagementReview),
      lowConfidence: rows.filter(r => (r.forecastState as { confidence?: string })?.confidence === 'low'),
      commit: rows.filter(r => (r.forecastState as { forecastCategory?: string })?.forecastCategory === 'commit'),
      bestCase: rows.filter(r => (r.forecastState as { forecastCategory?: string })?.forecastCategory === 'best_case'),
    };
    return { ...base, data: rows, grouped };
  }

  async getForecastStats(db: Db, ctx: TenantContext) {
    const rows = await this.listAllActiveEnriched(db, ctx) as Array<{
      forecastState?: { forecastCategory?: 'commit' | 'best_case' | 'pipeline' | 'excluded'; forecastAmount?: number; needsManagementReview?: boolean; confidence?: 'low' | 'medium' | 'high' };
      dealExecutionState?: { isStalled?: boolean };
      status: string;
    }>;
    const cats = ['commit', 'best_case', 'pipeline', 'excluded'] as const;
    const forecastCounts = {
      commit: 0, best_case: 0, pipeline: 0, excluded: 0,
    };
    const forecastAmounts = {
      commit: 0, best_case: 0, pipeline: 0, excluded: 0,
    };
    for (const r of rows) {
      const c = r.forecastState?.forecastCategory ?? 'pipeline';
      if (cats.includes(c)) {
        forecastCounts[c] += 1;
        forecastAmounts[c] += r.forecastState?.forecastAmount ?? 0;
      }
    }
    const dealsNeedingManagementReview = rows.filter(r => r.forecastState?.needsManagementReview).length;
    const lowConfidenceLateStageDeals = rows.filter(r =>
      r.forecastState?.confidence === 'low' &&
      ['Approved', 'Won', 'In Build'].includes(r.status),
    ).length;
    return { forecastCounts, forecastAmounts, dealsNeedingManagementReview, lowConfidenceLateStageDeals, rows };
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const deal = await DealRepository.findById(db, ctx, id);
    if (!deal) throw new NotFoundError('Deal');
    const linked = await InteractionRepository.listByRelatedDealIds(db, ctx, [id]);
    const [dealBuilds, unitBuilds] = await Promise.all([
      BuildRepository.listByDealIds(db, ctx, [id]),
      BuildRepository.listByUnitIds(db, ctx, [deal.unitId, ...(deal.unitIds ?? [])].filter(Boolean) as string[]),
    ]);
    const builds = Array.from(new Map([...dealBuilds, ...unitBuilds].map(b => [b._id, b])).values());
    const changeOrders = await ChangeOrderRepository.listByBuildIds(db, ctx, builds.map(b => b._id));
    const productionJobs = await ProductionJobRepository.listByBuildIds(db, ctx, builds.map(b => b._id));
    const productionTasks = await ProductionTaskRepository.listByProductionJobIds(db, ctx, productionJobs.map(j => j._id));
    const deliveryRecords = await DeliveryRecordRepository.listByProductionJobIds(db, ctx, productionJobs.map(j => j._id));
    const drIds = deliveryRecords.map(r => r._id);
    const jobIdsFromDr = deliveryRecords.map(r => r.productionJobId);
    const [deliveryPackets, postDeliveryFollowUps, closeoutsForDeals] = await Promise.all([
      DeliveryPacketRepository.listByDeliveryRecordIds(db, ctx, drIds),
      PostDeliveryFollowUpRepository.listByDeliveryRecordIds(db, ctx, drIds),
      CloseoutChecklistRepository.listByProductionJobIds(db, ctx, jobIdsFromDr),
    ]);
    const packetByDeliveryId = new Map(deliveryPackets.map(p => [p.deliveryRecordId, p]));
    const followUpsByDeliveryId = new Map<string, Array<{ status: string; dueAt?: Date | string; followUpType?: string }>>();
    for (const f of postDeliveryFollowUps) {
      const arr = followUpsByDeliveryId.get(f.deliveryRecordId) ?? [];
      arr.push({ status: f.status, dueAt: f.dueAt, followUpType: f.followUpType });
      followUpsByDeliveryId.set(f.deliveryRecordId, arr);
    }
    const closeoutByJobId = new Map(closeoutsForDeals.map(c => [c.productionJobId, c]));
    return this.enrichDeal(deal, linked, builds as any, changeOrders as any, productionJobs as any, productionTasks as any, deliveryRecords as any, {
      packetByDeliveryId,
      followUpsByDeliveryId,
      closeoutByJobId,
    });
  }

  async listInteractionsForDeal(db: Db, ctx: TenantContext, id: string) {
    const deal = await DealRepository.findById(db, ctx, id);
    if (!deal) throw new NotFoundError('Deal');
    const linked = await InteractionRepository.listByRelatedDealIds(db, ctx, [id]);
    return linked;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateDealPayload) {
    // Always derive a valid slug-format tenantId; never fall back to raw entity name
    const tenantId   = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    // Default to the authenticated user's name if no assignedTo provided
    const assignedTo = payload.assignedTo?.trim() || ctx.userName;

    // Unit-deal uniqueness guard: block if another active deal already claims this unit
    if (payload.unitId) {
      const conflict = await DealRepository.findActiveByUnitId(db, { ...ctx, tenantId } as typeof ctx, payload.unitId);
      if (conflict) {
        throw new ConflictError(`Unit is already attached to an active deal: "${conflict.title}"`);
      }
    }

    const company = await identityIntegrityService.resolveCanonicalCompany(db, { ...ctx, tenantId }, {
      companyId: (payload as any).companyId,
      companyName: payload.company,
    });
    const deal = await DealRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      companyId: company._id,
      company: company.name,
      unitIds: Array.from(new Set([...(payload.unitIds ?? []), ...(payload.unitId ? [payload.unitId] : [])])),
      primaryUnitId: payload.primaryUnitId ?? payload.unitId,
      assignedTo,
      ownerUserId: payload.ownerUserId ?? ctx.userId,
      lastStageChangeAt: new Date(),
      tenantId,
      createdAt:     new Date(),
      updatedAt:     new Date(),
      lastTouchedAt: new Date(),
    });

    // Auto-convert the originating lead when a deal is created from one
    if (payload.leadId) {
      await LeadRepository.updateOne(db, ctx, payload.leadId, { status: 'Converted' } as never)
        .catch(err => console.error(`[DealService] Failed to convert lead ${payload.leadId}:`, err));
    }

    return deal;
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateDealPayload>) {
    const before = await DealRepository.findById(db, ctx, id);
    if (!before) throw new NotFoundError('Deal');

    if ((payload as any).companyId || payload.company) {
      const company = await identityIntegrityService.resolveCanonicalCompany(db, ctx, {
        companyId: (payload as any).companyId,
        companyName: payload.company ?? before.company,
      });
      (payload as any).companyId = company._id;
      payload.company = company.name;
    }

    if (payload.atRisk !== undefined) {
      const isOwner = before.ownerUserId === ctx.userId;
      const isAdmin = ctx.userRole === 'admin' || ctx.userRole === 'super_admin';
      if (!isOwner && !isAdmin) throw new ValidationError('Only owner/admin can modify atRisk');
      if (payload.atRisk.flagged) {
        payload.atRisk = {
          ...payload.atRisk,
          flagged: true,
          flaggedAt: new Date().toISOString(),
          flaggedByUserId: ctx.userId,
          flaggedByName: ctx.userName,
        };
      } else {
        payload.atRisk = { flagged: false };
      }
    }
    if (payload.managementReview !== undefined) {
      const isAdmin = ctx.userRole === 'admin' || ctx.userRole === 'super_admin' || ctx.userRole === 'management';
      if (!isAdmin) throw new ValidationError('Only management/admin can modify managementReview');
      if (payload.managementReview.status) {
        payload.managementReview = {
          ...payload.managementReview,
          reviewedAt: new Date().toISOString(),
          reviewedByUserId: ctx.userId,
          reviewedByName: ctx.userName,
        };
      }
    }

    // Validate stage gate before writing anything
    validateTransition(before, payload);

    // Unit-deal uniqueness guard on updates:
    // Run when (a) unitId is being set/changed, or (b) status is moving from
    // a terminal state back to an active state with a unitId already on the deal.
    const incomingUnitId  = payload.unitId !== undefined ? payload.unitId : before.unitId;
    if (payload.unitIds || payload.primaryUnitId || payload.unitId) {
      const merged = Array.from(new Set([
        ...(payload.unitIds ?? before.unitIds ?? []),
        ...(payload.unitId ? [payload.unitId] : []),
      ]));
      payload.unitIds = merged;
      payload.primaryUnitId = payload.primaryUnitId ?? payload.unitId ?? before.primaryUnitId ?? merged[0];
    }
    const incomingStatus  = payload.status ?? before.status;
    const closedStatuses: DealStatus[] = ['Delivered', 'Lost'];
    const wasActive       = !closedStatuses.includes(before.status);
    const willBeActive    = !closedStatuses.includes(incomingStatus);
    const unitIdChanging  = payload.unitId !== undefined && payload.unitId !== before.unitId;

    if (incomingUnitId && willBeActive && (unitIdChanging || (!wasActive && willBeActive))) {
      const conflict = await DealRepository.findActiveByUnitId(db, ctx, incomingUnitId, id);
      if (conflict) {
        throw new ConflictError(`Unit is already attached to an active deal: "${conflict.title}"`);
      }
    }

    // Set lastTouchedAt when any meaningful business field is being changed
    const TOUCH_FIELDS = ['status', 'assignedTo', 'notes', 'amount', 'unitId', 'leadId'] as const;
    const isTouched = TOUCH_FIELDS.some(f => f in payload);
    const stageChanged = payload.status !== undefined && payload.status !== before.status;
    const update = isTouched ? { ...payload, lastTouchedAt: new Date(), ...(stageChanged ? { lastStageChangeAt: new Date() } : {}) } : payload;

    const deal = await DealRepository.updateOne(db, ctx, id, update as never);
    if (!deal) throw new NotFoundError('Deal');

    const tenantId = deal['tenantId'] as string;
    if (payload.status && payload.status !== before.status) {
      // Sync linked unit status on key transitions
      const unitId           = (deal['unitId'] ?? before.unitId) as string | undefined;
      const targetUnitStatus = DEAL_TO_UNIT_STATUS[payload.status];
      if (unitId && targetUnitStatus) {
        await UnitRepository.updateOne(db, ctx, unitId, { status: targetUnitStatus } as never)
          .catch(err => console.error(`[DealService] Failed to sync unit ${unitId} status:`, err));
      }

      // Fire domain events
      if (payload.status === 'Won') {
        void eventBus.emit({ type: 'deal.won', dealId: id, tenantId, amount: deal['amount'] as number }, db);
      } else if (payload.status === 'Approved') {
        void eventBus.emit({ type: 'deal.approved', dealId: id, approver: ctx.defaultEntity, tenantId }, db);
      } else if (payload.status === 'In Build') {
        void eventBus.emit({ type: 'deal.in_build', dealId: id, tenantId }, db);
      } else if (payload.status === 'Delivered') {
        void eventBus.emit({ type: 'deal.delivered', dealId: id, tenantId }, db);
      }
    }

    return deal;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await DealRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Deal');
  }
}

export const dealService = new DealService();
