/**
 * OpenAI-compatible LLM client for local PC models and cloud providers.
 * Never used for operational decisions — drafts and language enhancement only.
 */

import { getAiRuntimeConfig, type AiRuntimeConfig } from '../config/ai.js';
import type {
  AiChatMessage,
  AiChatRequest,
  AiChatResult,
  AiEnhanceKind,
  AiEnhanceRequest,
  AiEnhanceResult,
  AiStatusResponse,
} from '@hub-crm/shared';

type ProbeState = {
  reachable: boolean | null;
  lastProbeAt: string | null;
  lastProbeError: string | null;
};

const probe: ProbeState = {
  reachable: null,
  lastProbeAt: null,
  lastProbeError: null,
};

const KIND_SYSTEM: Record<AiEnhanceKind, string> = {
  summary:
    'You are The Hub CRM assistant for HuB on Lewis (event venue). Summarize clearly for venue staff. No fabrications. Output plain text only.',
  rewrite:
    'You are The Hub CRM assistant for HuB on Lewis. Rewrite for clarity and hospitality tone. Preserve facts. Output plain text only.',
  concierge_reply:
    'You are a polished venue concierge for HuB on Lewis in Wichita. Draft a client-ready reply. Warm, professional, specific. Output plain text only — no markdown fences.',
  inbox_reply:
    'You are venue operations staff at HuB on Lewis. Draft an inbox reply the human can edit before sending. Do not invent pricing, dates, or policies. Output plain text only.',
  follow_up:
    'You are a venue coordinator at HuB on Lewis. Draft a concise follow-up message. Output plain text only.',
  owner_note:
    'You are an owner-intelligence assistant for HuB on Lewis. Write a short internal note. Output plain text only.',
};

function cfg(): AiRuntimeConfig {
  return getAiRuntimeConfig();
}

function chatCompletionsUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/$/, '');
  if (root.endsWith('/chat/completions')) return root;
  return `${root}/chat/completions`;
}

async function callChatCompletions(
  messages: AiChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string; latencyMs: number }> {
  const c = cfg();
  if (!c.enabled || !c.baseUrl || !c.model) {
    throw new Error('AI is not configured');
  }

  const url = chatCompletionsUrl(c.baseUrl);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.apiKey ?? 'ollama'}`,
      },
      body: JSON.stringify({
        model: c.model,
        messages,
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 1024,
        stream: false,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 280)}`);
    }

    let data: {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`LLM returned non-JSON: ${text.slice(0, 200)}`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error(data.error?.message ?? 'LLM returned empty content');
    }

    probe.reachable = true;
    probe.lastProbeAt = new Date().toISOString();
    probe.lastProbeError = null;
    return { content, latencyMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    probe.reachable = false;
    probe.lastProbeAt = new Date().toISOString();
    probe.lastProbeError = message;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class AiService {
  getStatus(opts?: { probe?: boolean }): Promise<AiStatusResponse> | AiStatusResponse {
    const c = cfg();
    const base: AiStatusResponse = {
      enabled: c.enabled,
      configured: c.configured,
      reachable: probe.reachable,
      provider: c.provider,
      mode: c.mode,
      model: c.model,
      baseUrlHost: c.baseUrlHost,
      message: this.statusMessage(c),
      lastProbeAt: probe.lastProbeAt,
      lastProbeError: probe.lastProbeError,
      productMode: c.productMode,
    };

    if (!opts?.probe || !c.configured) {
      return base;
    }

    return this.probe().then(reachable => ({
      ...base,
      reachable,
      message: this.statusMessage(cfg()),
      lastProbeAt: probe.lastProbeAt,
      lastProbeError: probe.lastProbeError,
    }));
  }

  private statusMessage(c: AiRuntimeConfig): string {
    if (c.provider === 'none' || c.mode === 'off') {
      return 'AI is off. Set AI_PROVIDER and AI_MODE on the API to connect a model.';
    }
    if (!c.baseUrl || !c.model) {
      return 'AI provider selected but AI_BASE_URL / AI_MODEL incomplete.';
    }
    if (c.provider !== 'local' && !process.env['AI_API_KEY'] && !process.env['XAI_API_KEY'] && !process.env['OPENAI_API_KEY']) {
      return 'Cloud provider needs AI_API_KEY (or XAI_API_KEY / OPENAI_API_KEY).';
    }
    if (probe.reachable === true) {
      return `Connected to ${c.provider} model "${c.model}" via ${c.baseUrlHost}.`;
    }
    if (probe.reachable === false) {
      return `Configured but unreachable (${probe.lastProbeError ?? 'probe failed'}). Check the model PC, firewall, and AI_BASE_URL.`;
    }
    return `Configured (${c.provider} · ${c.model} @ ${c.baseUrlHost}). Run a probe or enhance to verify.`;
  }

  async probe(): Promise<boolean> {
    const c = cfg();
    if (!c.configured || !c.baseUrl) {
      probe.reachable = false;
      probe.lastProbeAt = new Date().toISOString();
      probe.lastProbeError = 'AI not configured';
      return false;
    }

    // Prefer /models (Ollama + OpenAI compatible); fall back to a tiny chat
    const modelsUrl = `${c.baseUrl.replace(/\/$/, '')}/models`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(c.timeoutMs, 15_000));

    try {
      const res = await fetch(modelsUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${c.apiKey ?? 'ollama'}` },
        signal: controller.signal,
      });
      if (res.ok) {
        probe.reachable = true;
        probe.lastProbeAt = new Date().toISOString();
        probe.lastProbeError = null;
        return true;
      }
      // Some local servers lack /models — try chat
      await callChatCompletions(
        [
          { role: 'system', content: 'Reply with exactly: ok' },
          { role: 'user', content: 'ping' },
        ],
        { maxTokens: 8, temperature: 0 },
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      probe.reachable = false;
      probe.lastProbeAt = new Date().toISOString();
      probe.lastProbeError = message;
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async enhance(req: AiEnhanceRequest): Promise<AiEnhanceResult> {
    const c = cfg();
    if (!c.enabled) {
      return {
        output: req.input,
        enhanced: false,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
      };
    }

    const system = [KIND_SYSTEM[req.kind] ?? KIND_SYSTEM.rewrite, req.systemHint]
      .filter(Boolean)
      .join('\n');

    const userParts = [
      req.context ? `Context:\n${req.context.slice(0, 4000)}` : null,
      `Input:\n${req.input.slice(0, 6000)}`,
    ].filter(Boolean);

    try {
      const { content, latencyMs } = await callChatCompletions(
        [
          { role: 'system', content: system },
          { role: 'user', content: userParts.join('\n\n') },
        ],
        { temperature: 0.35, maxTokens: 1200 },
      );

      return {
        output: content,
        enhanced: true,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
        latencyMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: req.input,
        enhanced: false,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
        error: message,
      };
    }
  }

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const c = cfg();
    if (!c.enabled) {
      return {
        content: '',
        enhanced: false,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
        error: 'AI is not enabled',
      };
    }

    const messages = req.messages.slice(0, 40).map(m => ({
      role: m.role,
      content: String(m.content ?? '').slice(0, 8000),
    }));

    if (messages.length === 0) {
      return {
        content: '',
        enhanced: false,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
        error: 'messages required',
      };
    }

    // Safety system preamble for venue product
    const withSystem: AiChatMessage[] =
      messages[0]?.role === 'system'
        ? messages
        : [
            {
              role: 'system',
              content:
                'You are The Hub CRM assistant for HuB on Lewis. Be accurate, concise, and operational. Do not invent bookings, payments, or client facts.',
            },
            ...messages,
          ];

    try {
      const { content, latencyMs } = await callChatCompletions(withSystem, {
        temperature: req.temperature ?? 0.4,
        maxTokens: req.maxTokens ?? 1024,
      });
      return {
        content,
        enhanced: true,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
        latencyMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: '',
        enhanced: false,
        provider: c.provider,
        model: c.model,
        mode: c.mode,
        error: message,
      };
    }
  }
}

export const aiService = new AiService();
