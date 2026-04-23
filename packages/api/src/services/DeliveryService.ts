import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { DeliveryRecordRepository } from '../repositories/DeliveryRecordRepository.js';
import { CloseoutChecklistRepository } from '../repositories/CloseoutChecklistRepository.js';
import { ProductionJobRepository } from '../repositories/ProductionJobRepository.js';
import { ProductionTaskRepository } from '../repositories/ProductionTaskRepository.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { UnitRepository } from '../repositories/UnitRepository.js';
import { DeliveryPacketRepository, type DeliveryPacketDoc } from '../repositories/DeliveryPacketRepository.js';
import { PostDeliveryFollowUpRepository, type PostDeliveryFollowUpDoc } from '../repositories/PostDeliveryFollowUpRepository.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/index.js';
import { deliveryReadinessService } from './DeliveryReadinessService.js';
import { deliveryHandoffService } from './DeliveryHandoffService.js';
import type {
  CreateDeliveryRecordPayload,
  PatchDeliveryRecordPayload,
  CreateCloseoutChecklistPayload,
  PatchCloseoutChecklistPayload,
  CreateDeliveryPacketPayload,
  PatchDeliveryPacketPayload,
  CreatePostDeliveryFollowUpPayload,
  PatchPostDeliveryFollowUpPayload,
} from '@mtte-core/shared';
import { identityIntegrityService } from './IdentityIntegrityService.js';

const DEFAULT_CHECK_IN_DAYS = 7;

function closeoutComplete(closeout: {
  finalInspectionComplete?: boolean;
  customerFacingDocsComplete?: boolean;
  photosComplete?: boolean;
  punchItemsResolved?: boolean;
} | null): boolean {
  if (!closeout) return false;
  return !!(
    closeout.finalInspectionComplete &&
    closeout.customerFacingDocsComplete &&
    closeout.photosComplete &&
    closeout.punchItemsResolved
  );
}

function packetIssueReady(packet: DeliveryPacketDoc): boolean {
  return !!(
    packet.deliveredVersionId &&
    packet.includesPhotos &&
    packet.includesFinalSpecSummary &&
    packet.includesCustomerDocs &&
    packet.includesKeyContacts
  );
}

export class DeliveryService {
  private async attachHandoffBatch(
    db: Db,
    ctx: TenantContext,
    rows: Array<Record<string, unknown>>,
  ) {
    const ids = rows.map(r => r._id as string).filter(Boolean);
    if (ids.length === 0) return rows;
    const [packets, followUps] = await Promise.all([
      DeliveryPacketRepository.listByDeliveryRecordIds(db, ctx, ids),
      PostDeliveryFollowUpRepository.listByDeliveryRecordIds(db, ctx, ids),
    ]);
    const packetByDelivery = new Map(packets.map(p => [p.deliveryRecordId, p]));
    const followUpsByDelivery = new Map<string, PostDeliveryFollowUpDoc[]>();
    for (const f of followUps) {
      const list = followUpsByDelivery.get(f.deliveryRecordId) ?? [];
      list.push(f);
      followUpsByDelivery.set(f.deliveryRecordId, list);
    }
    return rows.map(r => {
      const id = r._id as string;
      const packet = packetByDelivery.get(id) ?? null;
      const fu = followUpsByDelivery.get(id) ?? [];
      const closeout = r.closeoutChecklist as Parameters<typeof deliveryHandoffService.evaluate>[1];
      const deliveryHandoffState = deliveryHandoffService.evaluate(
        { status: String(r.status) },
        closeout,
        packet,
      );
      return { ...r, deliveryPacket: packet, postDeliveryFollowUps: fu, deliveryHandoffState };
    });
  }

  async list(db: Db, ctx: TenantContext, filter: { status?: any; productionJobId?: string; buildId?: string; companyId?: string; q?: string }, options: { page: number; limit: number; sort: string; order: 'asc' | 'desc' }) {
    const base = filter.companyId
      ? await DeliveryRecordRepository.listByCompanyId(db, ctx, filter.companyId, { status: filter.status, q: filter.q }, options)
      : await DeliveryRecordRepository.listRecords(db, ctx, filter, options);
    const jobIds = base.data.map(x => x.productionJobId);
    const [jobs, tasks, closeouts, builds, units] = await Promise.all([
      Promise.all(jobIds.map(id => ProductionJobRepository.findById(db, ctx, id))),
      ProductionTaskRepository.listByProductionJobIds(db, ctx, jobIds),
      Promise.all(jobIds.map(id => CloseoutChecklistRepository.findByProductionJobId(db, ctx, id))),
      BuildRepository.listByUnitIds(db, ctx, base.data.map(x => x.unitId)),
      Promise.all(base.data.map(x => UnitRepository.findById(db, ctx, x.unitId))),
    ]);
    const jobById = new Map(jobs.filter(Boolean).map(j => [j!._id, j!]));
    const closeoutByJob = new Map(closeouts.filter(Boolean).map(c => [c!.productionJobId, c!]));
    const buildById = new Map(builds.map(b => [b._id, b]));
    const unitById = new Map(units.filter(Boolean).map(u => [u!._id, u!]));
    const rows = base.data.map(r => {
      const job = jobById.get(r.productionJobId);
      const closeout = closeoutByJob.get(r.productionJobId) ?? null;
      const readiness = deliveryReadinessService.evaluate(job as any, tasks.filter(t => t.productionJobId === r.productionJobId) as any, closeout as any);
      return { ...r, productionJob: job, build: buildById.get(r.buildId), unit: unitById.get(r.unitId), closeoutChecklist: closeout, deliveryReadiness: readiness };
    });
    const enriched = await this.attachHandoffBatch(db, ctx, rows as Array<Record<string, unknown>>);
    return { ...base, data: enriched };
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const row = await DeliveryRecordRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('DeliveryRecord');
    const [job, build, unit, tasks, closeout, packet, followUps] = await Promise.all([
      ProductionJobRepository.findById(db, ctx, row.productionJobId),
      BuildRepository.findById(db, ctx, row.buildId),
      UnitRepository.findById(db, ctx, row.unitId),
      ProductionTaskRepository.listTasks(db, ctx, { productionJobId: row.productionJobId }, { page: 1, limit: 500, sort: 'sequence', order: 'asc' }),
      CloseoutChecklistRepository.findByProductionJobId(db, ctx, row.productionJobId),
      DeliveryPacketRepository.findByDeliveryRecordId(db, ctx, id),
      PostDeliveryFollowUpRepository.listByDeliveryRecordId(db, ctx, id),
    ]);
    if (!job) throw new NotFoundError('ProductionJob');
    const deliveryReadiness = deliveryReadinessService.evaluate(job as any, tasks.data as any, closeout as any);
    const deliveryHandoffState = deliveryHandoffService.evaluate(
      { status: row.status },
      closeout as any,
      packet,
    );
    return {
      ...row,
      productionJob: job,
      build,
      unit,
      tasks: tasks.data,
      closeoutChecklist: closeout,
      deliveryReadiness,
      deliveryPacket: packet,
      postDeliveryFollowUps: followUps,
      deliveryHandoffState,
      customerHandoffSummary: {
        unitLabel: unit ? `${unit.year ?? ''} ${unit.make} ${unit.model}`.trim() : row.unitId,
        buildName: build?.name ?? row.buildId,
        deliveredVersionId: packet?.deliveredVersionId ?? job.buildVersionId,
        packetStatus: packet?.status ?? 'none',
        followUps: followUps.map(f => ({
          _id: f._id,
          followUpType: f.followUpType,
          status: f.status,
          dueAt: f.dueAt instanceof Date ? f.dueAt.toISOString() : f.dueAt,
        })),
      },
    };
  }

  async create(db: Db, ctx: TenantContext, payload: CreateDeliveryRecordPayload) {
    const chain = await identityIntegrityService.validateDeliveryChain(db, ctx, {
      productionJobId: payload.productionJobId,
      buildId: payload.buildId,
      unitId: payload.unitId,
      dealId: payload.dealId,
      companyId: payload.companyId,
    });
    const out = await DeliveryRecordRepository.insertOne(db, ctx, {
      ...payload,
      companyId: payload.companyId ?? chain.companyId,
      tenantId: chain.job.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    return out;
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: PatchDeliveryRecordPayload) {
    const existing = await DeliveryRecordRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('DeliveryRecord');
    const [job, tasks, closeout] = await Promise.all([
      ProductionJobRepository.findById(db, ctx, existing.productionJobId),
      ProductionTaskRepository.listTasks(db, ctx, { productionJobId: existing.productionJobId }, { page: 1, limit: 500, sort: 'sequence', order: 'asc' }),
      CloseoutChecklistRepository.findByProductionJobId(db, ctx, existing.productionJobId),
    ]);
    if (!job) throw new NotFoundError('ProductionJob');
    const readiness = deliveryReadinessService.evaluate(job as any, tasks.data as any, closeout as any);
    if (payload.status === 'ready_for_delivery' && !readiness.isReady) throw new ValidationError('Cannot mark ready_for_delivery until readiness criteria are met');
    if (payload.status === 'scheduled' && !payload.scheduledDeliveryDate && !existing.scheduledDeliveryDate) throw new ValidationError('scheduledDeliveryDate required when scheduling delivery');
    if (payload.status === 'delivered' && !payload.actualDeliveryDate && !existing.actualDeliveryDate) throw new ValidationError('actualDeliveryDate required when marking delivered');
    const out = await DeliveryRecordRepository.updateOne(db, ctx, id, payload as never);
    if (!out) throw new NotFoundError('DeliveryRecord');
    if (payload.status === 'delivered' && existing.status !== 'delivered') {
      await UnitRepository.updateOne(db, ctx, existing.unitId, { status: 'delivered' } as never);
      await this.ensureDefaultPostDeliveryCheckIn(db, ctx, out);
    }
    return out;
  }

  private async ensureDefaultPostDeliveryCheckIn(db: Db, ctx: TenantContext, delivery: { _id: string; companyId?: string; unitId: string; buildId: string; dealId?: string; tenantId: string }) {
    const existing = await PostDeliveryFollowUpRepository.findActiveCheckIn(db, ctx, delivery._id);
    if (existing) return;
    const unit = await UnitRepository.findById(db, ctx, delivery.unitId);
    const companyId = delivery.companyId ?? unit?.companyId;
    if (!companyId) return;
    const due = new Date();
    due.setDate(due.getDate() + DEFAULT_CHECK_IN_DAYS);
    await PostDeliveryFollowUpRepository.insertOne(db, ctx, {
      tenantId: delivery.tenantId,
      deliveryRecordId: delivery._id,
      companyId,
      unitId: delivery.unitId,
      buildId: delivery.buildId,
      dealId: delivery.dealId,
      status: 'pending',
      followUpType: 'check_in',
      dueAt: due,
      ownerUserId: ctx.userId,
      ownerName: ctx.userName,
      notes: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async getOrCreateCloseout(db: Db, ctx: TenantContext, productionJobId: string) {
    const existing = await CloseoutChecklistRepository.findByProductionJobId(db, ctx, productionJobId);
    if (existing) return existing;
    const job = await ProductionJobRepository.findById(db, ctx, productionJobId);
    if (!job) throw new NotFoundError('ProductionJob');
    return CloseoutChecklistRepository.insertOne(db, ctx, {
      tenantId: job.tenantId,
      productionJobId,
      finalInspectionComplete: false,
      customerFacingDocsComplete: false,
      photosComplete: false,
      punchItemsResolved: false,
      punchItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async updateCloseout(db: Db, ctx: TenantContext, productionJobId: string, payload: PatchCloseoutChecklistPayload | CreateCloseoutChecklistPayload) {
    const existing = await this.getOrCreateCloseout(db, ctx, productionJobId);
    const punchItems = (payload as any).punchItems ?? existing.punchItems;
    const punchItemsResolved = (payload as any).punchItemsResolved ?? punchItems.every((p: any) => p.status === 'resolved');
    const finalInspectionComplete = (payload as any).finalInspectionComplete ?? existing.finalInspectionComplete;
    const customerFacingDocsComplete = (payload as any).customerFacingDocsComplete ?? existing.customerFacingDocsComplete;
    const photosComplete = (payload as any).photosComplete ?? existing.photosComplete;
    const completed = finalInspectionComplete && customerFacingDocsComplete && photosComplete && punchItemsResolved;
    const out = await CloseoutChecklistRepository.updateOne(db, ctx, existing._id, {
      ...payload,
      punchItems,
      punchItemsResolved,
      completedAt: completed ? new Date().toISOString() : undefined,
      completedByUserId: completed ? ctx.userId : undefined,
      completedByName: completed ? ctx.userName : undefined,
    } as never);
    if (!out) throw new NotFoundError('CloseoutChecklist');
    return out;
  }

  async getPacket(db: Db, ctx: TenantContext, deliveryRecordId: string) {
    const dr = await DeliveryRecordRepository.findById(db, ctx, deliveryRecordId);
    if (!dr) throw new NotFoundError('DeliveryRecord');
    return DeliveryPacketRepository.findByDeliveryRecordId(db, ctx, deliveryRecordId);
  }

  async createPacket(db: Db, ctx: TenantContext, deliveryRecordId: string, body: CreateDeliveryPacketPayload) {
    const dr = await DeliveryRecordRepository.findById(db, ctx, deliveryRecordId);
    if (!dr) throw new NotFoundError('DeliveryRecord');
    const dup = await DeliveryPacketRepository.findByDeliveryRecordId(db, ctx, deliveryRecordId);
    if (dup) throw new ConflictError('Delivery packet already exists for this delivery record');
    const job = await ProductionJobRepository.findById(db, ctx, dr.productionJobId);
    if (!job) throw new NotFoundError('ProductionJob');
    const deliveredVersionId = body.deliveredVersionId?.trim() || job.buildVersionId;
    if (!deliveredVersionId) throw new ValidationError('deliveredVersionId could not be resolved; production job must have buildVersionId');
    const companyId = dr.companyId ?? (await UnitRepository.findById(db, ctx, dr.unitId))?.companyId;
    if (!companyId) throw new ValidationError('companyId is required on delivery record or unit');
    return DeliveryPacketRepository.insertOne(db, ctx, {
      tenantId: dr.tenantId,
      deliveryRecordId,
      productionJobId: dr.productionJobId,
      buildId: dr.buildId,
      unitId: dr.unitId,
      companyId,
      dealId: dr.dealId,
      status: 'draft',
      deliveredVersionId,
      summary: body.summary,
      deliveryNotes: body.deliveryNotes,
      includesPhotos: body.includesPhotos,
      includesFinalSpecSummary: body.includesFinalSpecSummary,
      includesCustomerDocs: body.includesCustomerDocs,
      includesKeyContacts: body.includesKeyContacts,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async updatePacket(db: Db, ctx: TenantContext, deliveryRecordId: string, body: PatchDeliveryPacketPayload) {
    const dr = await DeliveryRecordRepository.findById(db, ctx, deliveryRecordId);
    if (!dr) throw new NotFoundError('DeliveryRecord');
    const packet = await DeliveryPacketRepository.findByDeliveryRecordId(db, ctx, deliveryRecordId);
    if (!packet) throw new NotFoundError('DeliveryPacket');
    const closeout = await CloseoutChecklistRepository.findByProductionJobId(db, ctx, dr.productionJobId);
    if (body.status === 'ready') {
      // Rule: delivery record must exist (always true); optional sanity — record not abandoned
      if (!dr._id) throw new ValidationError('Invalid delivery record');
    }
    if (body.status === 'issued') {
      if (!['delivered', 'closed'].includes(dr.status)) {
        throw new ValidationError('Packet can only be issued after delivery is marked delivered or closed');
      }
      if (!closeoutComplete(closeout)) {
        throw new ValidationError('Closeout must be complete before issuing customer packet');
      }
      const merged: DeliveryPacketDoc = { ...packet, ...body } as DeliveryPacketDoc;
      if (!packetIssueReady(merged)) {
        throw new ValidationError('Packet must include photos, final spec summary, customer docs, key contacts, and deliveredVersionId before issuance');
      }
      await DeliveryPacketRepository.updateOne(db, ctx, packet._id, {
        ...body,
        issuedAt: new Date().toISOString(),
        issuedByUserId: ctx.userId,
        issuedByName: ctx.userName,
      } as never);
    } else {
      await DeliveryPacketRepository.updateOne(db, ctx, packet._id, body as never);
    }
    return DeliveryPacketRepository.findByDeliveryRecordId(db, ctx, deliveryRecordId);
  }

  async listPostDeliveryFollowUps(db: Db, ctx: TenantContext, deliveryRecordId: string) {
    const dr = await DeliveryRecordRepository.findById(db, ctx, deliveryRecordId);
    if (!dr) throw new NotFoundError('DeliveryRecord');
    return PostDeliveryFollowUpRepository.listByDeliveryRecordId(db, ctx, deliveryRecordId);
  }

  async createPostDeliveryFollowUp(db: Db, ctx: TenantContext, deliveryRecordId: string, body: CreatePostDeliveryFollowUpPayload) {
    const dr = await DeliveryRecordRepository.findById(db, ctx, deliveryRecordId);
    if (!dr) throw new NotFoundError('DeliveryRecord');
    const companyId = dr.companyId ?? (await UnitRepository.findById(db, ctx, dr.unitId))?.companyId;
    if (!companyId) throw new ValidationError('companyId required');
    if (body.followUpType === 'check_in') {
      const active = await PostDeliveryFollowUpRepository.findActiveCheckIn(db, ctx, deliveryRecordId);
      if (active) throw new ConflictError('An active check-in follow-up already exists for this delivery');
    }
    const dueAt = body.dueAt ? new Date(body.dueAt) : undefined;
    return PostDeliveryFollowUpRepository.insertOne(db, ctx, {
      tenantId: dr.tenantId,
      deliveryRecordId,
      companyId,
      unitId: dr.unitId,
      buildId: dr.buildId,
      dealId: dr.dealId,
      status: body.status,
      followUpType: body.followUpType,
      dueAt,
      ownerUserId: body.ownerUserId ?? ctx.userId,
      ownerName: body.ownerName ?? ctx.userName,
      notes: body.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async updatePostDeliveryFollowUp(db: Db, ctx: TenantContext, followUpId: string, body: PatchPostDeliveryFollowUpPayload) {
    const row = await PostDeliveryFollowUpRepository.findById(db, ctx, followUpId);
    if (!row) throw new NotFoundError('PostDeliveryFollowUp');
    const patch: Record<string, unknown> = { ...body };
    if (body.dueAt !== undefined) patch.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.completedAt !== undefined) patch.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    if (body.status === 'completed' && !patch.completedAt) patch.completedAt = new Date();
    return PostDeliveryFollowUpRepository.updateOne(db, ctx, followUpId, patch as never);
  }

  async counts(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx, {}, { page: 1, limit: 5000, sort: 'updatedAt', order: 'desc' });
    const list = rows.data as Array<any>;
    const completedProduction = list.filter(r => r.productionJob?.status === 'completed');
    return {
      pending: list.filter(r => r.status === 'pending').length,
      readyForDelivery: list.filter(r => r.status === 'ready_for_delivery').length,
      scheduled: list.filter(r => r.status === 'scheduled').length,
      delivered: list.filter(r => r.status === 'delivered').length,
      closed: list.filter(r => r.status === 'closed').length,
      notReadyWithCompletedProduction: completedProduction.filter(r => !r.deliveryReadiness?.isReady).length,
    };
  }

  async handoffCounts(db: Db, ctx: TenantContext) {
    const rows = (await this.list(db, ctx, {}, { page: 1, limit: 5000, sort: 'updatedAt', order: 'desc' })).data as Array<any>;
    const now = Date.now();
    const packets = rows.map(r => r.deliveryPacket).filter(Boolean);
    const allFollowUps = rows.flatMap(r => r.postDeliveryFollowUps ?? []);
    const deliveredRows = rows.filter(r => r.status === 'delivered' || r.status === 'closed');
    return {
      packetsDraft: packets.filter((p: any) => p.status === 'draft').length,
      packetsReady: packets.filter((p: any) => p.status === 'ready').length,
      packetsIssued: packets.filter((p: any) => p.status === 'issued').length,
      deliveredWithoutIssuedPacket: deliveredRows.filter(r => !r.deliveryPacket || r.deliveryPacket.status !== 'issued').length,
      pendingPostDeliveryFollowUps: allFollowUps.filter((f: any) => f.status === 'pending' || f.status === 'scheduled').length,
      overduePostDeliveryFollowUps: allFollowUps.filter((f: any) =>
        (f.status === 'pending' || f.status === 'scheduled') &&
        f.dueAt &&
        new Date(f.dueAt).getTime() < now,
      ).length,
    };
  }

  /** Account-level customer delivery + post-delivery context (canonical companyId). */
  async companyHandoffContext(db: Db, ctx: TenantContext, companyId: string) {
    const deliveries = await DeliveryRecordRepository.listByCompanyId(db, ctx, companyId, {}, { page: 1, limit: 100, sort: 'updatedAt', order: 'desc' });
    const jobIds = deliveries.data.map(d => d.productionJobId);
    const [jobs, closeouts] = await Promise.all([
      Promise.all(jobIds.map(id => ProductionJobRepository.findById(db, ctx, id))),
      Promise.all(jobIds.map(id => CloseoutChecklistRepository.findByProductionJobId(db, ctx, id))),
    ]);
    const jobById = new Map(jobs.filter(Boolean).map(j => [j!._id, j!]));
    const closeoutByJob = new Map(closeouts.filter(Boolean).map(c => [c!.productionJobId, c!]));
    const ids = deliveries.data.map(d => d._id);
    const [packets, followUps, builds, units] = await Promise.all([
      DeliveryPacketRepository.listByDeliveryRecordIds(db, ctx, ids),
      PostDeliveryFollowUpRepository.listByDeliveryRecordIds(db, ctx, ids),
      BuildRepository.listByUnitIds(db, ctx, deliveries.data.map(d => d.unitId)),
      Promise.all(deliveries.data.map(d => UnitRepository.findById(db, ctx, d.unitId))),
    ]);
    const packetBy = new Map(packets.map(p => [p.deliveryRecordId, p]));
    const buildById = new Map(builds.map(b => [b._id, b]));
    const unitById = new Map(units.filter(Boolean).map(u => [u!._id, u!]));

    const recentDelivered = deliveries.data
      .filter(d => d.status === 'delivered' || d.status === 'closed')
      .slice(0, 10)
      .map(d => {
        const job = jobById.get(d.productionJobId);
        const co = closeoutByJob.get(d.productionJobId);
        const packet = packetBy.get(d._id);
        const u = unitById.get(d.unitId);
        const b = buildById.get(d.buildId);
        return {
          deliveryRecordId: d._id,
          status: d.status,
          unitSummary: u ? `${u.year ?? ''} ${u.make} ${u.model}`.trim() : d.unitId,
          buildName: b?.name ?? d.buildId,
          deliveredVersionId: packet?.deliveredVersionId ?? job?.buildVersionId,
          packetStatus: packet?.status ?? 'none',
          deliveryHandoffState: deliveryHandoffService.evaluate({ status: d.status }, co as any, packet),
        };
      });

    const pendingFollowUps = followUps.filter(f => f.status === 'pending' || f.status === 'scheduled');
    const customerHandoffWarnings: string[] = [];
    for (const d of deliveries.data) {
      if (d.status !== 'delivered' && d.status !== 'closed') continue;
      const packet = packetBy.get(d._id);
      const co = closeoutByJob.get(d.productionJobId);
      if (!packet || packet.status !== 'issued') customerHandoffWarnings.push('Customer handoff packet not issued');
      if (!closeoutComplete(co as any)) customerHandoffWarnings.push('Poor delivery closeout may weaken account confidence');
    }
    const overdueFollowUp = pendingFollowUps.find(f => f.dueAt && new Date(f.dueAt).getTime() < Date.now());
    if (overdueFollowUp) customerHandoffWarnings.push('Post-delivery follow-up is overdue');

    const expansionSignal = recentDelivered.some(r => r.packetStatus === 'issued');
    return {
      recentDeliveredUnits: recentDelivered,
      pendingPostDeliveryFollowUps: pendingFollowUps.map(f => ({
        _id: f._id,
        deliveryRecordId: f.deliveryRecordId,
        followUpType: f.followUpType,
        status: f.status,
        dueAt: f.dueAt instanceof Date ? f.dueAt.toISOString() : f.dueAt,
        ownerName: f.ownerName,
      })),
      customerHandoffWarnings: Array.from(new Set(customerHandoffWarnings)),
      recentDeliveryExpansionSignal: expansionSignal,
    };
  }
}

export const deliveryService = new DeliveryService();
