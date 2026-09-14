import { ObjectId } from 'mongodb';
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { ContactRecord } from '@hub-crm/shared';

export interface ContactDoc extends Document {
  tenantId: string;
  source: 'perfect_venue' | 'manual';
  sourceId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  companyName?: string;
  conflictGroup?: string;
  sourceReport?: string;
  sourceUpdatedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

function serializeContact(doc: ContactDoc & { _id: ObjectId }): ContactRecord {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    source: doc.source,
    sourceId: doc.sourceId,
    firstName: doc.firstName,
    lastName: doc.lastName,
    displayName: doc.displayName,
    email: doc.email,
    phone: doc.phone,
    companyId: doc.companyId,
    companyName: doc.companyName,
    conflictGroup: doc.conflictGroup,
    sourceReport: doc.sourceReport,
    sourceUpdatedAt: doc.sourceUpdatedAt,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

class ContactRepositoryClass extends BaseRepository<ContactDoc> {
  protected collectionName = 'contacts';

  async listContacts(db: Db, ctx: TenantContext, search: string | undefined, options: ListOptions) {
    const filter: Record<string, unknown> = {};
    if (search?.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { displayName: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { companyName: { $regex: safe, $options: 'i' } },
      ];
    }
    const result = await this.list(db, ctx, filter as never, options);
    return { ...result, data: result.data.map(doc => serializeContact(doc as ContactDoc & { _id: string } as never)) };
  }

  async findBySourceId(db: Db, tenantId: string, source: ContactDoc['source'], sourceId: string) {
    const doc = await this.col(db).findOne({ tenantId, source, sourceId });
    return doc ? serializeContact(doc as ContactDoc & { _id: ObjectId }) : null;
  }

  async ensureIndexes(db: Db) {
    await this.col(db).createIndex({ tenantId: 1, source: 1, sourceId: 1 }, { unique: true });
    await this.col(db).createIndex({ tenantId: 1, email: 1 });
    await this.col(db).createIndex({ tenantId: 1, companyId: 1 });
  }
}

export { serializeContact };
export const ContactRepository = new ContactRepositoryClass();
