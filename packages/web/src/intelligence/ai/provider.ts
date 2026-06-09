import { canEnhanceWithLlm, getAiMode, getAiProvider } from './config.js';

export interface LlmEnhanceRequest {
  kind: 'summary' | 'rewrite' | 'concierge_reply';
  input: string;
  context?: string;
}

export interface LlmEnhanceResult {
  output: string;
  enhanced: boolean;
  provider: string;
}

/**
 * Optional language enhancement — never called for operational decisions.
 * When AI_MODE=off, returns passthrough text unchanged.
 */
export async function enhanceWithLlm(req: LlmEnhanceRequest): Promise<LlmEnhanceResult> {
  if (!canEnhanceWithLlm()) {
    return {
      output: req.input,
      enhanced: false,
      provider: 'none',
    };
  }

  // Provider hooks reserved — no network calls in demo build
  return {
    output: `[${getAiMode()} · ${getAiProvider()}] ${req.input}`,
    enhanced: false,
    provider: getAiProvider(),
  };
}
