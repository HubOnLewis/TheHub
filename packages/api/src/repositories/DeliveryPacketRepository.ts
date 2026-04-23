import { ObjectId } from 'mongodb';
import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { DeliveryPacketStatus } from '@mtte-core/shared';

export interface DeliveryPacketDoc extends Document {
  tenantId: string;
  deliveryRecordId: string;
  productionJobId: string;
  buildId: string;
  unitId: string;
  companyId: string;
  dealId?: string;
  status: DeliveryPacketStatus;
  deliveredVersionId: string;
  summary?: string;
  deliveryNotes?: string;
  includesPhotos: boolean;
  includesFinalSpecSummary: boolean;
  includesCustomerDocs: boolean;
  includesKeyContacts: boolean;
  issuedAt?: string;
  issuedByUserId?: string;
  issuedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

class DeliveryPacketRepositoryClass extends BaseRepository<DeliveryPacketDoc> {
  protected collectionName = 'delivery_packets';

  async findByDeliveryRecordId(db: Db, ctx: TenantContext, deliveryRecordId: string) {
    const row = await this.col(db).findOne(this.scope(ctx, { deliveryRecordId } as Filter<DeliveryPacketDoc>));
    return row ? this.serialize(row as DeliveryPacketDoc & { _id: ObjectId }) : null;
  }

  async listByDeliveryRecordIds(db: Db, ctx: TenantContext, deliveryRecordIds: string[]) {
    if (deliveryRecordIds.length === 0) return [];
    const rows = await this.col(db)
      .find(this.scope(ctx, { deliveryRecordId: { $in: deliveryRecordIds } } as Filter<DeliveryPacketDoc>))
      .toArray();
    return rows.map(r => this.serialize(r as DeliveryPacketDoc & { _id: ObjectId }));
  }
}

export const DeliveryPacketRepository = new DeliveryPacketRepositoryClass();
