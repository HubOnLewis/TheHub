// packages/api/src/services/DealService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository, type DealDoc, type DealFilter } from '../repositories/DealRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { UnitRepository } from '../repositories/UnitRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateDealPayload, DealStatus, UnitStatus } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError, ValidationError, ConflictError } from '../errors/index.js';
import { eventBus } from '../jobs/index.js';

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
  'Won':       'Reserved',
  'In Build':  'In Build',
  'Delivered': 'Delivered',
};

export class DealService {
  async list(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    return DealRepository.listDeals(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const deal = await DealRepository.findById(db, ctx, id);
    if (!deal) throw new NotFoundError('Deal');
    return deal;
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

    const deal = await DealRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      assignedTo,
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

    // Validate stage gate before writing anything
    validateTransition(before, payload);

    // Unit-deal uniqueness guard on updates:
    // Run when (a) unitId is being set/changed, or (b) status is moving from
    // a terminal state back to an active state with a unitId already on the deal.
    const incomingUnitId  = payload.unitId !== undefined ? payload.unitId : before.unitId;
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
    const update = isTouched ? { ...payload, lastTouchedAt: new Date() } : payload;

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
