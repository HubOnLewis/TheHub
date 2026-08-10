import client from '../../api/client.js';
import type { AiEnhanceKind, AiEnhanceResult, AiStatusResponse } from '@hub-crm/shared';
import { canEnhanceWithLlm, getAiMode, getAiProvider } from './config.js';

export interface LlmEnhanceRequest {
  kind: AiEnhanceKind;
  input: string;
  context?: string;
  systemHint?: string;
}

export type LlmEnhanceResult = AiEnhanceResult;

/**
 * Optional language enhancement via Hub API → local/cloud model.
 * Never called for operational decisions. On failure, returns input unchanged.
 */
export async function enhanceWithLlm(req: LlmEnhanceRequest): Promise<LlmEnhanceResult> {
  if (!canEnhanceWithLlm()) {
    return {
      output: req.input,
      enhanced: false,
      provider: getAiProvider(),
      model: null,
      mode: getAiMode(),
    };
  }

  try {
    const { data } = await client.post<AiEnhanceResult>(
      '/ai/enhance',
      {
        kind: req.kind,
        input: req.input,
        context: req.context,
        systemHint: req.systemHint,
      },
      { timeout: 90_000 },
    );
    return data;
  } catch (err) {
    const message =
      (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
        ?.error ??
      (err as { message?: string })?.message ??
      'AI request failed';
    return {
      output: req.input,
      enhanced: false,
      provider: getAiProvider(),
      model: null,
      mode: getAiMode(),
      error: message,
    };
  }
}

export async function fetchAiStatus(probe = false): Promise<AiStatusResponse | null> {
  try {
    const { data } = await client.get<AiStatusResponse>('/ai/status', {
      params: probe ? { probe: '1' } : undefined,
      timeout: probe ? 20_000 : 10_000,
    });
    return data;
  } catch {
    return null;
  }
}

export async function probeAiConnection(): Promise<AiStatusResponse | null> {
  try {
    const { data } = await client.post<AiStatusResponse>('/ai/probe', {}, { timeout: 25_000 });
    return data;
  } catch {
    return null;
  }
}
