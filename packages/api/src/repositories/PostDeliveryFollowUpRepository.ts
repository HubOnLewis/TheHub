import { ObjectId } from 'mongodb';
import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { PostDeliveryFollowUpStatus, PostDeliveryFollowUpType } from '@mtte-core/shared';

export interface PostDeliveryFollowUpDoc extends Document {
  tenantId: string;
  deliveryRecordId: string;
  companyId: string;
  unitId: string;
  buildId: string;
  dealId?: string;
  status: PostDeliveryFollowUpStatus;
  followUpType: PostDeliveryFollowUpType;
  dueAt?: Date;
  completedAt?: Date;
  ownerUserId?: string;
  ownerName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

class PostDeliveryFollowUpRepositoryClass extends BaseRepository<PostDeliveryFollowUpDoc> {
  protected collectionName = 'post_delivery_follow_ups';

  async listByDeliveryRecordId(db: Db, ctx: TenantContext, deliveryRecordId: string) {
    const rows = await this.col(db)
      .find(this.scope(ctx, { deliveryRecordId } as Filter<PostDeliveryFollowUpDoc>))
      .sort({ dueAt: 1, createdAt: 1 })
      .toArray();
    return rows.map(r => this.serialize(r as PostDeliveryFollowUpDoc & { _id: ObjectId }));
  }

  async listByDeliveryRecordIds(db: Db, ctx: TenantContext, deliveryRecordIds: string[]) {
    if (deliveryRecordIds.length === 0) return [];
    const rows = await this.col(db)
      .find(this.scope(ctx, { deliveryRecordId: { $in: deliveryRecordIds } } as Filter<PostDeliveryFollowUpDoc>))
      .toArray();
    return rows.map(r => this.serialize(r as PostDeliveryFollowUpDoc & { _id: ObjectId }));
  }

  /** Active default check-in: pending or scheduled, not completed/skipped */
  async findActiveCheckIn(db: Db, ctx: TenantContext, deliveryRecordId: string) {
    const row = await this.col(db).findOne(this.scope(ctx, {
      deliveryRecordId,
      followUpType: 'check_in',
      status: { $in: ['pending', 'scheduled'] },
    } as Filter<PostDeliveryFollowUpDoc>));
    return row ? this.serialize(row as PostDeliveryFollowUpDoc & { _id: ObjectId }) : null;
  }
}

export const PostDeliveryFollowUpRepository = new PostDeliveryFollowUpRepositoryClass();
