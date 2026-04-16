// packages/api/src/services/ActivityService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { ActivityType } from '@mtte-core/shared';
import { ACTIVITY_TYPES } from '@mtte-core/shared';
import { NotFoundError, ValidationError } from '../errors/index.js';

export interface CreateActivityPayload {
  companyId:      string;
  activityType:   string;
  body:           string;
  title?:         string;
  contactNameRaw?: string;
  outcome?:       string;
  followUpAt?:    string;  // ISO date string
  followUpNote?:  string;
  relatedDealId?: string;
}

function normalizeActivityType(raw: string): ActivityType {
  const r = raw.toLowerCase().replace(/[^a-z_]/g, '');
  if ((ACTIVITY_TYPES as readonly string[]).includes(r)) return r as ActivityType;
  const map: Record<string, ActivityType> = {
    call:  'call_out', outcall: 'call_out', incall: 'call_in',
    email: 'email_out', visit: 'visit', note: 'other', meeting: 'visit',
    text: 'text_out',
  };
  return map[r] ?? 'other';
}

export class ActivityService {
  async listForCompany(db: Db, ctx: TenantContext, companyId: string, options: ListOptions) {
    return ActivityRepository.listForCompany(db, ctx, companyId, options);
  }

  async create(db: Db, ctx: TenantContext, payload: CreateActivityPayload) {
    if (!payload.body?.trim()) throw new ValidationError('Notes / body is required');
    if (!payload.companyId)    throw new ValidationError('companyId is required');

    // Verify company exists in this tenant
    const company = await CompanyRepository.findById(db, ctx, payload.companyId);
    if (!company) throw new NotFoundError('Company not found');

    const activityType = normalizeActivityType(payload.activityType);
    const now = new Date();

    const doc = {
      tenantId:       ctx.tenantId ?? '',
      source:         'manual',
      sourceId:       `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      companyId:      payload.companyId,
      companyNameRaw: company.name,
      contactNameRaw: payload.contactNameRaw?.trim() || undefined,
      activityTypeRaw: payload.activityType,
      activityType,
      createdAt:      now,
      createdByName:  ctx.userName,
      body:           payload.body.trim(),
      tags:           {},
      title:          payload.title?.trim() || undefined,
      outcome:        payload.outcome?.trim() || undefined,
      followUpAt:     payload.followUpAt ? new Date(payload.followUpAt) : undefined,
      followUpNote:   payload.followUpNote?.trim() || undefined,
      relatedDealId:  payload.relatedDealId || undefined,
      updatedAt:      now,
    };

    const id = await ActivityRepository.upsertBySourceId(
      db, doc.tenantId, doc.source, doc.sourceId, doc,
    );

    return { ...doc, _id: id };
  }
}

export const activityService = new ActivityService();
