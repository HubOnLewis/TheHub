// packages/api/src/services/InteractionService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import {
  InteractionRepository,
  type InteractionDoc,
  type InteractionAttachment,
} from '../repositories/InteractionRepository.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { identityIntegrityService } from './IdentityIntegrityService.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateInteractionRequestPayload, PatchInteractionRequestPayload } from '@hub-crm/shared';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors/index.js';
import {
  interactionNextActionService,
  type CompanyInteractionContext,
} from './InteractionNextActionService.js';

function isAdminish(role: string): boolean {
  return role === 'super_admin' || role === 'admin';
}

function toIso(d: Date | string | undefined): string | undefined {
  if (d == null) return undefined;
  return typeof d === 'string' ? d : d.toISOString();
}

export function toInteractionResponse(
  doc: InteractionDoc & { _id: string },
  companyContext: CompanyInteractionContext = {},
): Record<string, unknown> {
  const now = new Date();
  const fu  = doc.followUpAt ? new Date(doc.followUpAt) : null;
  const isOverdue = !!fu && fu.getTime() < now.getTime() && doc.status !== 'completed';
  return {
    nextAction: (() => {
      const action = interactionNextActionService.evaluate(doc, companyContext);
      if (!action) return undefined;
      return { ...action, dueAt: toIso(action.dueAt) };
    })(),
    ...doc,
    _id:         doc._id,
    isOverdue,
    followUpAt:  toIso(doc.followUpAt),
    completedAt: toIso(doc.completedAt),
    lastEditedAt: toIso(doc.lastEditedAt),
    createdAt:   toIso(doc.createdAt) ?? new Date().toISOString(),
    updatedAt:   toIso(doc.updatedAt) ?? new Date().toISOString(),
    attachments: (doc.attachments ?? []).map(a => ({
      ...a,
      uploadedAt: toIso(a.uploadedAt) ?? new Date().toISOString(),
    })),
    aiInsights: doc.aiInsights
      ? {
          ...doc.aiInsights,
          suggestedFollowUp: doc.aiInsights.suggestedFollowUp
            ? toIso(doc.aiInsights.suggestedFollowUp)
            : undefined,
        }
      : undefined,
  };
}

export class InteractionService {
  private assertCanReassignOwner(ctx: TenantContext): void {
    if (isAdminish(ctx.userRole)) return;
    throw new ForbiddenError('Only admin or super_admin can reassign interaction owner');
  }

  private assertCanEdit(ctx: TenantContext, row: InteractionDoc & { _id: string }): void {
    if (row.ownerUserId === ctx.userId) return;
    if (isAdminish(ctx.userRole)) return;
    throw new ForbiddenError('Only the owner or an admin can update this interaction');
  }

  private async resolveOwner(
    db: Db,
    ctx: TenantContext,
    ownerUserId: string | undefined,
    fallback: { userId: string; userName: string },
  ): Promise<{ ownerUserId: string; ownerName: string }> {
    if (!ownerUserId || ownerUserId === fallback.userId) {
      return { ownerUserId: fallback.userId, ownerName: fallback.userName };
    }
    const user = await UserRepository.findById(db, ctx, ownerUserId);
    if (!user || !user.active) throw new ValidationError('ownerUserId must reference an active user in scope');
    return { ownerUserId: user._id, ownerName: user.name };
  }

  async listForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
    filter: { type?: string; status?: string; ownerUserId?: string; hasFollowUp?: boolean; q?: string },
    options: ListOptions,
  ) {
    const result = await InteractionRepository.listForCompany(db, ctx, companyId, filter, options);
    const latestMap = await InteractionRepository.getLatestByCompanyIds(db, ctx, [companyId]);
    const lastAt = latestMap.get(companyId);
    const now = Date.now();
    const context: CompanyInteractionContext = {
      lastInteractionAt: lastAt,
      daysSinceLastInteraction: lastAt ? Math.floor((now - lastAt.getTime()) / (24 * 60 * 60 * 1000)) : undefined,
    };
    return {
      ...result,
      data: result.data.map(d => toInteractionResponse(d, context) as never),
    };
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const row = await InteractionRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('Interaction');
    const latestMap = await InteractionRepository.getLatestByCompanyIds(db, ctx, [row.companyId]);
    const lastAt = latestMap.get(row.companyId);
    const context: CompanyInteractionContext = {
      lastInteractionAt: lastAt,
      daysSinceLastInteraction: lastAt ? Math.floor((Date.now() - lastAt.getTime()) / (24 * 60 * 60 * 1000)) : undefined,
    };
    return toInteractionResponse(row, context);
  }

  async create(db: Db, ctx: TenantContext, body: CreateInteractionRequestPayload) {
    if (!body.summary?.trim()) throw new ValidationError('Summary is required');
    if (!body.body?.trim())    throw new ValidationError('Body is required');

    const company = await CompanyRepository.findById(db, ctx, body.companyId);
    if (!company) throw new NotFoundError('Company');
    await identityIntegrityService.validateInteractionContext(db, ctx, {
      companyId: body.companyId,
      relatedDealId: body.relatedDealId,
      unitId: body.unitId,
      buildId: body.buildId,
    });
    if (body.ownerUserId && body.ownerUserId !== ctx.userId && !isAdminish(ctx.userRole)) {
      throw new ForbiddenError('Only admin/super_admin can assign a different owner');
    }

    const now = new Date();
    const owner = await this.resolveOwner(db, ctx, body.ownerUserId, { userId: ctx.userId, userName: ctx.userName });
    const followUp = body.followUpAt ? new Date(body.followUpAt) : undefined;
    const ai     = body.aiInsights
      ? {
        ...body.aiInsights,
        suggestedFollowUp: body.aiInsights.suggestedFollowUp
          ? new Date(body.aiInsights.suggestedFollowUp)
          : undefined,
      }
      : undefined;

    const doc: Omit<InteractionDoc, '_id'> = {
      tenantId:        company.tenantId,
      companyId:       body.companyId,
      companyName:     company.name,
      contactId:       body.contactId,
      relatedDealId:   body.relatedDealId,
      unitId:          body.unitId,
      buildId:         body.buildId,
      parentInteractionId: body.parentInteractionId,
      type:            body.type,
      direction:       body.direction,
      summary:         body.summary.trim(),
      body:            body.body.trim(),
      outcome:         body.outcome,
      status:          body.status,
      followUpAt:      followUp,
      createdAt:       now,
      createdByUserId: ctx.userId,
      createdByName:   ctx.userName,
      ownerUserId:     owner.ownerUserId,
      ownerName:       owner.ownerName,
      completedAt:     body.status === 'completed' ? now : undefined,
      completedByUserId: body.status === 'completed' ? ctx.userId : undefined,
      completedByName: body.status === 'completed' ? ctx.userName : undefined,
      attachments:     [],
      metadata:        body.metadata ?? {},
      aiInsights:      ai,
      updatedAt:       now,
    };

    const inserted = await InteractionRepository.insertOne(
      db, ctx, doc,
    ) as unknown as InteractionDoc & { _id: string };
    return toInteractionResponse(inserted);
  }

  async update(db: Db, ctx: TenantContext, id: string, body: PatchInteractionRequestPayload) {
    const row = await InteractionRepository.findById(db, ctx, id);
    if (!row) throw new NotFoundError('Interaction');
    this.assertCanEdit(ctx, row);

    await identityIntegrityService.validateInteractionContext(db, ctx, {
      companyId: row.companyId,
      relatedDealId: body.relatedDealId ?? row.relatedDealId,
      unitId: body.unitId ?? row.unitId,
      buildId: body.buildId ?? row.buildId,
    });

    const patch: Partial<InteractionDoc> = {
      lastEditedAt:       new Date(),
      lastEditedByUserId: ctx.userId,
      lastEditedByName:   ctx.userName,
    };
    const unsetDoc: Record<string, ''> = {};
    if (body.type !== undefined)         patch['type'] = body.type;
    if (body.direction !== undefined)    patch['direction'] = body.direction;
    if (body.summary !== undefined)      patch['summary'] = body.summary;
    if (body.body !== undefined)         patch['body'] = body.body;
    if (body.outcome !== undefined)     patch['outcome'] = body.outcome;
    if (body.status !== undefined)       patch['status'] = body.status;
    if (body.contactId !== undefined)   patch['contactId'] = body.contactId ?? undefined;
    if (body.relatedDealId !== undefined) patch['relatedDealId'] = body.relatedDealId ?? undefined;
    if (body.unitId !== undefined) patch['unitId'] = body.unitId ?? undefined;
    if (body.buildId !== undefined) patch['buildId'] = body.buildId ?? undefined;
    if (body.parentInteractionId !== undefined) patch['parentInteractionId'] = body.parentInteractionId ?? undefined;
    if (body.metadata !== undefined)     patch['metadata'] = body.metadata;
    if (body.aiInsights !== undefined)  patch['aiInsights'] = body.aiInsights
      ? {
        ...body.aiInsights,
        suggestedFollowUp: body.aiInsights.suggestedFollowUp
          ? new Date(body.aiInsights.suggestedFollowUp)
          : undefined,
      }
      : undefined;
    if (body.ownerUserId !== undefined) {
      if (body.ownerUserId === null) {
        this.assertCanReassignOwner(ctx);
        patch['ownerUserId'] = row.createdByUserId;
        patch['ownerName'] = row.createdByName;
      } else {
        this.assertCanReassignOwner(ctx);
        const owner = await this.resolveOwner(db, ctx, body.ownerUserId, { userId: row.createdByUserId, userName: row.createdByName });
        patch['ownerUserId'] = owner.ownerUserId;
        patch['ownerName'] = owner.ownerName;
      }
    }

    if (body.followUpAt !== undefined) {
      if (body.followUpAt === null) {
        unsetDoc['followUpAt'] = '';
      } else {
        patch['followUpAt'] = new Date(body.followUpAt);
      }
    }

    if (body.status !== undefined && body.status !== row.status) {
      if (body.status === 'completed') {
        patch['completedAt'] = new Date();
        patch['completedByUserId'] = ctx.userId;
        patch['completedByName'] = ctx.userName;
      } else if (body.status === 'open') {
        unsetDoc['completedAt'] = '';
        unsetDoc['completedByUserId'] = '';
        unsetDoc['completedByName'] = '';
      }
    }

    const out = await InteractionRepository.updateWithSetUnset(db, ctx, id, patch, unsetDoc);
    if (!out) throw new NotFoundError('Interaction');
    return toInteractionResponse(out);
  }

  async addAttachment(
    db: Db,
    ctx: TenantContext,
    interactionId: string,
    a: InteractionAttachment,
  ) {
    const row = await InteractionRepository.findById(db, ctx, interactionId);
    if (!row) throw new NotFoundError('Interaction');
    this.assertCanEdit(ctx, row);
    const out = await InteractionRepository.pushAttachment(db, ctx, interactionId, a);
    if (!out) throw new NotFoundError('Interaction');
    return toInteractionResponse(out);
  }

  async removeAttachment(
    db: Db,
    ctx: TenantContext,
    interactionId: string,
    attachmentId: string,
  ) {
    const row = await InteractionRepository.findById(db, ctx, interactionId);
    if (!row) throw new NotFoundError('Interaction');
    this.assertCanEdit(ctx, row);
    const attachment = row.attachments.find(a => a.id === attachmentId);
    if (!attachment) throw new NotFoundError('Attachment');
    const updated = await InteractionRepository.removeAttachment(db, ctx, interactionId, attachmentId);
    if (!updated) throw new NotFoundError('Interaction');
    return { updated: toInteractionResponse(updated), removedAttachment: attachment };
  }

  async listFollowUps(
    db: Db,
    ctx: TenantContext,
    filter: { mine: boolean; ownerUserId?: string; overdueOnly?: boolean; status?: InteractionDoc['status']; q?: string },
    options: ListOptions,
  ) {
    const result = await InteractionRepository.listFollowUpQueue(
      db, ctx, filter, options,
    );
    const companyIds = Array.from(new Set(result.data.map(r => r.companyId)));
    const latestMap = await InteractionRepository.getLatestByCompanyIds(db, ctx, companyIds);
    const now = Date.now();
    return {
      ...result,
      data: result.data.map(d => toInteractionResponse(d, {
        lastInteractionAt: latestMap.get(d.companyId),
        daysSinceLastInteraction: latestMap.get(d.companyId)
          ? Math.floor((now - latestMap.get(d.companyId)!.getTime()) / (24 * 60 * 60 * 1000))
          : undefined,
      }) as never),
    };
  }

  async countOverdueOpen(db: Db, ctx: TenantContext, ownerUserId?: string) {
    return InteractionRepository.countOverdueOpen(db, ctx, ownerUserId);
  }

  async countDueTodayOpen(db: Db, ctx: TenantContext) {
    return InteractionRepository.countDueTodayOpen(db, ctx);
  }

  async countStaleCompanies(db: Db, ctx: TenantContext, staleDays = 14) {
    return InteractionRepository.countStaleCompanies(db, ctx, staleDays);
  }

  async countNoActivityCompanies(db: Db, ctx: TenantContext) {
    return InteractionRepository.countNoActivityCompanies(db, ctx);
  }

  async getNextFollowUpForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
  ) {
    return InteractionRepository.getNextFollowUpForCompany(db, ctx, companyId);
  }

  async getEngagementStateForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
  ) {
    const latestMap = await InteractionRepository.getLatestByCompanyIds(db, ctx, [companyId]);
    const lastInteractionAt = latestMap.get(companyId);
    const daysSinceLastInteraction = lastInteractionAt
      ? Math.floor((Date.now() - lastInteractionAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const [openFollowUps, overdueFollowUps, preview] = await Promise.all([
      InteractionRepository.listForCompany(
        db,
        ctx,
        companyId,
        { status: 'open', hasFollowUp: true },
        { page: 1, limit: 1, sort: 'createdAt', order: 'desc' },
      ).then(r => r.total),
      InteractionRepository.listForCompany(
        db,
        ctx,
        companyId,
        { status: 'open', hasFollowUp: true },
        { page: 1, limit: 100, sort: 'followUpAt', order: 'asc' },
      ).then(r => r.data.filter(x => x.followUpAt && new Date(x.followUpAt).getTime() < Date.now()).length),
      InteractionRepository.listForCompany(
        db,
        ctx,
        companyId,
        {},
        { page: 1, limit: 1, sort: 'createdAt', order: 'desc' },
      ).then(r => r.data[0] ?? null),
    ]);

    const nextActionSummary = preview
      ? (() => {
          const action = interactionNextActionService.evaluate(preview, {
            lastInteractionAt: lastInteractionAt ?? undefined,
            daysSinceLastInteraction: daysSinceLastInteraction ?? undefined,
          });
          return action ? `${action.type}: ${action.reason}` : null;
        })()
      : null;

    return {
      lastInteractionAt: lastInteractionAt ? lastInteractionAt.toISOString() : null,
      daysSinceLastInteraction,
      openFollowUps,
      overdueFollowUps,
      nextActionSummary,
      isStale: (daysSinceLastInteraction ?? 0) > 14,
    };
  }

  async getMyWork(
    db: Db,
    ctx: TenantContext,
    options: { ownerUserId?: string; q?: string; page?: number; limit?: number },
  ) {
    const ownerUserId = options.ownerUserId || ctx.userId;
    const base = await this.listFollowUps(
      db,
      ctx,
      { mine: false, ownerUserId, status: 'open', q: options.q },
      { page: options.page ?? 1, limit: options.limit ?? 100, sort: 'followUpAt', order: 'asc' },
    );
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const overdue = base.data.filter((r: any) => r.followUpAt && new Date(r.followUpAt).getTime() < start.getTime());
    const dueToday = base.data.filter((r: any) => r.followUpAt && new Date(r.followUpAt).getTime() >= start.getTime() && new Date(r.followUpAt).getTime() <= end.getTime());
    const upcoming = base.data.filter((r: any) => r.followUpAt && new Date(r.followUpAt).getTime() > end.getTime());

    const suggestedRows = await InteractionRepository.listOpenByOwnerWithoutFollowUp(db, ctx, ownerUserId, 100);
    const companyIds = Array.from(new Set(suggestedRows.map(r => r.companyId)));
    const latestMap = await InteractionRepository.getLatestByCompanyIds(db, ctx, companyIds);
    const suggested = suggestedRows
      .map(r => toInteractionResponse(r, {
        lastInteractionAt: latestMap.get(r.companyId),
        daysSinceLastInteraction: latestMap.get(r.companyId)
          ? Math.floor((now - latestMap.get(r.companyId)!.getTime()) / (24 * 60 * 60 * 1000))
          : undefined,
      }) as any)
      .filter(r => !!r.nextAction);

    return { overdue, dueToday, upcoming, suggested };
  }
}

export const interactionService = new InteractionService();
