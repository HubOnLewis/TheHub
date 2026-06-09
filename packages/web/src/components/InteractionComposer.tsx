// packages/web/src/components/InteractionComposer.tsx
import { useEffect, useState } from 'react';
import {
  INTERACTION_TYPES,
  INTERACTION_DIRECTIONS,
  INTERACTION_OUTCOMES,
  HUB_LABELS,
  dealStatusForDisplay,
  type InteractionType,
  type InteractionDirection,
  type InteractionOutcome,
  type CreateInteractionRequestPayload,
} from '@hub-crm/shared';
import AttachmentUploader from './AttachmentUploader.js';
import { useAddInteractionAttachment } from '../hooks/useInteractions.js';

const TYPE_ICONS: Record<InteractionType, string> = {
  call: '📞', text: '💬', email: '✉️', meeting: '📅', note: '📝', task: '☑', visit: '🏢',
};

const TYPE_LABEL: Record<InteractionType, string> = {
  call: 'Call', text: 'Text', email: 'Email', meeting: 'Meeting', note: 'Note', task: 'Task', visit: 'Visit',
};

interface Props {
  companyId: string;
  deals?:   Array<{ _id: string; title: string; status: string }>;
  onSubmit: (payload: CreateInteractionRequestPayload) => Promise<{ _id: string }>;
  onSaved?: () => void;
  initialValues?: Partial<CreateInteractionRequestPayload>;
  disabled?: boolean;
}

const EMPTY: CreateInteractionRequestPayload = {
  companyId:     '',
  type:            'call',
  direction:       'outbound',
  summary:         '',
  body:            '',
  outcome:           'other',
  status:            'open',
  relatedDealId:     undefined,
  followUpAt:        undefined,
  metadata:        {},
  aiInsights:        undefined,
  contactId:         undefined,
};

export default function InteractionComposer({
  companyId,
  deals = [],
  onSubmit,
  onSaved,
  initialValues,
  disabled = false,
}: Props) {
  const [form, setForm]   = useState<CreateInteractionRequestPayload>({ ...EMPTY, companyId });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(true);
  const addAttachment = useAddInteractionAttachment(companyId);

  useEffect(() => {
    setForm(f => (f.companyId === companyId ? f : { ...f, companyId }));
  }, [companyId]);

  useEffect(() => {
    if (!initialValues) return;
    setForm(prev => ({ ...prev, ...initialValues, companyId }));
  }, [initialValues, companyId]);

  const suggestedFollowUpDays = form.followUpAt ? null : (
    form.outcome === 'quote_sent' ? 2 :
      form.type === 'meeting' ? 3 :
        form.type === 'call' ? 1 :
          null
  );

  const set = <K extends keyof CreateInteractionRequestPayload>(k: K, v: CreateInteractionRequestPayload[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.summary?.trim() || !form.body?.trim()) {
      setError('Summary and body are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateInteractionRequestPayload = {
        ...form,
        companyId,
        summary:   form.summary.trim(),
        body:      form.body.trim(),
        followUpAt: form.followUpAt as string | undefined,
        relatedDealId: form.relatedDealId || undefined,
      };
      const created = await onSubmit(payload);
      if (created._id && files.length) {
        for (const file of files) {
          await addAttachment.mutateAsync({ id: created._id, file });
        }
      }
      setForm({ ...EMPTY, companyId });
      setFiles([]);
      setShowAttach(true);
      onSaved?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-cond)', fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>
          Log interaction
        </span>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          Type → summary → details. Structured entry for a fast, queryable history.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '14px 16px' }}>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {INTERACTION_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={form.type === t ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 10px', fontSize: 12, gap: 4 }}
            >
              <span>{TYPE_ICONS[t]}</span> {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {INTERACTION_DIRECTIONS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => set('direction', d as InteractionDirection)}
              className={form.direction === d ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '4px 10px', fontSize: 11, textTransform: 'capitalize' }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">Summary *</label>
          <input
            className="form-input"
            placeholder="One-line title (e.g. Pricing follow-up, Left voicemail)"
            value={form.summary}
            onChange={e => set('summary', e.target.value)}
            required
            maxLength={500}
            disabled={disabled}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Details *</label>
          <textarea
            className="form-textarea"
            placeholder="What was said, promised, or observed"
            rows={compactRows(form.body)}
            value={form.body}
            onChange={e => set('body', e.target.value)}
            required
            disabled={disabled}
          />
        </div>

        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-group">
            <label className="form-label">Outcome *</label>
            <select
              className="form-select"
              value={form.outcome}
              onChange={e => set('outcome', e.target.value as InteractionOutcome)}
            >
              {INTERACTION_OUTCOMES.map(o => (
                <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={form.status}
              onChange={e => set('status', e.target.value as 'open' | 'completed')}
            >
              <option value="open">Open</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">Follow-up</label>
          <input
            type="datetime-local"
            className="form-input"
            value={form.followUpAt ? toLocalInput(form.followUpAt) : ''}
            onChange={e => {
              const v = e.target.value;
              set('followUpAt', (v ? new Date(v).toISOString() : undefined) as string | undefined);
            }}
          />
          {suggestedFollowUpDays != null && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, marginTop: 4 }}
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + suggestedFollowUpDays);
                set('followUpAt', d.toISOString() as string | undefined);
              }}
            >
              Suggest +{suggestedFollowUpDays} day follow-up
            </button>
          )}
        </div>

        {deals.length > 0 && (
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Related {HUB_LABELS.opportunity.toLowerCase()}</label>
            <select
              className="form-select"
              value={form.relatedDealId ?? ''}
              onChange={e => set('relatedDealId', e.target.value || undefined)}
            >
              <option value="">— none —</option>
              {deals.map(d => (
                <option key={d._id} value={d._id}>{d.title} ({dealStatusForDisplay(d.status)})</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Attachments</span>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setShowAttach(s => !s)}>
            {showAttach ? 'Hide' : 'Show'}
          </button>
        </div>
        {showAttach && (
          <div style={{ marginBottom: 10 }}>
            <AttachmentUploader files={files} onChange={setFiles} disabled={disabled} compact />
          </div>
        )}

        {error && <p className="form-error" style={{ marginBottom: 8 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setForm({ ...EMPTY, companyId }); setFiles([]); setError(null); }}
          >
            Reset
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || disabled || !form.summary?.trim() || !form.body?.trim()}
          >
            {saving ? 'Saving…' : 'Save interaction'}
          </button>
        </div>
      </form>
    </div>
  );
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function compactRows(body: string): number {
  const n = (body || '').split('\n').length;
  return Math.min(8, Math.max(3, n));
}
