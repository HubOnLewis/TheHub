import type { Db, Document } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { LiveAgentEvaluation } from '@hub-crm/shared';

export interface AgentRunDoc extends Document {
  tenantId: string;
  generatedAt: Date;
  evaluation: LiveAgentEvaluation;
  llmBriefing?: string | null;
  decisions?: Array<{ findingId: string; decision: 'approve' | 'dismiss'; at: string; by?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

class AgentRunRepositoryClass extends BaseRepository<AgentRunDoc> {
  protected collectionName = 'agent_runs';

  async latest(db: Db, ctx: TenantContext) {
    const scoped = this.scope(ctx, {});
    const doc = await this.col(db).find(scoped).sort({ generatedAt: -1 }).limit(1).next();
    return doc ? this.serialize(doc as AgentRunDoc & { _id: import('mongodb').ObjectId }) : null;
  }

  async ensureIndexes(db: Db) {
    await this.col(db).createIndex({ tenantId: 1, generatedAt: -1 });
  }
}

export const AgentRunRepository = new AgentRunRepositoryClass();
