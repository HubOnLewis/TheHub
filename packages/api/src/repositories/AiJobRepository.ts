// packages/api/src/repositories/AiJobRepository.ts
import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type {
  AiJobRecordType,
  AiJobRuntimeMetadata,
  AiJobStatus,
  AiJobTaskType,
  LocalAiAgentId,
} from '@hub-crm/shared';

export interface AiJobDoc extends Document {
  tenantId: string;
  organizationId: string;
  requestedBy: string;
  requestedByName?: string;
  taskType: AiJobTaskType;
  agent: LocalAiAgentId;
  recordType: AiJobRecordType;
  recordId: string | null;
  status: AiJobStatus;
  createdAt: Date;
  claimedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  attemptCount: number;
  result?: unknown | null;
  error?: string | null;
  runtimeMetadata?: AiJobRuntimeMetadata | null;
  input?: Record<string, unknown>;
  claimedByNodeId?: string | null;
  updatedAt: Date;
}

export interface AiWorkerHeartbeatDoc extends Document {
  tenantId: string;
  nodeId: string;
  lastHeartbeatAt: Date;
  currentJobId?: string | null;
  lastSuccessfulJobId?: string | null;
  lastError?: string | null;
  runtime?: {
    agentRuntime?: string;
    ollamaOk?: boolean;
    models?: string[];
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

class AiJobRepositoryClass extends BaseRepository<AiJobDoc> {
  protected collectionName = 'ai_jobs';

  async ensureIndexes(db: Db) {
    await this.col(db).createIndex({ tenantId: 1, status: 1, createdAt: 1 });
    await this.col(db).createIndex({ tenantId: 1, recordType: 1, recordId: 1, createdAt: -1 });
    await this.col(db).createIndex({ tenantId: 1, status: 1, claimedAt: 1 });
  }

  async listForRecord(
    db: Db,
    ctx: TenantContext,
    recordType: AiJobRecordType,
    recordId: string,
    limit = 10,
  ) {
    const docs = await this.col(db)
      .find(this.scope(ctx, { recordType, recordId } as Filter<AiJobDoc>))
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map(d => this.serialize(d as AiJobDoc & { _id: ObjectId }));
  }

  /** Atomically claim the oldest queued job for this tenant. */
  async claimNext(db: Db, ctx: TenantContext, nodeId: string) {
    const now = new Date();
    const filter = this.scope(ctx, { status: 'queued' } as Filter<AiJobDoc>);
    const result = await this.col(db).findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'claimed',
          claimedAt: now,
          claimedByNodeId: nodeId,
          updatedAt: now,
        },
        $inc: { attemptCount: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
    return result ? this.serialize(result as AiJobDoc & { _id: ObjectId }) : null;
  }

  async markRunning(db: Db, ctx: TenantContext, id: string, nodeId: string) {
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return null;
    }
    const now = new Date();
    const result = await this.col(db).findOneAndUpdate(
      this.scope(ctx, {
        _id: oid,
        status: { $in: ['claimed', 'running'] },
        claimedByNodeId: nodeId,
      } as Filter<AiJobDoc>),
      { $set: { status: 'running', updatedAt: now } },
      { returnDocument: 'after' },
    );
    return result ? this.serialize(result as AiJobDoc & { _id: ObjectId }) : null;
  }

  async complete(
    db: Db,
    ctx: TenantContext,
    id: string,
    nodeId: string,
    resultPayload: unknown,
    runtimeMetadata?: AiJobRuntimeMetadata | null,
  ) {
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return null;
    }
    const now = new Date();
    const result = await this.col(db).findOneAndUpdate(
      this.scope(ctx, {
        _id: oid,
        status: { $in: ['claimed', 'running'] },
        claimedByNodeId: nodeId,
      } as Filter<AiJobDoc>),
      {
        $set: {
          status: 'completed',
          completedAt: now,
          failedAt: null,
          result: resultPayload,
          error: null,
          runtimeMetadata: runtimeMetadata ?? null,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );
    return result ? this.serialize(result as AiJobDoc & { _id: ObjectId }) : null;
  }

  async fail(
    db: Db,
    ctx: TenantContext,
    id: string,
    nodeId: string,
    error: string,
    runtimeMetadata?: AiJobRuntimeMetadata | null,
  ) {
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return null;
    }
    const now = new Date();
    const result = await this.col(db).findOneAndUpdate(
      this.scope(ctx, {
        _id: oid,
        status: { $in: ['claimed', 'running', 'queued'] },
        $or: [{ claimedByNodeId: nodeId }, { claimedByNodeId: null }, { claimedByNodeId: { $exists: false } }],
      } as Filter<AiJobDoc>),
      {
        $set: {
          status: 'failed',
          failedAt: now,
          error: error.slice(0, 2000),
          runtimeMetadata: runtimeMetadata ?? null,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );
    return result ? this.serialize(result as AiJobDoc & { _id: ObjectId }) : null;
  }

  /** Re-queue jobs stuck in claimed/running beyond lease. */
  async requeueStale(db: Db, ctx: TenantContext, olderThanMs: number) {
    const cutoff = new Date(Date.now() - olderThanMs);
    const filter = this.scope(ctx, {
      status: { $in: ['claimed', 'running'] },
      updatedAt: { $lt: cutoff },
    } as Filter<AiJobDoc>);
    const res = await this.col(db).updateMany(filter, {
      $set: {
        status: 'queued',
        claimedAt: null,
        claimedByNodeId: null,
        updatedAt: new Date(),
      },
    });
    return res.modifiedCount;
  }
}

class AiWorkerHeartbeatRepositoryClass extends BaseRepository<AiWorkerHeartbeatDoc> {
  protected collectionName = 'ai_worker_heartbeats';

  async ensureIndexes(db: Db) {
    await this.col(db).createIndex({ tenantId: 1, nodeId: 1 }, { unique: true });
    await this.col(db).createIndex({ tenantId: 1, lastHeartbeatAt: -1 });
  }

  async upsertHeartbeat(
    db: Db,
    ctx: TenantContext,
    payload: {
      nodeId: string;
      currentJobId?: string | null;
      lastSuccessfulJobId?: string | null;
      lastError?: string | null;
      runtime?: AiWorkerHeartbeatDoc['runtime'];
    },
  ) {
    const tenantId = ctx.tenantId ?? 'hub-on-lewis';
    const now = new Date();
    await this.col(db).updateOne(
      { tenantId, nodeId: payload.nodeId } as Filter<AiWorkerHeartbeatDoc>,
      {
        $set: {
          tenantId,
          nodeId: payload.nodeId,
          lastHeartbeatAt: now,
          currentJobId: payload.currentJobId ?? null,
          lastSuccessfulJobId: payload.lastSuccessfulJobId ?? null,
          lastError: payload.lastError ?? null,
          runtime: payload.runtime ?? null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    const doc = await this.col(db).findOne({ tenantId, nodeId: payload.nodeId } as Filter<AiWorkerHeartbeatDoc>);
    return doc ? this.serialize(doc as AiWorkerHeartbeatDoc & { _id: ObjectId }) : null;
  }

  async latestForTenant(db: Db, ctx: TenantContext) {
    const doc = await this.col(db)
      .find(this.scope(ctx, {}))
      .sort({ lastHeartbeatAt: -1 })
      .limit(1)
      .next();
    return doc ? this.serialize(doc as AiWorkerHeartbeatDoc & { _id: ObjectId }) : null;
  }
}

export const AiJobRepository = new AiJobRepositoryClass();
export const AiWorkerHeartbeatRepository = new AiWorkerHeartbeatRepositoryClass();
