import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { AccountPlanStatus } from '@mtte-core/shared';

export interface AccountPlanDoc extends Document {
  tenantId: string;
  companyId: string;
  companyName?: string;
  ownerUserId?: string;
  ownerName?: string;
  status: AccountPlanStatus;
  objectives: string[];
  opportunities: string[];
  risks: string[];
  nextSteps: string[];
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountPlanFilter {
  ownerUserId?: string;
  status?: AccountPlanStatus;
  q?: string;
  companyId?: string;
}

class AccountPlanRepositoryClass extends BaseRepository<AccountPlanDoc> {
  protected collectionName = 'account_plans';

  async listPlans(db: Db, ctx: TenantContext, filter: AccountPlanFilter, options: ListOptions) {
    const q: Filter<AccountPlanDoc> = {};
    if (filter.ownerUserId) (q as Record<string, unknown>)['ownerUserId'] = filter.ownerUserId;
    if (filter.status) (q as Record<string, unknown>)['status'] = filter.status;
    if (filter.companyId) (q as Record<string, unknown>)['companyId'] = filter.companyId;
    if (filter.q?.trim()) {
      const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      (q as Record<string, unknown>)['$or'] = [
        { companyName: { $regex: safe, $options: 'i' } },
        { ownerName: { $regex: safe, $options: 'i' } },
        { objectives: { $elemMatch: { $regex: safe, $options: 'i' } } },
        { opportunities: { $elemMatch: { $regex: safe, $options: 'i' } } },
        { nextSteps: { $elemMatch: { $regex: safe, $options: 'i' } } },
      ];
    }
    return this.list(db, ctx, q, options);
  }

  async findByCompanyId(db: Db, ctx: TenantContext, companyId: string) {
    const row = await this.col(db).findOne(this.scope(ctx, { companyId } as Filter<AccountPlanDoc>));
    return row ? this.serialize(row as AccountPlanDoc & { _id: ObjectId }) : null;
  }
}

export const AccountPlanRepository = new AccountPlanRepositoryClass();
