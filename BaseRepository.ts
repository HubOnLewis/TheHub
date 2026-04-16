// packages/api/src/repositories/BaseRepository.ts
//
// REPOSITORY PATTERN
// ──────────────────
// Every collection gets a typed repository that extends this base.
// The base class:
//   1. Accepts a TenantContext on every method call
//   2. Merges tenantFilter(ctx) into ALL query filters automatically
//   3. Injects tenantId into all inserted documents
//   4. Provides typed pagination helpers
//
// No raw getDB() calls outside of repositories.

import { type Collection, type Db, type Filter, type Document, ObjectId } from 'mongodb';
import { type TenantContext, tenantFilter } from '../tenancy/index.js';
import type { PaginatedResponse } from '@mtte-core/shared';

export type WithStringId<T> = Omit<T, '_id'> & { _id: string };

export interface ListOptions {
  page:  number;
  limit: number;
  sort:  string;
  order: 'asc' | 'desc';
}

export abstract class BaseRepository<TDoc extends Document> {
  protected abstract collectionName: string;

  protected col(db: Db): Collection<TDoc> {
    return db.collection<TDoc>(this.collectionName);
  }

  /** Merge tenant filter with a caller-supplied filter */
  protected scope(ctx: TenantContext, filter: Filter<TDoc> = {}): Filter<TDoc> {
    return { ...tenantFilter(ctx), ...filter } as Filter<TDoc>;
  }

  /** Convert MongoDB _id to string on the way out */
  protected serialize(doc: TDoc & { _id: ObjectId }): TDoc & { _id: string } {
    return { ...doc, _id: doc._id.toString() } as TDoc & { _id: string };
  }

  async findById(db: Db, ctx: TenantContext, id: string): Promise<(TDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }

    const doc = await this.col(db).findOne(this.scope(ctx, { _id: oid } as Filter<TDoc>));
    return doc ? this.serialize(doc as TDoc & { _id: ObjectId }) : null;
  }

  async list(
    db: Db,
    ctx: TenantContext,
    filter: Filter<TDoc>,
    options: ListOptions,
  ): Promise<PaginatedResponse<TDoc & { _id: string }>> {
    const scopedFilter = this.scope(ctx, filter);
    const skip = (options.page - 1) * options.limit;
    const sortDir = options.order === 'asc' ? 1 : -1;

    const [docs, total] = await Promise.all([
      this.col(db)
        .find(scopedFilter)
        .sort({ [options.sort]: sortDir })
        .skip(skip)
        .limit(options.limit)
        .toArray(),
      this.col(db).countDocuments(scopedFilter),
    ]);

    return {
      data:  docs.map(d => this.serialize(d as TDoc & { _id: ObjectId })),
      total,
      page:  options.page,
      pages: Math.ceil(total / options.limit),
      limit: options.limit,
    };
  }

  async insertOne(
    db: Db,
    ctx: TenantContext,
    payload: Omit<TDoc, '_id'>,
  ): Promise<TDoc & { _id: string }> {
    const doc = {
      ...payload,
      tenantId: ctx.tenantId ?? (payload as Record<string, unknown>)['tenantId'],
    };
    const { insertedId } = await this.col(db).insertOne(doc as unknown as TDoc);
    return { ...doc, _id: insertedId.toString() } as TDoc & { _id: string };
  }

  async updateOne(
    db: Db,
    ctx: TenantContext,
    id: string,
    update: Partial<TDoc>,
  ): Promise<(TDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }

    const result = await this.col(db).findOneAndUpdate(
      this.scope(ctx, { _id: oid } as Filter<TDoc>),
      { $set: { ...update, updatedAt: new Date() } as Partial<TDoc> },
      { returnDocument: 'after' },
    );
    return result ? this.serialize(result as TDoc & { _id: ObjectId }) : null;
  }

  async deleteOne(db: Db, ctx: TenantContext, id: string): Promise<boolean> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return false; }

    const { deletedCount } = await this.col(db).deleteOne(
      this.scope(ctx, { _id: oid } as Filter<TDoc>),
    );
    return deletedCount === 1;
  }

  async count(db: Db, ctx: TenantContext, filter: Filter<TDoc> = {}): Promise<number> {
    return this.col(db).countDocuments(this.scope(ctx, filter));
  }

  /** Aggregate always scopes first stage to tenant */
  protected scopedAggregate(ctx: TenantContext, pipeline: Document[]): Document[] {
    return [{ $match: tenantFilter(ctx) }, ...pipeline];
  }
}
