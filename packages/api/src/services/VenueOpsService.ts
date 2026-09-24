import type { Db } from 'mongodb';
import {
  applyVenueOpsAction,
  applyVenueOpsAssignment,
  evaluateVenueOps,
  isFollowUpKind,
  summarizeVenueOps,
  type VenueOpsTask,
} from '@hub-crm/shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { DealRepository, type DealDoc } from '../repositories/DealRepository.js';
import { InteractionRepository, type InteractionDoc } from '../repositories/InteractionRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import { playbookService } from './PlaybookService.js';

const DAY_MS = 86_400_000;

function asDealInput(deal: DealDoc & { _id: string }) {
  return {
    _id: String(deal._id),
    title: deal.title,
    contact: deal.contact,
    status: deal.status,
    amount: deal.amount,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    lastTouchedAt: deal.lastTouchedAt,
    importMeta: deal.importMeta,
  };
}

export class VenueOpsService {
  async listQueue(db: Db, ctx: TenantContext, nowMs = Date.now()): Promise<{
    tasks: VenueOpsTask[];
    summary: ReturnType<typeof summarizeVenueOps>;
    asOf: string;
  }> {
    const listed = await DealRepository.listDeals(
      db,
      ctx,
      { activeOnly: true },
      { page: 1, limit: 500, sort: 'updatedAt', order: 'desc' },
    );
    const tasks = (listed.data as Array<DealDoc & { _id: string }>).flatMap(deal =>
      evaluateVenueOps(asDealInput(deal), nowMs),
    );
    return {
      tasks,
      summary: summarizeVenueOps(tasks),
      asOf: new Date(nowMs).toISOString(),
    };
  }

  async assignTask(
    db: Db,
    ctx: TenantContext,
    input: { dealId: string; taskId: string; assignee: { type: 'user' | 'agent' | 'unassigned'; id: string; name: string }; reason?: string },
  ) {
    const deal = await DealRepository.findById(db, ctx, input.dealId);
    if (!deal) throw new NotFoundError('Event');
    if (!input.taskId.includes(input.dealId)) throw new ValidationError('Task does not belong to this event');
    const meta = deal.importMeta && typeof deal.importMeta === 'object' ? { ...deal.importMeta } : {};
    const next = applyVenueOpsAssignment(meta, input.taskId, {
      ...input.assignee,
      reason: input.reason?.trim() || 'Manually assigned',
      at: new Date().toISOString(),
      by: ctx.userName,
    });
    const updated = await DealRepository.updateOne(db, ctx, input.dealId, { importMeta: next } as never);
    if (!updated) throw new NotFoundError('Event');
    return updated;
  }

  async applyTaskAction(
    db: Db,
    ctx: TenantContext,
    input: { dealId: string; taskId: string; action: 'complete' | 'snooze'; snoozeDays?: number },
  ) {
    const deal = await DealRepository.findById(db, ctx, input.dealId);
    if (!deal) throw new NotFoundError('Event');
    if (!input.taskId.includes(input.dealId)) {
      throw new ValidationError('Task does not belong to this event');
    }
    const now = new Date();
    const playbookTaskId = input.taskId.startsWith(`playbook:${input.dealId}:`)
      ? input.taskId.slice(`playbook:${input.dealId}:`.length)
      : undefined;
    if (input.action === 'complete' && playbookTaskId) {
      await playbookService.setTaskStatus(db, ctx, input.dealId, playbookTaskId, 'done');
    }
    if (input.action === 'complete' && input.taskId.startsWith(`beo_missing:${input.dealId}`)) {
      await playbookService.snapshotBeo(db, ctx, input.dealId, ctx.userName);
    }
    const fresh = await DealRepository.findById(db, ctx, input.dealId);
    if (!fresh) throw new NotFoundError('Event');
    const meta =
      fresh.importMeta && typeof fresh.importMeta === 'object' ? { ...fresh.importMeta } : {};
    const next = applyVenueOpsAction(meta, input.taskId, {
      status: input.action === 'complete' ? 'done' : 'snoozed',
      at: now.toISOString(),
      by: ctx.userName,
      snoozeUntil:
        input.action === 'snooze'
          ? new Date(now.getTime() + (input.snoozeDays ?? 2) * DAY_MS).toISOString()
          : undefined,
    });
    const updated = await DealRepository.updateOne(db, ctx, input.dealId, { importMeta: next } as never);
    if (!updated) throw new NotFoundError('Event');
    return updated;
  }

  async syncFollowUps(db: Db, ctx: TenantContext, nowMs = Date.now()): Promise<number> {
    const { tasks } = await this.listQueue(db, ctx, nowMs);
    const high = tasks.filter(t => t.priority === 'high' && isFollowUpKind(t.kind));
    if (high.length === 0) return 0;
    const keys = high.map(t => t.id);
    const existing = await InteractionRepository.list(
      db,
      ctx,
      { 'metadata.opsTaskKey': { $in: keys } } as never,
      {
        page: 1,
        limit: Math.max(keys.length, 1),
        sort: 'createdAt',
        order: 'desc',
      },
    );
    const keyed = new Set(
      (existing.data as Array<InteractionDoc & { _id: string }>)
        .map(row => (row.metadata && typeof row.metadata.opsTaskKey === 'string' ? row.metadata.opsTaskKey : ''))
        .filter(Boolean),
    );
    let created = 0;
    for (const task of high) {
      if (keyed.has(task.id)) continue;
      const deal = await DealRepository.findById(db, ctx, task.dealId);
      if (!deal) continue;
      const now = new Date(nowMs);
      const followUpAt = task.dueAt ? new Date(task.dueAt) : now;
      const doc: Omit<InteractionDoc, '_id'> = {
        tenantId: deal.tenantId ?? ctx.tenantId,
        companyId: deal.companyId || deal._id,
        companyName: deal.company,
        relatedDealId: deal._id,
        type: 'task',
        direction: 'outbound',
        summary: task.title,
        body: task.reason,
        outcome: 'other',
        status: 'open',
        createdAt: now,
        createdByUserId: 'system',
        createdByName: 'Hub operations',
        ownerUserId: task.assignee.type === 'user' ? task.assignee.id : task.assignee.id,
        ownerName: task.assignee.name,
        followUpAt: Number.isNaN(followUpAt.getTime()) ? now : followUpAt,
        attachments: [],
        metadata: { source: 'venue_ops', opsTaskKey: task.id, kind: task.kind, assigneeType: task.assignee.type, assignmentReason: task.assignee.reason },
        updatedAt: now,
      };
      await InteractionRepository.insertOne(db, ctx, doc);
      keyed.add(task.id);
      created += 1;
    }
    return created;
  }
}

export const venueOpsService = new VenueOpsService();
