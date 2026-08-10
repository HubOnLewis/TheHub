/**
 * Shared AI / local-model contracts.
 * Rules engines stay authoritative; LLM is optional language enhancement + drafting.
 */

export type AiProviderId = 'none' | 'local' | 'openai' | 'xai' | 'groq' | 'gemini';
export type AiModeId = 'off' | 'draft_only' | 'approval_required' | 'full_assist';

export type AiEnhanceKind =
  | 'summary'
  | 'rewrite'
  | 'concierge_reply'
  | 'inbox_reply'
  | 'follow_up'
  | 'owner_note';

export interface AiEnhanceRequest {
  kind: AiEnhanceKind;
  input: string;
  context?: string;
  /** Optional system hint (server may override for safety) */
  systemHint?: string;
}

export interface AiEnhanceResult {
  output: string;
  enhanced: boolean;
  provider: AiProviderId;
  model: string | null;
  mode: AiModeId;
  latencyMs?: number;
  error?: string;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResult {
  content: string;
  enhanced: boolean;
  provider: AiProviderId;
  model: string | null;
  mode: AiModeId;
  latencyMs?: number;
  error?: string;
}

export interface AiStatusResponse {
  enabled: boolean;
  configured: boolean;
  reachable: boolean | null;
  provider: AiProviderId;
  mode: AiModeId;
  model: string | null;
  /** Host only — never full secrets */
  baseUrlHost: string | null;
  message: string;
  lastProbeAt: string | null;
  lastProbeError: string | null;
  productMode: 'venue' | 'equipment';
}
