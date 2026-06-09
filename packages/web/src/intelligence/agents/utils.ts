import type {
  IntelligenceAgentId,
  OperationalSignal,
  OperationalSignalType,
  RecommendedAction,
  RelatedEntity,
  SignalSeverity,
} from '@hub-crm/shared';
import type { IntelligenceDataContext } from '../context/types.js';

export function daysUntil(iso: string, asOf: string): number {
  const t = new Date(iso).getTime();
  const a = new Date(asOf).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.ceil((t - a) / 86400000);
}

export function eventEntity(id: string, label: string): RelatedEntity {
  return { kind: 'event', id, label };
}

export function makeSignal(params: {
  id: string;
  type: OperationalSignalType;
  severity: SignalSeverity;
  sourceAgent: IntelligenceAgentId;
  title: string;
  summary: string;
  ctx: IntelligenceDataContext;
  entity?: RelatedEntity;
  confidence: number;
  triggerRule: string;
  requiresApproval?: boolean;
  actions?: RecommendedAction[];
  expiresInDays?: number;
}): OperationalSignal {
  const expiresAt = params.expiresInDays
    ? new Date(new Date(params.ctx.asOf).getTime() + params.expiresInDays * 86400000).toISOString()
    : undefined;
  return {
    id: params.id,
    type: params.type,
    severity: params.severity,
    sourceAgent: params.sourceAgent,
    title: params.title,
    summary: params.summary,
    relatedEntities: params.entity ? [params.entity] : [],
    confidence: params.confidence,
    generatedAt: params.ctx.asOf,
    expiresAt,
    recommendedActions: params.actions ?? [],
    requiresApproval: params.requiresApproval ?? false,
    triggerRule: params.triggerRule,
  };
}

export function makeAction(params: {
  id: string;
  type: RecommendedAction['type'];
  title: string;
  summary: string;
  sourceAgent: IntelligenceAgentId;
  confidence: number;
  requiresApproval: boolean;
  entity?: RelatedEntity;
}): RecommendedAction {
  return {
    id: params.id,
    type: params.type,
    title: params.title,
    summary: params.summary,
    sourceAgent: params.sourceAgent,
    confidence: params.confidence,
    requiresApproval: params.requiresApproval,
    linkedEntity: params.entity,
  };
}
