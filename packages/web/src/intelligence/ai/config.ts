export type AiProvider = 'none' | 'openai' | 'gemini' | 'groq' | 'local';
export type AiMode = 'off' | 'draft_only' | 'approval_required' | 'full_assist';

function env(key: string): string | undefined {
  return import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
}

export function getAiProvider(): AiProvider {
  const v = (env('VITE_AI_PROVIDER') ?? 'none').toLowerCase();
  if (v === 'openai' || v === 'gemini' || v === 'groq' || v === 'local') return v;
  return 'none';
}

export function getAiMode(): AiMode {
  const v = (env('VITE_AI_MODE') ?? 'off').toLowerCase();
  if (v === 'draft_only' || v === 'approval_required' || v === 'full_assist') return v;
  return 'off';
}

export function isAiEnabled(): boolean {
  return getAiMode() !== 'off' && getAiProvider() !== 'none';
}

/** Core logic always runs; LLM is optional enhancement only */
export function canEnhanceWithLlm(): boolean {
  return isAiEnabled();
}
