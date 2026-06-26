import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, DEAL_STATUSES, type DealStatus, type PatchDealPayload } from '@hub-crm/shared';
import { ROUTES, accountDetailPath } from '../../config/paths.js';
import { Modal, Spinner } from '../ui/index.js';
import type { EventDetailViewModel, EventDetailEditForm } from '../../lib/eventDetail.js';
import { buildEventDetailPatch, displayOrEmpty, eventDetailEditFormFromModel } from '../../lib/eventDetail.js';

type Props = {
  model: EventDetailViewModel;
  onPatch?: (data: PatchDealPayload) => Promise<void>;
  onAddNote?: (summary: string, body: string) => Promise<void>;
  patchPending?: boolean;
  notePending?: boolean;
  patchError?: string | null;
  noteError?: string | null;
};

const EMPTY = 'Not captured yet';

function ownerInitials(owner: string): string {
  if (!owner || owner === EMPTY) return '?';
  const parts = owner.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return parts[0]!.slice(0, 2).toUpperCase();
}

function Field({ label, value }: { label: string; value: string }) {
  const isEmpty = value === EMPTY;
  return (
    <div className="event-detail-field">
      <dt className="event-detail-field__label">{label}</dt>
      <dd className={`event-detail-field__value${isEmpty ? ' event-detail-field__value--empty' : ''}`}>
        {isEmpty ? <span className="event-detail-placeholder">{value}</span> : value}
      </dd>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`event-detail-section${className ? ` ${className}` : ''}`}>
      <header className="event-detail-section__header">
        <span className="event-detail-section__accent" aria-hidden />
        <div className="event-detail-section__heading">
          <h2 className="event-detail-section__title">{title}</h2>
          {subtitle ? <p className="event-detail-section__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="event-detail-section__body">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'ok' | 'urgency';
}) {
  const isEmpty = value === EMPTY;
  return (
    <div className={`event-detail-kpi${tone ? ` event-detail-kpi--${tone}` : ''}`}>
      <span className="event-detail-kpi__label">{label}</span>
      <strong className={`event-detail-kpi__value${isEmpty ? ' event-detail-kpi__value--empty' : ''}`}>
        {isEmpty ? <span className="event-detail-placeholder">{value}</span> : value}
      </strong>
      {hint ? <span className="event-detail-kpi__hint">{hint}</span> : null}
    </div>
  );
}

export default function EventDetailCommandCenter({
  model,
  onPatch,
  onAddNote,
  patchPending,
  notePending,
  patchError,
  noteError,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSummary, setNoteSummary] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editForm, setEditForm] = useState<EventDetailEditForm>(() => eventDetailEditFormFromModel(model));
  const [localError, setLocalError] = useState<string | null>(null);

  const editable = model.canPatch && Boolean(onPatch);
  const canAddNote = editable && Boolean(onAddNote);

  const eventDateTone = useMemo(() => {
    if (model.daysUntilEvent != null && model.daysUntilEvent >= 0 && model.daysUntilEvent <= 14) {
      return 'urgency' as const;
    }
    return undefined;
  }, [model.daysUntilEvent]);

  const hasBalanceDue = model.balanceDue != null && model.balanceDue > 0;

  const timingLabel = useMemo(() => {
    if (model.daysUntilEvent != null && model.daysUntilEvent >= 0) {
      return `${model.daysUntilEvent} day${model.daysUntilEvent === 1 ? '' : 's'} until event`;
    }
    if (model.daysSinceEvent != null) {
      return `${model.daysSinceEvent} day${model.daysSinceEvent === 1 ? '' : 's'} since event`;
    }
    return null;
  }, [model.daysUntilEvent, model.daysSinceEvent]);

  const openEdit = () => {
    setEditForm(eventDetailEditFormFromModel(model));
    setLocalError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!onPatch) return;
    setLocalError(null);
    try {
      await onPatch(buildEventDetailPatch(editForm));
      setEditOpen(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save changes');
    }
  };

  const saveNote = async () => {
    if (!onAddNote || !noteSummary.trim() || !noteBody.trim()) return;
    setLocalError(null);
    try {
      await onAddNote(noteSummary.trim(), noteBody.trim());
      setNoteSummary('');
      setNoteBody('');
      setNoteOpen(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save note');
    }
  };

  const handleQuickStatus = async (patchStatus?: DealStatus) => {
    if (!onPatch) return;
    if (!patchStatus) {
      if (canAddNote) setNoteOpen(true);
      return;
    }
    setLocalError(null);
    try {
      await onPatch({ status: patchStatus });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not update status');
    }
  };

  return (
    <div className="event-command-center hub-demo-deal-page">
      <div className="event-detail-back">
        <Link to={ROUTES.opportunities} className="btn btn-ghost btn-sm">
          ← Back to Events
        </Link>
      </div>

      <header className="event-detail-hero">
        <div className="event-detail-hero__glow" aria-hidden />
        <div className="event-detail-hero__inner">
          <div className="event-detail-hero__main">
            <span className="event-detail-eyebrow">Event Record</span>
            <h1 className="event-detail-title">{model.title}</h1>
            <p className="event-detail-subtitle">
              <strong>{model.contact !== EMPTY ? model.contact : model.company}</strong>
              {model.company !== EMPTY && model.contact !== EMPTY ? ` · ${model.company}` : ''}
            </p>
            <div className="event-detail-pill-row">
              <span className="event-detail-pill event-detail-pill--status">{model.statusLabel}</span>
              <span className="event-detail-pill event-detail-pill--date">
                {model.eventDateDisplay !== EMPTY ? model.eventDateDisplay : 'Date not captured'}
              </span>
              {model.eventTimeDisplay !== EMPTY ? (
                <span className="event-detail-pill event-detail-pill--time">{model.eventTimeDisplay}</span>
              ) : null}
              <span className="event-detail-pill event-detail-pill--owner">
                <span className="event-detail-avatar" aria-hidden>
                  {ownerInitials(model.owner)}
                </span>
                {model.owner !== EMPTY ? model.owner : 'Unassigned'}
              </span>
            </div>
            {hasBalanceDue ? (
              <div className="event-detail-balance-alert" role="status">
                <span className="event-detail-balance-alert__icon" aria-hidden />
                <div>
                  <span className="event-detail-balance-alert__label">Outstanding balance</span>
                  <strong className="event-detail-balance-alert__amount">
                    {formatCurrency(model.balanceDue!)}
                  </strong>
                </div>
              </div>
            ) : model.urgencyNote ? (
              <p className={`event-detail-urgency${model.followUpRisk ? ' event-detail-urgency--warn' : ''}`}>
                {model.urgencyNote}
              </p>
            ) : null}
            <p className="event-detail-hero__updated">
              Last updated · {model.updatedDisplay !== EMPTY ? model.updatedDisplay : 'Not captured yet'}
            </p>
          </div>
          <div className="event-detail-hero__actions">
            {editable ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary event-detail-hero__btn-primary"
                  disabled={patchPending}
                  onClick={() => {
                    const first = model.statusQuickActions[0];
                    if (first?.patchStatus) {
                      void handleQuickStatus(first.patchStatus);
                    } else if (canAddNote) {
                      setNoteOpen(true);
                    } else {
                      openEdit();
                    }
                  }}
                >
                  {model.primaryActionLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary event-detail-hero__btn-secondary"
                  onClick={openEdit}
                  disabled={patchPending}
                >
                  Edit Details
                </button>
                {canAddNote ? (
                  <button type="button" className="btn btn-ghost event-detail-hero__btn-ghost" onClick={() => setNoteOpen(true)}>
                    Add Note
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </header>

      {(patchError || localError) && (
        <div className="event-detail-error" role="alert">
          {patchError || localError}
        </div>
      )}

      <div className="event-detail-kpi-row">
        <KpiCard label="Status" value={model.statusLabel} />
        <KpiCard
          label="Grand total"
          value={model.grandTotal != null ? formatCurrency(model.grandTotal) : 'Not captured yet'}
        />
        <KpiCard
          label="Amount paid"
          value={model.amountPaid != null ? formatCurrency(model.amountPaid) : 'Not captured yet'}
          tone={model.paidInFull ? 'ok' : undefined}
        />
        <KpiCard
          label="Balance due"
          value={model.balanceDue != null ? formatCurrency(model.balanceDue) : 'Not captured yet'}
          tone={model.balanceDue != null && model.balanceDue > 0 ? 'warn' : undefined}
        />
        <KpiCard
          label="Guest count"
          value={model.guests != null ? String(model.guests) : 'Not captured yet'}
        />
        <KpiCard label="Event date" value={model.eventDateDisplay} hint={timingLabel ?? undefined} tone={eventDateTone} />
        <KpiCard label="Last activity" value={model.lastContactedDisplay} hint={model.followUpRisk ? 'Follow-up risk' : undefined} tone={model.followUpRisk ? 'warn' : undefined} />
      </div>

      <div className="event-detail-grid">
        <div className="event-detail-main">
          <Section title="Event overview" subtitle="Core event details and record metadata">
            <dl className="event-detail-fields event-detail-fields--grid">
              <Field label="Event name" value={model.title} />
              <Field label="Event type" value={displayOrEmpty(model.eventType)} />
              <Field label="Event date" value={model.eventDateDisplay} />
              <Field label="Start time" value={displayOrEmpty(model.startTime)} />
              <Field label="End time" value={displayOrEmpty(model.endTime)} />
              <Field label="Guest count" value={model.guests != null ? String(model.guests) : 'Not captured yet'} />
              <Field label="Space / room" value={displayOrEmpty(model.space)} />
              <Field label="Stage" value={model.statusLabel} />
              <Field label="Lead source" value={displayOrEmpty(model.leadSource)} />
              <Field label="Owner" value={model.owner} />
              <Field label="Created" value={model.createdDisplay} />
              <Field label="Last updated" value={model.updatedDisplay} />
              <Field label="Last contacted" value={model.lastContactedDisplay} />
              <Field label="Record source" value={model.sourceLabel} />
            </dl>
          </Section>

          <Section title="Client & contact" subtitle="Account and primary contact information">
            <dl className="event-detail-fields event-detail-fields--grid">
              <Field label="Client / account" value={model.company} />
              <Field label="Primary contact" value={model.contact} />
              <Field label="Email" value={displayOrEmpty(model.contactEmail)} />
              <Field label="Phone" value={displayOrEmpty(model.contactPhone)} />
              <Field label="Lead source" value={displayOrEmpty(model.leadSource)} />
            </dl>
            {model.companyId ? (
              <p className="event-detail-link-row">
                <Link to={accountDetailPath(model.companyId)} className="btn btn-ghost btn-sm">
                  View account record →
                </Link>
              </p>
            ) : null}
          </Section>

          <Section title="Financials" subtitle="Payment status and revenue tracking">
            {hasBalanceDue ? (
              <div className="event-detail-fin-callout">
                <span className="event-detail-fin-callout__label">Balance due</span>
                <strong className="event-detail-fin-callout__value">{formatCurrency(model.balanceDue!)}</strong>
                <span className="event-detail-fin-callout__hint">{model.paymentStatus}</span>
              </div>
            ) : null}
            <dl className="event-detail-fields event-detail-fields--grid">
              <Field label="Grand total" value={model.grandTotal != null ? formatCurrency(model.grandTotal) : 'Not captured yet'} />
              <Field label="Amount paid" value={model.amountPaid != null ? formatCurrency(model.amountPaid) : 'Not captured yet'} />
              <Field label="Balance due" value={model.balanceDue != null ? formatCurrency(model.balanceDue) : 'Not captured yet'} />
              <Field label="Deposit recorded" value={model.depositAmount != null ? formatCurrency(model.depositAmount) : 'Not captured yet'} />
              <Field label="Payment status" value={model.paymentStatus} />
              <Field label="Revenue status" value={model.revenueStatus} />
            </dl>
            {model.payments.length > 0 ? (
              <div className="event-detail-payments">
                <h3 className="event-detail-subheading">Payment history</h3>
                <ul className="event-detail-payment-list">
                  {model.payments.map((p, i) => (
                    <li key={`${p.date}-${p.amount}-${i}`} className="event-detail-payment-item">
                      <span className="event-detail-payment-item__amount">{formatCurrency(p.amount)}</span>
                      <span className="event-detail-payment-item__meta">
                        {[p.date, p.method, p.type].filter(Boolean).join(' · ') || 'Payment recorded'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          <Section title="Event plan" subtitle="Operational planning and execution notes">
            <dl className="event-detail-fields">
              {model.planFields.map(f => (
                <Field key={f.label} label={f.label} value={f.value} />
              ))}
            </dl>
          </Section>

          <Section title="Activity timeline" subtitle="Milestones, payments, and team activity">
            {model.timeline.length === 0 ? (
              <div className="event-detail-empty-state">
                <span className="event-detail-empty-state__icon" aria-hidden />
                <p>No activity recorded yet.</p>
              </div>
            ) : (
              <ol className="event-detail-timeline">
                {model.timeline.map(item => (
                  <li key={item.id} className={`event-detail-timeline__item event-detail-timeline__item--${item.kind}`}>
                    <span className="event-detail-timeline__dot" aria-hidden />
                    <div className="event-detail-timeline__content">
                      <div className="event-detail-timeline__head">
                        <strong>{item.label}</strong>
                        <span className="event-detail-timeline__chip">{item.kind}</span>
                      </div>
                      <span className="event-detail-timeline__when">{item.display}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Notes" subtitle="General, planning, and activity notes">
            {model.noteSections.length === 0 ? (
              <div className="event-detail-empty-state">
                <span className="event-detail-empty-state__icon" aria-hidden />
                <p>No notes recorded yet.</p>
              </div>
            ) : (
              <div className="event-detail-notes">
                {model.noteSections.map((n, i) => (
                  <article key={`${n.title}-${i}`} className="event-detail-note">
                    <h3 className="event-detail-subheading">{n.title}</h3>
                    <p>{n.body}</p>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="event-detail-rail">
          <Section
            title="Suggested next steps"
            subtitle="Recommended actions for this stage"
            className="event-detail-section--workflow"
          >
            <ol className="event-detail-workflow-steps">
              {model.nextSteps.map((step, i) => (
                <li key={step}>
                  <span className="event-detail-workflow-steps__marker" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="event-detail-workflow-steps__text">{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          {editable && model.statusQuickActions.length > 0 ? (
            <Section title="Status progression" className="event-detail-section--progression">
              <p className="event-detail-progression-help">
                Advance this event when the next milestone is complete.
              </p>
              <div className="event-detail-progression-actions">
                {model.statusQuickActions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    className="event-detail-progression-btn"
                    disabled={patchPending}
                    onClick={() => handleQuickStatus(action.patchStatus)}
                    title={action.description}
                  >
                    <span className="event-detail-progression-btn__label">{action.label}</span>
                    {action.description ? (
                      <span className="event-detail-progression-btn__desc">{action.description}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Documents" subtitle="Contracts, proposals, and event files">
            {model.documents.every(d => !d.onFile) && model.documentLinks.length === 0 ? (
              <div className="event-detail-empty-state event-detail-empty-state--compact">
                <span className="event-detail-empty-state__icon" aria-hidden />
                <p>No linked documents yet.</p>
              </div>
            ) : (
              <ul className="event-detail-doc-list">
                {model.documents.map(d => (
                  <li
                    key={d.key}
                    className={`event-detail-doc-item${d.onFile ? ' event-detail-doc-item--on' : ' event-detail-doc-item--off'}`}
                  >
                    <span className="event-detail-doc-item__icon" aria-hidden />
                    <span className="event-detail-doc-item__label">{d.label}</span>
                    <span className="event-detail-doc-item__status">{d.onFile ? 'On file' : 'Not linked'}</span>
                  </li>
                ))}
                {model.documentLinks.map(d => (
                  <li key={d.fileName} className="event-detail-doc-item event-detail-doc-item--on">
                    <span className="event-detail-doc-item__icon" aria-hidden />
                    <span className="event-detail-doc-item__label">{d.label}</span>
                    <span className="event-detail-doc-item__status">{d.fileName}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>

      {editOpen ? (
        <Modal
          title="Edit event details"
          onClose={() => setEditOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={patchPending}>
                {patchPending ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Event name</label>
              <input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Account / client</label>
              <input className="form-input" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Primary contact</label>
              <input className="form-input" value={editForm.contact} onChange={e => setEditForm(f => ({ ...f, contact: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Grand total</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: Number(e.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Event date</label>
              <input
                type="date"
                className="form-input"
                value={editForm.eventDateIso}
                onChange={e => setEditForm(f => ({ ...f, eventDateIso: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Start time</label>
              <input
                className="form-input"
                value={editForm.startTime}
                onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                placeholder="e.g. 6:00 PM"
              />
            </div>
            <div className="form-group">
              <label className="form-label">End time</label>
              <input
                className="form-input"
                value={editForm.endTime}
                onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                placeholder="e.g. 10:00 PM"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Guest count</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={editForm.guests}
                onChange={e => setEditForm(f => ({ ...f, guests: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Space / room</label>
              <input
                className="form-input"
                value={editForm.space}
                onChange={e => setEditForm(f => ({ ...f, space: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount paid</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input"
                value={editForm.amountPaid}
                onChange={e => setEditForm(f => ({ ...f, amountPaid: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Balance due</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input"
                value={editForm.balanceDue}
                onChange={e => setEditForm(f => ({ ...f, balanceDue: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last contacted</label>
              <input
                type="date"
                className="form-input"
                value={editForm.lastContactedIso}
                onChange={e => setEditForm(f => ({ ...f, lastContactedIso: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Owner</label>
              <input className="form-input" value={editForm.assignedTo} onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">CRM status</label>
              <select className="form-select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as DealStatus }))}>
                {DEAL_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={4} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      ) : null}

      {noteOpen ? (
        <Modal
          title="Add note"
          onClose={() => setNoteOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setNoteOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveNote}
                disabled={notePending || !noteSummary.trim() || !noteBody.trim()}
              >
                {notePending ? 'Saving…' : 'Save Note'}
              </button>
            </>
          }
        >
          {noteError ? <p className="event-detail-error">{noteError}</p> : null}
          <div className="form-group">
            <label className="form-label">Summary</label>
            <input className="form-input" value={noteSummary} onChange={e => setNoteSummary(e.target.value)} placeholder="Brief note title" />
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea className="form-textarea" rows={5} value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="What happened or what needs to happen next?" />
          </div>
        </Modal>
      ) : null}

      {patchPending ? (
        <div className="event-detail-saving" aria-live="polite">
          <Spinner /> Saving…
        </div>
      ) : null}
    </div>
  );
}
