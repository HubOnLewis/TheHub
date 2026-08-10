/**
 * Local / cloud LLM configuration.
 * OpenAI-compatible chat completions (Ollama, LM Studio, vLLM, llama.cpp, xAI, OpenAI).
 */

export type AiProviderId = 'none' | 'local' | 'openai' | 'xai' | 'groq' | 'gemini';
export type AiModeId = 'off' | 'draft_only' | 'approval_required' | 'full_assist';
export type HubProductMode = 'venue' | 'equipment';

function trim(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function normalizeBaseUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  let u = raw.trim().replace(/\/$/, '');
  // Accept Ollama root and normalize to OpenAI-compatible /v1
  if (/ollama/i.test(u) && !u.endsWith('/v1')) {
    // e.g. http://192.168.1.50:11434 → http://192.168.1.50:11434/v1
    if (!/\/v1$/i.test(u)) u = `${u}/v1`;
  }
  return u;
}

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export interface AiRuntimeConfig {
  provider: AiProviderId;
  mode: AiModeId;
  baseUrl: string | null;
  model: string | null;
  apiKey: string | null;
  timeoutMs: number;
  productMode: HubProductMode;
  enabled: boolean;
  configured: boolean;
  baseUrlHost: string | null;
}

const PROVIDERS: readonly AiProviderId[] = ['none', 'local', 'openai', 'xai', 'groq', 'gemini'];
const MODES: readonly AiModeId[] = ['off', 'draft_only', 'approval_required', 'full_assist'];

function parseProvider(raw: string | undefined): AiProviderId {
  const v = (raw ?? 'none').toLowerCase() as AiProviderId;
  return PROVIDERS.includes(v) ? v : 'none';
}

function parseMode(raw: string | undefined): AiModeId {
  const v = (raw ?? 'off').toLowerCase() as AiModeId;
  return MODES.includes(v) ? v : 'off';
}

function defaultBaseUrl(provider: AiProviderId): string | null {
  switch (provider) {
    case 'local':
      // Ollama default — override with AI_BASE_URL for LAN PC IP or tunnel
      return 'http://127.0.0.1:11434/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'xai':
      return 'https://api.x.ai/v1';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    default:
      return null;
  }
}

function defaultModel(provider: AiProviderId): string | null {
  switch (provider) {
    case 'local':
      return 'llama3.2';
    case 'openai':
      return 'gpt-4o-mini';
    case 'xai':
      return 'grok-4.5';
    case 'groq':
      return 'llama-3.3-70b-versatile';
    default:
      return null;
  }
}

/** Read once at boot; restart API after env changes. */
export function getAiRuntimeConfig(): AiRuntimeConfig {
  const provider = parseProvider(process.env['AI_PROVIDER']);
  const mode = parseMode(process.env['AI_MODE']);
  const productMode: HubProductMode =
    (process.env['HUB_PRODUCT_MODE'] ?? 'venue').toLowerCase() === 'equipment'
      ? 'equipment'
      : 'venue';

  const baseUrl =
    normalizeBaseUrl(process.env['AI_BASE_URL']) ??
    (provider === 'none' ? null : defaultBaseUrl(provider));

  const model = trim(process.env['AI_MODEL']) ?? (provider === 'none' ? null : defaultModel(provider));

  // Prefer AI_API_KEY; accept XAI_API_KEY / OPENAI_API_KEY aliases
  const apiKey =
    trim(process.env['AI_API_KEY']) ??
    trim(process.env['XAI_API_KEY']) ??
    trim(process.env['OPENAI_API_KEY']) ??
    null;

  const timeoutMs = Math.min(
    Math.max(Number(process.env['AI_TIMEOUT_MS'] ?? 60_000) || 60_000, 5_000),
    300_000,
  );

  const configured =
    provider !== 'none' &&
    mode !== 'off' &&
    Boolean(baseUrl) &&
    Boolean(model) &&
    // local models often need no key; cloud providers do
    (provider === 'local' || Boolean(apiKey));

  const enabled = configured;

  return {
    provider,
    mode,
    baseUrl,
    model,
    apiKey: provider === 'local' && !apiKey ? 'ollama' : apiKey,
    timeoutMs,
    productMode,
    enabled,
    configured,
    baseUrlHost: hostFromUrl(baseUrl),
  };
}
