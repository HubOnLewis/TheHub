import { useMutation, useQuery } from '@tanstack/react-query';
import client from '../../api/client.js';
import type { AiStatusResponse } from '@hub-crm/shared';
import { Spinner } from '../ui/index.js';

export default function AiModelSettingsPanel() {
  const { data: status, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => client.get<AiStatusResponse>('/ai/status').then(r => r.data),
    staleTime: 15_000,
    retry: false,
  });

  const probe = useMutation({
    mutationFn: () =>
      client.post<AiStatusResponse & { reachable: boolean }>('/ai/probe', {}, { timeout: 25_000 }).then(r => r.data),
    onSuccess: () => {
      void refetch();
    },
  });

  const connected = Boolean(status?.configured && status?.reachable);
  const statusLabel = !status
    ? 'Unknown'
    : !status.configured
      ? 'Not configured'
      : status.reachable === true
        ? 'Connected'
        : status.reachable === false
          ? 'Unreachable'
          : 'Configured (not probed)';

  return (
    <section className="card settings-provider-card" style={{ marginTop: 20 }}>
      <h4>Local model / AI bridge</h4>
      <p className="settings-muted">
        Onsite box talks to the Hub API. Hub talks to a local OpenAI-compatible model only when
        AI_PROVIDER=local. Production stays on AI_PROVIDER=none until the model PC is built.
        Roles: assistant, lead generator, accounting manager, booking assistant — draft only, human
        approve outbound. Browser never talks to the model host.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <p>
            Status: <strong style={{ color: connected ? 'var(--status-won, #1a7f37)' : undefined }}>
              {status?.offline || status?.provider === 'none' ? 'Onsite model offline' : statusLabel}
            </strong>
            {isFetching ? ' · refreshing…' : null}
          </p>
          {status ? (
            <ul className="settings-list" style={{ marginTop: 8 }}>
              <li>Provider: {status.provider}</li>
              <li>Mode: {status.mode}</li>
              <li>Model: {status.model ?? '—'}</li>
              <li>Host: {status.baseUrlHost ?? '—'}</li>
              <li>Product mode: {status.productMode}</li>
            </ul>
          ) : null}
          <p className="settings-muted" style={{ marginTop: 8 }}>
            {status?.message ?? 'Could not load AI status from API.'}
          </p>
          {status?.lastProbeError ? (
            <p className="settings-muted" style={{ marginTop: 4, color: 'var(--status-lost, #b42318)' }}>
              Last error: {status.lastProbeError}
            </p>
          ) : null}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => refetch()}>
          Refresh status
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: 12 }}
          disabled={probe.isPending || !status?.configured}
          onClick={() => probe.mutate()}
        >
          {probe.isPending ? 'Probing…' : 'Probe model PC'}
        </button>
      </div>

      {probe.data ? (
        <p className="settings-muted" style={{ marginTop: 8 }}>
          Probe result: {probe.data.reachable ? 'reachable' : 'failed'}
          {probe.data.lastProbeError ? ` — ${probe.data.lastProbeError}` : ''}
        </p>
      ) : null}

      <details className="data-import-details" style={{ marginTop: 16 }}>
        <summary>How to link the model PC</summary>
        <ol className="settings-list">
          <li>On the model PC, run Ollama or LM Studio with an OpenAI-compatible endpoint.</li>
          <li>
            Set API env: <code>AI_PROVIDER=local</code>, <code>AI_MODE=draft_only</code>,{' '}
            <code>AI_BASE_URL=http://&lt;pc-ip&gt;:11434/v1</code>, <code>AI_MODEL=llama3.2</code>
          </li>
          <li>
            If the Hub API is on Render (cloud), expose the model with Cloudflare Tunnel or ngrok —
            private LAN IPs are not reachable from the public internet.
          </li>
          <li>Restart the API, then use <strong>Probe model PC</strong> here.</li>
        </ol>
        <p className="settings-muted">
          Full runbook: <code>docs/HUB_LOCAL_MODEL_LINK.md</code>
        </p>
      </details>
    </section>
  );
}
