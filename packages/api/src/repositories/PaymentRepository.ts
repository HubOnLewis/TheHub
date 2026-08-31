import type { Db, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { PaymentLinkRecord } from '@hub-crm/shared';

export interface PaymentLinkDoc extends Document {
  tenantId: string;
  eventId: string;
  eventTitle: string;
  kind: PaymentLinkRecord['kind'];
  amount: number;
  currency: string;
  status: PaymentLinkRecord['status'];
  token: string;
  note?: string;
  dueDate?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  createdBy?: string;
}

function toIso(d: Date | string | undefined): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return d;
}

export function serializePayment(doc: PaymentLinkDoc & { _id: string }): PaymentLinkRecord {
  return {
    id: doc._id,
    eventId: doc.eventId,
    eventTitle: doc.eventTitle,
    kind: doc.kind,
    amount: doc.amount,
    currency: doc.currency ?? 'USD',
    status: doc.status,
    token: doc.token,
    note: doc.note,
    dueDate: doc.dueDate,
    createdAt: toIso(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(doc.updatedAt) ?? new Date().toISOString(),
    paidAt: toIso(doc.paidAt),
    createdBy: doc.createdBy,
  };
}

class PaymentRepositoryClass extends BaseRepository<PaymentLinkDoc> {
  protected collectionName = 'payment_links';

  async listByEvent(db: Db, ctx: TenantContext, eventId: string): Promise<PaymentLinkRecord[]> {
    const scoped = this.scope(ctx, { eventId } as never);
    const docs = await this.col(db).find(scoped).sort({ createdAt: -1 }).toArray();
    return docs.map(d => serializePayment(this.serialize(d as PaymentLinkDoc & { _id: ObjectId })));
  }

  async findByToken(db: Db, ctx: TenantContext, token: string): Promise<(PaymentLinkDoc & { _id: string }) | null> {
    const doc = await this.col(db).findOne(this.scope(ctx, { token } as never));
    return doc ? this.serialize(doc as PaymentLinkDoc & { _id: ObjectId }) : null;
  }

  async ensureIndexes(db: Db) {
    await this.col(db).createIndex({ tenantId: 1, eventId: 1, createdAt: -1 });
    await this.col(db).createIndex({ tenantId: 1, token: 1 }, { unique: true, sparse: true });
  }
}

export const PaymentRepository = new PaymentRepositoryClass();
