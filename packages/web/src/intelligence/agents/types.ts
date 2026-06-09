import type {
  IntelligenceRecommendation,
  OperationalSignal,
  RecommendedAction,
} from '@hub-crm/shared';
import type { IntelligenceDataContext } from '../context/types.js';

export interface AgentRunResult {
  agentId: import('@hub-crm/shared').IntelligenceAgentId;
  signals: OperationalSignal[];
  recommendations: IntelligenceRecommendation[];
  proposedActions: RecommendedAction[];
}

export type AgentRunner = (ctx: IntelligenceDataContext) => AgentRunResult;
