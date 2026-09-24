// packages/api/src/services/AiJobService.ts
import type { Db } from 'mongodb';
import {
  buildEventAnalysisJobInput,
  buildLeadAnalysisJobInput,
  defaultTaskTypeForAgent,
  isLocalAiAgentId,
  type AiJobPublic,
  type AiJobRuntimeMetadata,
  type AiJobTaskType,
  type AiWorkerNodeStatus,
  type CreateAiJobRequest,
  type LocalAiAgentId,
} from '@hub-crm/shared';
import { NotFoundError, ValidationError, ForbiddenError } from '../errors/index.js';
import type { TenantContext } from '../tenancy/index.js';
import { AiJobRepository, AiWorkerHeartbeatRepository, type AiJobDoc } from '../repositories/AiJobRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';

const STALE_LEASE_MS = 15 * 60 * 1000;
const HEARTBEAT_ONLINE_MS = 90_000;

function iso(d?: Date | string | null): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toPublic(job: AiJobDoc & { _id: string }): AiJobPublic {
  return {
    id: job._id,
    tenantId: job.tenantId,
    organizationId: job.organizationId,
    requestedBy: job.requestedBy,
    requestedByName: job.requestedByName,
    taskType: job.taskType,
    agent: job.agent,
    recordType: job.recordType,
    recordId: job.recordId,
    status: job.status,
    createdAt: iso(job.createdAt) ?? new Date().toISOString(),
    claimedAt: iso(job.claimedAt ?? null),
    completedAt: iso(job.completedAt ?? null),
    failedAt: iso(job.failedAt ?? null),
    attemptCount: job.attemptCount ?? 0,
    result: job.result ?? null,
    error: job.error ?? null,
    runtimeMetadata: job.runtimeMetadata ?? null,
    advisoryOnly: true,
  };
}

function inferTaskType(agent: LocalAiAgentId, explicit?: AiJobTaskType): AiJobTaskType {
  return explicit ?? defaultTaskTypeForAgent(agent);
}

export class AiJobService {
  async create(db: Db, ctx: TenantContext, body: CreateAiJobRequest) {
    if (!isLocalAiAgentId(body.agent)) {
      throw new ValidationError('Unsupported agent');
    }
    const agent = body.agent;
    const recordType = body.recordType;
    const recordId = body.recordId?.trim() || null;
    const taskType = inferTaskType(agent, body.taskType);

    let analysisInput: Record<string, unknown> = {};
    if ((agent === 'lead-intelligence' || agent === 'follow-up-drafting') && recordType === 'lead') {
      if (!recordId) throw new ValidationError('recordId required for lead jobs');
      const lead = await LeadRepository.findById(db, ctx, recordId);
      if (!lead) throw new NotFoundError('Lead');
      if (taskType === 'analyze_lead') {
        const linkedId = String(
          (lead as { convertedDealId?: string; dealId?: string }).convertedDealId ??
            (lead as { dealId?: string }).dealId ??
            '',
        ).trim();
        const linkedEvent = linkedId ? await DealRepository.findById(db, ctx, linkedId) : null;
        analysisInput = buildLeadAnalysisJobInput(lead as Record<string, unknown>, {
          linkedEvent: (linkedEvent as Record<string, unknown> | null) ?? null,
        });
      }
    }
    if (agent === 'event-operations' && recordType === 'event') {
      if (!recordId) throw new ValidationError('recordId required for event jobs');
      const deal = await DealRepository.findById(db, ctx, recordId);
      if (!deal) throw new NotFoundError('Event');
      if (taskType === 'analyze_event') {
        analysisInput = buildEventAnalysisJobInput(deal as Record<string, unknown>);
      }
    }

    const tenantId = ctx.tenantId ?? 'hub-on-lewis';
    const now = new Date();
    const job = await AiJobRepository.insertOne(db, ctx, {
      tenantId,
      organizationId: tenantId,
      requestedBy: ctx.userId,
      requestedByName: ctx.userName,
      taskType,
      agent,
      recordType,
      recordId,
      status: 'queued',
      createdAt: now,
      claimedAt: null,
      completedAt: null,
      failedAt: null,
      attemptCount: 0,
      result: null,
      error: null,
      runtimeMetadata: null,
      input: { ...(body.input ?? {}), ...analysisInput },
      claimedByNodeId: null,
      updatedAt: now,
    });
    return toPublic(job);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const job = await AiJobRepository.findById(db, ctx, id);
    if (!job) throw new NotFoundError('AI job');
    return toPublic(job);
  }

  async listForRecord(db: Db, ctx: TenantContext, recordType: 'lead' | 'event', recordId: string) {
    const rows = await AiJobRepository.listForRecord(db, ctx, recordType, recordId, 20);
    return rows.map(toPublic);
  }

  async claimNext(db: Db, ctx: TenantContext, nodeId: string) {
    if (!nodeId.trim()) throw new ValidationError('nodeId required');
    await AiJobRepository.requeueStale(db, ctx, STALE_LEASE_MS).catch(() => 0);
    const job = await AiJobRepository.claimNext(db, ctx, nodeId.trim());
    return job ? toPublic(job) : null;
  }

  async markRunning(db: Db, ctx: TenantContext, id: string, nodeId: string) {
    const job = await AiJobRepository.markRunning(db, ctx, id, nodeId);
    if (!job) throw new ForbiddenError('Job not claimable by this node');
    return toPublic(job);
  }

  async complete(
    db: Db,
    ctx: TenantContext,
    id: string,
    nodeId: string,
    result: unknown,
    runtimeMetadata?: AiJobRuntimeMetadata | null,
  ) {
    const existing = await AiJobRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('AI job');
    if (existing.status === 'completed') return toPublic(existing); // idempotent
    const job = await AiJobRepository.complete(db, ctx, id, nodeId, result, runtimeMetadata);
    if (!job) throw new ForbiddenError('Job not completable by this node');
    await AiWorkerHeartbeatRepository.upsertHeartbeat(db, ctx, {
      nodeId,
      currentJobId: null,
      lastSuccessfulJobId: id,
      lastError: null,
      runtime: {
        agentRuntime: runtimeMetadata?.agentRuntime,
        ollamaOk: runtimeMetadata?.ollamaOk,
        models: runtimeMetadata?.model ? [runtimeMetadata.model] : undefined,
      },
    }).catch(() => null);
    return toPublic(job);
  }

  async fail(
    db: Db,
    ctx: TenantContext,
    id: string,
    nodeId: string,
    error: string,
    runtimeMetadata?: AiJobRuntimeMetadata | null,
  ) {
    const existing = await AiJobRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('AI job');
    if (existing.status === 'failed' || existing.status === 'completed') return toPublic(existing);
    const job = await AiJobRepository.fail(db, ctx, id, nodeId, error || 'failed', runtimeMetadata);
    if (!job) throw new ForbiddenError('Job not fail-able by this node');
    await AiWorkerHeartbeatRepository.upsertHeartbeat(db, ctx, {
      nodeId,
      currentJobId: null,
      lastError: error.slice(0, 500),
      runtime: {
        agentRuntime: runtimeMetadata?.agentRuntime,
        ollamaOk: runtimeMetadata?.ollamaOk,
      },
    }).catch(() => null);
    return toPublic(job);
  }

  async heartbeat(
    db: Db,
    ctx: TenantContext,
    payload: {
      nodeId: string;
      currentJobId?: string | null;
      lastSuccessfulJobId?: string | null;
      lastError?: string | null;
      runtime?: { agentRuntime?: string; ollamaOk?: boolean; models?: string[] };
    },
  ) {
    if (!payload.nodeId?.trim()) throw new ValidationError('nodeId required');
    const row = await AiWorkerHeartbeatRepository.upsertHeartbeat(db, ctx, {
      nodeId: payload.nodeId.trim(),
      currentJobId: payload.currentJobId ?? null,
      lastSuccessfulJobId: payload.lastSuccessfulJobId ?? null,
      lastError: payload.lastError ?? null,
      runtime: payload.runtime ?? null,
    });
    return row;
  }

  async workerStatus(db: Db, ctx: TenantContext): Promise<AiWorkerNodeStatus> {
    const latest = await AiWorkerHeartbeatRepository.latestForTenant(db, ctx);
    if (!latest) {
      return {
        connected: false,
        nodeId: null,
        lastHeartbeatAt: null,
        currentJobId: null,
        lastSuccessfulJobId: null,
        lastError: null,
        runtime: null,
      };
    }
    const last = latest.lastHeartbeatAt ? new Date(latest.lastHeartbeatAt).getTime() : 0;
    const connected = Date.now() - last < HEARTBEAT_ONLINE_MS;
    return {
      connected,
      nodeId: latest.nodeId,
      lastHeartbeatAt: iso(latest.lastHeartbeatAt),
      currentJobId: latest.currentJobId ?? null,
      lastSuccessfulJobId: latest.lastSuccessfulJobId ?? null,
      lastError: latest.lastError ?? null,
      runtime: latest.runtime ?? null,
    };
  }

  /** Worker payload includes input for local agent run. */
  toWorkerJob(job: AiJobPublic & { input?: Record<string, unknown> }, raw?: AiJobDoc & { _id: string }) {
    return {
      ...job,
      input: raw?.input ?? {},
    };
  }

  async getRaw(db: Db, ctx: TenantContext, id: string) {
    return AiJobRepository.findById(db, ctx, id);
  }
}

export const aiJobService = new AiJobService();
