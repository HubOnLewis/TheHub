import type { Db, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { ProposalRecord } from '@hub-crm/shared';

export interface ProposalSignature {
  method: 'typed' | 'drawn';
  name: string;
  dataUrl?: string;
  signedAt: Date;
  ip?: string;
}

export interface ProposalDoc extends Document {
  tenantId: string;
  eventId: string;
  eventTitle: string;
  version: number;
  status: ProposalRecord['status'];
  title: string;
  summary: string;
  packageTotal: number;
  terms: string;
  space?: string;
  eventDate?: string;
  guests?: number;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  viewedAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  acceptedBy?: string;
  createdBy?: string;
  supersedesId?: string;
  signature?: ProposalSignature;
}

function toIso(d: Date | string | undefined): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return d;
}

export function serializeProposal(doc: ProposalDoc & { _id: string }): ProposalRecord {
  return {
    id: doc._id,
    eventId: doc.eventId,
    eventTitle: doc.eventTitle,
    version: doc.version,
    status: doc.status,
    title: doc.title,
    summary: doc.summary,
    packageTotal: doc.packageTotal,
    terms: doc.terms,
    space: doc.space,
    eventDate: doc.eventDate,
    guests: doc.guests,
    token: doc.token,
    createdAt: toIso(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(doc.updatedAt) ?? new Date().toISOString(),
    sentAt: toIso(doc.sentAt),
    viewedAt: toIso(doc.viewedAt),
    acceptedAt: toIso(doc.acceptedAt),
    declinedAt: toIso(doc.declinedAt),
    acceptedBy: doc.acceptedBy,
    createdBy: doc.createdBy,
    supersedesId: doc.supersedesId,
    signature: doc.signature
      ? {
          method: doc.signature.method,
          name: doc.signature.name,
          dataUrl: doc.signature.dataUrl,
          signedAt: toIso(doc.signature.signedAt) ?? new Date().toISOString(),
        }
      : undefined,
  };
}

class ProposalRepositoryClass extends BaseRepository<ProposalDoc> {
  protected collectionName = 'proposals';

  async listByEvent(db: Db, ctx: TenantContext, eventId: string): Promise<ProposalRecord[]> {
    const docs = await this.col(db)
      .find(this.scope(ctx, { eventId } as never))
      .sort({ version: -1, createdAt: -1 })
      .toArray();
    return docs.map(d => serializeProposal(this.serialize(d as ProposalDoc & { _id: ObjectId })));
  }

  async latestForEvent(db: Db, ctx: TenantContext, eventId: string): Promise<(ProposalDoc & { _id: string }) | null> {
    const doc = await this.col(db)
      .find(this.scope(ctx, { eventId, status: { $ne: 'superseded' } } as never))
      .sort({ version: -1, createdAt: -1 })
      .limit(1)
      .next();
    return doc ? this.serialize(doc as ProposalDoc & { _id: ObjectId }) : null;
  }

  async maxVersion(db: Db, ctx: TenantContext, eventId: string): Promise<number> {
    const doc = await this.col(db)
      .find(this.scope(ctx, { eventId } as never))
      .sort({ version: -1 })
      .project({ version: 1 })
      .limit(1)
      .next();
    return typeof doc?.version === 'number' ? doc.version : 0;
  }

  async ensureIndexes(db: Db) {
    await this.col(db).createIndex({ tenantId: 1, eventId: 1, version: -1 });
    await this.col(db).createIndex({ tenantId: 1, eventId: 1, status: 1 });
  }
}

export const ProposalRepository = new ProposalRepositoryClass();
