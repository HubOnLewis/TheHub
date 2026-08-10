import type { AiModeId, AiProviderId } from '@hub-crm/shared';

export type AiProvider = AiProviderId;
export type AiMode = AiModeId;

function env(key: string): string | undefined {
  return import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
}

/**
 * Client-side hint only. Real enablement comes from GET /api/ai/status
 * (server holds AI_BASE_URL / keys — never bake local model URLs into the SPA).
 */
export function getAiProvider(): AiProvider {
  const v = (env('VITE_AI_PROVIDER') ?? 'api').toLowerCase();
  if (v === 'none') return 'none';
  if (v === 'openai' || v === 'gemini' || v === 'groq' || v === 'local' || v === 'xai') return v;
  // "api" = use Hub API bridge (recommended for production + local model PC)
  return 'local';
}

export function getAiMode(): AiMode {
  const v = (env('VITE_AI_MODE') ?? 'draft_only').toLowerCase();
  if (v === 'off') return 'off';
  if (v === 'draft_only' || v === 'approval_required' || v === 'full_assist') return v;
  return 'draft_only';
}

/** Prefer server status; client flags only gate UI affordances. */
export function isAiClientHintEnabled(): boolean {
  return getAiMode() !== 'off' && getAiProvider() !== 'none';
}

/** @deprecated use isAiClientHintEnabled — server status is authoritative */
export function isAiEnabled(): boolean {
  return isAiClientHintEnabled();
}

export function canEnhanceWithLlm(): boolean {
  return isAiClientHintEnabled();
}
