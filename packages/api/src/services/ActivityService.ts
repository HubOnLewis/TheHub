// packages/api/src/services/ActivityService.ts
// Read-only. Write operations are handled by import scripts.
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';

export class ActivityService {
  async listForCompany(
    db: Db,
    ctx: TenantContext,
    companyId: string,
    options: ListOptions,
  ) {
    return ActivityRepository.listForCompany(db, ctx, companyId, options);
  }
}

export const activityService = new ActivityService();
