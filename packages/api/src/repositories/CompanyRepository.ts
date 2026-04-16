// packages/api/src/repositories/CompanyRepository.ts
import { ObjectId } from 'mongodb';
import type { Db, Document, Filter } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CompanyFilter {
  source?: string;
  search?: string;
}

export interface AddressEmbedded {
  street?:     string;
  city?:       string;
  state?:      string;
  postalCode?: string;
}

export interface CompanyDoc extends Document {
  tenantId:              string;
  /** Display name — original casing preserved */
  name:                  string;
  /** Lowercased, punctuation-stripped — used for dedup matching only */
  nameNormalized:        string;
  address?:              AddressEmbedded;
  phone?:                string;
  source:                string;
  sourceId:              string;
  daysSinceLastContact?: number;
  /** true when created as a placeholder from an activity reference */
  isStub:                boolean;
  importMeta?:           Record<string, unknown>;
  createdAt:             Date;
  updatedAt:             Date;
}

class CompanyRepositoryClass extends BaseRepository<CompanyDoc> {
  protected collectionName = 'companies';

  /**
   * Upsert by (tenantId, source, sourceId). Returns the document's _id as a string.
   * On insert, createdAt is set from the caller-supplied payload.
   * On update, only updatedAt is refreshed.
   */
  async upsertBySourceId(
    db: Db,
    tenantId: string,
    source: string,
    sourceId: string,
    payload: Omit<CompanyDoc, '_id'>,
  ): Promise<string> {
    const { createdAt, ...rest } = payload;
    const result = await this.col(db).findOneAndUpdate(
      { tenantId, source, sourceId } as Parameters<typeof this.col>[0] extends never ? never : object,
      {
        $set:         { ...rest, updatedAt: new Date() },
        $setOnInsert: { createdAt } as Partial<CompanyDoc>,
      },
      { upsert: true, returnDocument: 'after' },
    );
    // With upsert:true + returnDocument:'after', result is always non-null
    return (result!._id as ObjectId).toString();
  }

  async findByNameNormalized(
    db: Db,
    tenantId: string,
    nameNormalized: string,
  ): Promise<(CompanyDoc & { _id: string }) | null> {
    const doc = await this.col(db).findOne(
      { tenantId, nameNormalized } as Parameters<typeof this.col>[0] extends never ? never : object,
    );
    return doc ? this.serialize(doc as CompanyDoc & { _id: ObjectId }) : null;
  }

  async listCompanies(
    db: Db,
    ctx: TenantContext,
    filter: CompanyFilter,
    options: ListOptions,
  ) {
    const query: Record<string, unknown> = {};
    if (filter.source) query['source'] = filter.source;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      query['$or'] = [
        { name:           { $regex: safe, $options: 'i' } },
        { 'address.city': { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, query as Filter<CompanyDoc>, options);
  }

  /**
   * Lightweight name-search for autocomplete. Returns a small projection.
   * Strictly tenant-scoped via scope().
   */
  async search(
    db: Db,
    ctx: TenantContext,
    q: string,
    limit = 10,
  ): Promise<Array<CompanyDoc & { _id: string }>> {
    const safe = escapeRegex(q);
    const docs = await this.col(db)
      .find(
        this.scope(ctx, { name: { $regex: safe, $options: 'i' } } as Filter<CompanyDoc>),
        { projection: { name: 1, phone: 1, address: 1 } },
      )
      .limit(limit)
      .toArray();
    return docs.map(d => this.serialize(d as CompanyDoc & { _id: ObjectId }));
  }
}

export const CompanyRepository = new CompanyRepositoryClass();
