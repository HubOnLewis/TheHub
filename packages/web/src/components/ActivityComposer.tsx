// packages/web/src/components/ActivityComposer.tsx
import { useState } from 'react';
import type { CreateInteractionPayload } from '../hooks/useCompanies.js';

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'call_out',   label: 'Call Out' },
  { value: 'call_in',    label: 'Call In' },
  { value: 'email_out',  label: 'Email Out' },
  { value: 'email_in',   label: 'Email In' },
  { value: 'text_out',   label: 'Text Out' },
  { value: 'text_in',    label: 'Text In' },
  { value: 'visit',      label: 'Visit' },
  { value: 'event',      label: 'Event' },
  { value: 'other',      label: 'Note' },
] as const;

const TYPE_ICONS: Record<string, string> = {
  call_out:  '📞', call_in:   '📲',
  email_out: '✉️', email_in:  '📩',
  text_out:  '💬', text_in:   '💬',
  visit:     '🏢', event:     '📅',
  other:     '📝',
};

interface Props {
  companyId: string;
  onSubmit:  (payload: CreateInteractionPayload) => Promise<void>;
  deals?:    Array<{ _id: string; title: string; status: string }>;
}

const EMPTY: CreateInteractionPayload = {
  activityType:   'call_out',
  body:           '',
  title:          '',
  contactNameRaw: '',
  outcome:        '',
  followUpAt:     '',
  followUpNote:   '',
  relatedDealId:  '',
};

export default function ActivityComposer({ onSubmit, deals = [] }: Props) {
  const [form, setForm]         = useState<CreateInteractionPayload>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const set = (field: keyof CreateInteractionPayload, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.body.trim()) { setError('Notes are required'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        followUpAt: form.followUpAt || undefined,
        title:      form.title || undefined,
        outcome:    form.outcome || undefined,
        followUpNote: form.followUpNote || undefined,
        relatedDealId: form.relatedDealId || undefined,
        contactNameRaw: form.contactNameRaw || undefined,
      });
      setForm(EMPTY);
      setExpanded(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-cond)', fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>
          Log Interaction
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '14px 16px' }}>

        {/* Type selector row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {ACTIVITY_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('activityType', opt.value)}
              className={form.activityType === opt.value ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '5px 11px', fontSize: 12, gap: 4 }}
            >
              <span>{TYPE_ICONS[opt.value]}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Notes */}
        <div className="form-group" style={{ marginBottom: 10 }}>
          <textarea
            className="form-textarea"
            placeholder="Notes…"
            rows={3}
            value={form.body}
            onChange={e => set('body', e.target.value)}
            onFocus={() => setExpanded(true)}
            required
          />
        </div>

        {/* Expanded fields */}
        {expanded && (
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <div className="form-group">
              <label className="form-label">Contact</label>
              <input
                className="form-input"
                placeholder="Contact name"
                value={form.contactNameRaw}
                onChange={e => set('contactNameRaw', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Outcome</label>
              <input
                className="form-input"
                placeholder="e.g. Left voicemail, Demo scheduled"
                value={form.outcome}
                onChange={e => set('outcome', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Follow-up date</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.followUpAt ? form.followUpAt.slice(0, 16) : ''}
                onChange={e => {
                  const v = e.target.value;
                  set('followUpAt', v ? new Date(v).toISOString() : '');
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Follow-up note</label>
              <input
                className="form-input"
                placeholder="Reminder note"
                value={form.followUpNote}
                onChange={e => set('followUpNote', e.target.value)}
              />
            </div>
            {deals.length > 0 && (
              <div className="form-group full">
                <label className="form-label">Related deal</label>
                <select
                  className="form-select"
                  value={form.relatedDealId}
                  onChange={e => set('relatedDealId', e.target.value)}
                >
                  <option value="">— none —</option>
                  {deals.map(d => (
                    <option key={d._id} value={d._id}>{d.title} ({d.status})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {error && <p className="form-error" style={{ marginBottom: 8 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {expanded && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setForm(EMPTY); setExpanded(false); setError(null); }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !form.body.trim()}
          >
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
      </form>
    </div>
  );
}
