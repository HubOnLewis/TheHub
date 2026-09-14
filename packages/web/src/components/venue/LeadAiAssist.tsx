import { useCallback, useEffect, useState } from 'react';
import { fetchAiStatus } from '../../intelligence/ai/provider.js';
import { useQuery } from '@tanstack/react-query';
import type { LeadDetailViewModel } from '../../lib/leadDetail.js';
import type { AiJobPublic } from '@hub-crm/shared';
import client from '../../api/client.js';

type Props = {
  model: LeadDetailViewModel;
  onSaveNote?: (body: string) => Promise<void>;
};

function formatResult(job: AiJobPublic): string {
  if (!job.result) return '';
  if (typeof job.result === 'string') return job.result;
  try {
    return JSON.stringify(job.result, null, 2);
  } catch {
    return String(job.result);
  }
}

export default function LeadAiAssist({ model, onSaveNote }: Props) {
  const { data: status } = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => fetchAiStatus(false),
    staleTime: 15_000,
    retry: false,
    refetchInterval: 20_000,
  });
  const [job, setJob] = useState<AiJobPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const bridgeReady = Boolean(status?.localNode?.bridge === 'outbound_jobs');
  const nodeConnected = Boolean(status?.localNode?.connected);
  const canRequest = bridgeReady && (status?.enabled || nodeConnected || Boolean(status?.configured));
  const inFlight = job && (job.status === 'queued' || job.status === 'claimed' || job.status === 'running');

  useEffect(() => {
    if (!job || !inFlight) return;
    const t = setInterval(() => {
      void client
        .get<AiJobPublic>(`/ai-jobs/${job.id}`)
        .then(r => setJob(r.data))
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [job, inFlight]);

  const requestAnalysis = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const { data } = await client.post<AiJobPublic>('/ai-jobs', {
        agent: 'lead-intelligence',
        recordType: 'lead',
        recordId: model.id,
        taskType: 'analyze_lead',
      });
      setJob(data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ??
        (err as { message?: string })?.message ??
        'Failed to queue local AI analysis';
      setError(message);
    } finally {
      setRequesting(false);
    }
  }, [model.id]);

  const resultText = job?.status === 'completed' ? formatResult(job) : null;
  const statusLabel =
    job?.status === 'queued'
      ? 'Queued — waiting for Hub PC'
      : job?.status === 'claimed' || job?.status === 'running'
        ? 'Analyzing on Hub PC…'
        : job?.status === 'completed'
          ? 'Result ready (advisory only)'
          : job?.status === 'failed'
            ? 'Analysis failed'
            : null;

  return (
    <section className="event-detail-section event-ai-assist">
      <header className="event-detail-section__header">
        <span className="event-detail-section__accent" aria-hidden />
        <div className="event-detail-section__heading">
          <h2 className="event-detail-section__title">Local AI assist</h2>
          <p className="event-detail-section__subtitle">
            {nodeConnected
              ? 'Hub PC connected · Lead Intelligence runs asynchronously — nothing sends or mutates CRM'
              : bridgeReady
                ? 'Waiting for Hub PC companion heartbeat'
                : 'Connect the onsite Hub PC companion to analyze this inquiry'}
          </p>
        </div>
      </header>
      <div className="event-detail-section__body">
        <div className="event-ai-assist__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canRequest || requesting || Boolean(inFlight) || model.isReferenceOnly}
            onClick={() => void requestAnalysis()}
          >
            {requesting || inFlight ? 'Analyzing…' : 'Analyze with local AI'}
          </button>
        </div>
        {statusLabel ? (
          <p className="text-sm" style={{ marginTop: 8 }}>
            {statusLabel}
            {job?.error ? ` — ${job.error}` : ''}
          </p>
        ) : null}
        {error ? <p className="event-detail-error">{error}</p> : null}
        {resultText ? (
          <>
            <textarea className="form-textarea" rows={12} value={resultText} readOnly />
            <div className="event-ai-assist__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void navigator.clipboard?.writeText(resultText)}
              >
                Copy result
              </button>
              {onSaveNote ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void onSaveNote(`Local AI lead analysis:\n${resultText}`)}
                >
                  Save summary to notes
                </button>
              ) : null}
            </div>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              Advisory only. Does not change lead status, send email, or convert.
            </p>
          </>
        ) : (
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>
            Request queues a job on Render; the venue Hub PC polls outbound, runs Lead Intelligence
            locally, and posts the result back. You can keep working while it analyzes.
          </p>
        )}
      </div>
    </section>
  );
}
