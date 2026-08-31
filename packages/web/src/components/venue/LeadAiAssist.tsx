import { useCallback, useState } from 'react';
import { fetchAiStatus, enhanceWithLlm } from '../../intelligence/ai/provider.js';
import { useQuery } from '@tanstack/react-query';
import type { LeadDetailViewModel } from '../../lib/leadDetail.js';

type Kind = 'follow_up' | 'owner_note';

function leadContext(model: LeadDetailViewModel): string {
  return [
    `Lead: ${model.title}`,
    `Contact: ${model.contact}`,
    `Account: ${model.company}`,
    `Status: ${model.statusLabel}`,
    `Desired date: ${model.eventDateHint ?? 'not captured'}`,
    `Guests: ${model.guestCount ?? 'not captured'}`,
    `Event type: ${model.eventType ?? 'not captured'}`,
    `Space: ${model.spacePreference ?? 'not captured'}`,
    `Estimated value: ${model.estimatedValue ?? 'not captured'}`,
    model.inquirySummary ? `Inquiry: ${model.inquirySummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

type Props = {
  model: LeadDetailViewModel;
  onSaveNote?: (body: string) => Promise<void>;
};

export default function LeadAiAssist({ model, onSaveNote }: Props) {
  const { data: status } = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => fetchAiStatus(false),
    staleTime: 30_000,
    retry: false,
  });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = Boolean(status?.enabled && status?.configured);

  const run = useCallback(
    async (kind: Kind) => {
      setBusy(kind);
      setError(null);
      const prompts: Record<Kind, string> = {
        follow_up: `Draft a short qualification follow-up email for ${model.contact} about their ${model.eventType || 'event'} inquiry. Warm, specific, ask only for missing details. Do not invent prices.`,
        owner_note: `Write a 4-sentence internal note on how to qualify this inquiry and what to capture next.`,
      };
      const result = await enhanceWithLlm({
        kind,
        input: prompts[kind],
        context: leadContext(model),
      });
      if (result.error && !result.enhanced) {
        setError(result.error);
        setDraft(null);
      } else {
        setDraft(result.output);
      }
      setBusy(null);
    },
    [model],
  );

  return (
    <section className="event-detail-section event-ai-assist">
      <header className="event-detail-section__header">
        <span className="event-detail-section__accent" aria-hidden />
        <div className="event-detail-section__heading">
          <h2 className="event-detail-section__title">Local AI assist</h2>
          <p className="event-detail-section__subtitle">
            {enabled
              ? `Drafts via ${status?.provider ?? 'local'} · ${status?.model ?? 'model'} — nothing sends`
              : 'Connect the Hub PC model in Settings → Integrations to draft from this inquiry'}
          </p>
        </div>
      </header>
      <div className="event-detail-section__body">
        <div className="event-ai-assist__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!enabled || !!busy}
            onClick={() => void run('follow_up')}
          >
            {busy === 'follow_up' ? 'Drafting…' : 'Draft follow-up'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!enabled || !!busy}
            onClick={() => void run('owner_note')}
          >
            {busy === 'owner_note' ? 'Drafting…' : 'Qualify note'}
          </button>
        </div>
        {error ? <p className="event-detail-error">{error}</p> : null}
        {draft ? (
          <>
            <textarea className="form-textarea" rows={8} value={draft} onChange={e => setDraft(e.target.value)} />
            <div className="event-ai-assist__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void navigator.clipboard?.writeText(draft)}
              >
                Copy draft
              </button>
              {onSaveNote ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void onSaveNote(draft)}
                >
                  Save to notes
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>
            Uses the Hub API → local model on the venue PC. Staff review every draft.
          </p>
        )}
      </div>
    </section>
  );
}
