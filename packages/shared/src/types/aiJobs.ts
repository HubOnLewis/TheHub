/**
 * Durable local-AI job contracts (Hub API ↔ onsite companion).
 * Advisory only — never mutate CRM from agent results.
 */

export const LOCAL_AI_AGENTS = [
  'lead-intelligence',
  'event-operations',
  'follow-up-drafting',
  'daily-briefing',
  'data-quality',
] as const;

export type LocalAiAgentId = (typeof LOCAL_AI_AGENTS)[number];

export const AI_JOB_STATUSES = [
  'queued',
  'claimed',
  'running',
  'completed',
  'failed',
] as const;

export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const AI_JOB_RECORD_TYPES = ['lead', 'event', 'none'] as const;
export type AiJobRecordType = (typeof AI_JOB_RECORD_TYPES)[number];

export type AiJobTaskType =
  | 'analyze_lead'
  | 'analyze_event'
  | 'draft_follow_up'
  | 'daily_briefing'
  | 'data_quality_scan';

export interface AiJobRuntimeMetadata {
  nodeId?: string;
  model?: string | null;
  durationMs?: number;
  agentRuntime?: string;
  ollamaOk?: boolean;
  attemptNote?: string;
}

export interface AiJobPublic {
  id: string;
  tenantId: string;
  organizationId: string;
  requestedBy: string;
  requestedByName?: string;
  taskType: AiJobTaskType;
  agent: LocalAiAgentId;
  recordType: AiJobRecordType;
  recordId: string | null;
  status: AiJobStatus;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  attemptCount: number;
  result: unknown | null;
  error: string | null;
  runtimeMetadata: AiJobRuntimeMetadata | null;
  /** Staff-facing advisory notice */
  advisoryOnly: true;
}

export interface CreateAiJobRequest {
  agent: LocalAiAgentId;
  taskType?: AiJobTaskType;
  recordType: AiJobRecordType;
  recordId?: string | null;
  input?: Record<string, unknown>;
}

export interface AiWorkerNodeStatus {
  connected: boolean;
  nodeId: string | null;
  lastHeartbeatAt: string | null;
  currentJobId: string | null;
  lastSuccessfulJobId: string | null;
  lastError: string | null;
  runtime: {
    agentRuntime?: string;
    ollamaOk?: boolean;
    models?: string[];
  } | null;
}

export function defaultTaskTypeForAgent(agent: LocalAiAgentId): AiJobTaskType {
  switch (agent) {
    case 'lead-intelligence':
      return 'analyze_lead';
    case 'event-operations':
      return 'analyze_event';
    case 'follow-up-drafting':
      return 'draft_follow_up';
    case 'daily-briefing':
      return 'daily_briefing';
    case 'data-quality':
      return 'data_quality_scan';
  }
}

export function isLocalAiAgentId(v: unknown): v is LocalAiAgentId {
  return typeof v === 'string' && (LOCAL_AI_AGENTS as readonly string[]).includes(v);
}
