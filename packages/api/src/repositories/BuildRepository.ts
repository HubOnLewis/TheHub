import { ObjectId } from 'mongodb';
import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { BuildStatus } from '@hub-crm/shared';

export interface BuildSpecItemDoc {
  id: string;
  buildId?: string;
  category: string;
  description: string;
  quantity: number;
  partNumber?: string;
  vendorName?: string;
  unitCostEstimate?: number;
  unitSellPrice?: number;
  extendedCostEstimate?: number;
  extendedSellPrice?: number;
  costSource?: 'manual' | 'standard' | 'substituted';
  pricingSource?: 'manual' | 'template' | 'quoted';
  isStandard: boolean;
  notes?: string;
  substitution?: {
    originalPartNumber?: string;
    originalDescription?: string;
    replacementPartNumber?: string;
    replacementDescription?: string;
    reason?: string;
    changedAt?: string;
    changedByUserId?: string;
    changedByName?: string;
  };
}

export interface BuildDoc extends Document {
  tenantId: string;
  unitId: string;
  dealId?: string;
  name?: string;
  status: BuildStatus;
  estimatedPrice?: number;
  actualPrice?: number;
  templateKey?: string;
  templateName?: string;
  isTemplateDerived?: boolean;
  activeVersionId?: string;
  latestVersionId?: string;
  specItems: BuildSpecItemDoc[];
  createdAt: Date;
  updatedAt: Date;
}

class BuildRepositoryClass extends BaseRepository<BuildDoc> {
  protected collectionName = 'builds';

  async listBuilds(
    db: Db,
    ctx: TenantContext,
    filter: {
      unitId?: string;
      dealId?: string;
      status?: BuildStatus;
      q?: string;
      incompleteCosting?: boolean;
      hasSubstitutions?: boolean;
    },
    options: ListOptions,
  ) {
    const q: Filter<BuildDoc> = {};
    if (filter.unitId) (q as any)['unitId'] = filter.unitId;
    if (filter.dealId) (q as any)['dealId'] = filter.dealId;
    if (filter.status) (q as any)['status'] = filter.status;
    if (filter.q?.trim()) {
      const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      (q as any)['$or'] = [
        { name: { $regex: safe, $options: 'i' } },
        { 'specItems.description': { $regex: safe, $options: 'i' } },
        { 'specItems.category': { $regex: safe, $options: 'i' } },
      ];
    }
    if (typeof filter.hasSubstitutions === 'boolean') {
      (q as any)['specItems.substitution'] = filter.hasSubstitutions ? { $exists: true } : { $exists: false };
    }
    return this.list(db, ctx, q, options);
  }

  async listByUnitIds(db: Db, ctx: TenantContext, unitIds: string[]) {
    if (unitIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { unitId: { $in: unitIds } } as any)).sort({ createdAt: -1 }).toArray();
    return rows.map(r => this.serialize(r as BuildDoc & { _id: ObjectId }));
  }

  async listByDealIds(db: Db, ctx: TenantContext, dealIds: string[]) {
    if (dealIds.length === 0) return [];
    const rows = await this.col(db).find(this.scope(ctx, { dealId: { $in: dealIds } } as any)).sort({ createdAt: -1 }).toArray();
    return rows.map(r => this.serialize(r as BuildDoc & { _id: ObjectId }));
  }
}

export const BuildRepository = new BuildRepositoryClass();
