/**
 * Shared AI / local-model contracts.
 * Rules engines stay authoritative; LLM is optional language enhancement + drafting.
 */

export type AiProviderId = 'none' | 'local' | 'openai' | 'xai' | 'groq' | 'gemini';
export type AiModeId = 'off' | 'draft_only' | 'approval_required' | 'full_assist';
export type AiStaffRole = 'assistant' | 'lead_generator' | 'accounting_manager' | 'booking_assistant';
export const AI_STAFF_ROLES: readonly AiStaffRole[] = [
  'assistant',
  'lead_generator',
  'accounting_manager',
  'booking_assistant',
];
export const AI_ROLE_LABELS: Record<AiStaffRole, string> = {
  assistant: 'Assistant',
  lead_generator: 'Lead generator',
  accounting_manager: 'Accounting manager',
  booking_assistant: 'Booking assistant',
};

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
  /** True when no onsite/cloud model is configured */
  offline: boolean;
  roles: AiRoleDescriptor[];
}

export interface AiRoleDescriptor {
  id: AiStaffRole;
  label: string;
  purpose: string;
  outbound: 'draft_only' | 'human_approve';
}

export const AI_ROLE_DESCRIPTORS: AiRoleDescriptor[] = [
  {
    id: 'assistant',
    label: 'Assistant',
    purpose: 'Draft follow-ups, summaries, and owner notes from live CRM context.',
    outbound: 'draft_only',
  },
  {
    id: 'lead_generator',
    label: 'Lead generator',
    purpose: 'Suggest inquiry follow-ups and qualification questions. Never send outbound.',
    outbound: 'human_approve',
  },
  {
    id: 'accounting_manager',
    label: 'Accounting manager',
    purpose: 'Explain balances, deposit schedules, and payment nudges. No card charges.',
    outbound: 'human_approve',
  },
  {
    id: 'booking_assistant',
    label: 'Booking assistant',
    purpose: 'Help staff fill date, space, and guest details. Conflicts stay rule-based.',
    outbound: 'draft_only',
  },
];

