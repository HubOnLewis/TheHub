import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, DEAL_STATUSES, type DealStatus, type PatchDealPayload } from '@hub-crm/shared';
import { ROUTES, accountDetailPath } from '../../config/paths.js';
import { Modal, Spinner } from '../ui/index.js';
import type { EventDetailViewModel, EventDetailEditForm } from '../../lib/eventDetail.js';
import { buildEventDetailPatch, displayOrEmpty, eventDetailEditFormFromModel } from '../../lib/eventDetail.js';
import type { InteractionRow } from '../../hooks/useInteractions.js';

type Props = {
  model: EventDetailViewModel;
  onPatch?: (data: PatchDealPayload) => Promise<void>;
  onAddNote?: (summary: string, body: string) => Promise<void>;
  patchPending?: boolean;
  notePending?: boolean;
  patchError?: string | null;
  noteError?: string | null;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="event-detail-field">
      <dt className="event-detail-field__label">{label}</dt>
      <dd className="event-detail-field__value">{value}</dd>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card deal-panel event-detail-section${className ? ` ${className}` : ''}`}>
      <h2 className="deal-panel__title">{title}</h2>
      {children}
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
  tone?: 'warn' | 'ok';
}) {
  return (
    <div className={`event-detail-kpi${tone ? ` event-detail-kpi--${tone}` : ''}`}>
      <span className="event-detail-kpi__label">{label}</span>
      <strong className="event-detail-kpi__value">{value}</strong>
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

      <header className="event-detail-command-bar card">
        <div className="event-detail-command-bar__main">
          <span className="event-detail-eyebrow">Event record</span>
          <h1 className="event-detail-title">{model.title}</h1>
          <p className="event-detail-subtitle">
            <strong>{model.contact !== 'Not captured yet' ? model.contact : model.company}</strong>
            {model.company !== 'Not captured yet' && model.contact !== 'Not captured yet'
              ? ` · ${model.company}`
              : ''}
          </p>
          <div className="event-detail-meta-row">
            <span className="event-detail-status event-detail-status-pill">
              {model.statusLabel}
            </span>
            <span className="event-detail-meta">{model.eventDateDisplay}</span>
            {model.eventTimeDisplay !== 'Not captured yet' ? (
              <span className="event-detail-meta">{model.eventTimeDisplay}</span>
            ) : null}
            <span className="event-detail-meta">Owner · {model.owner}</span>
            <span className="event-detail-meta">Updated · {model.updatedDisplay}</span>
          </div>
          {model.urgencyNote ? (
            <p className={`event-detail-urgency${model.followUpRisk ? ' event-detail-urgency--warn' : ''}`}>
              {model.urgencyNote}
            </p>
          ) : null}
        </div>
        <div className="event-detail-command-bar__actions">
          {editable ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
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
              <button type="button" className="btn btn-secondary" onClick={openEdit} disabled={patchPending}>
                Edit Details
              </button>
              {canAddNote ? (
                <button type="button" className="btn btn-secondary" onClick={() => setNoteOpen(true)}>
                  Add Note
                </button>
              ) : null}
            </>
          ) : null}
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
        <KpiCard label="Event date" value={model.eventDateDisplay} hint={timingLabel ?? undefined} />
        <KpiCard label="Last activity" value={model.lastContactedDisplay} hint={model.followUpRisk ? 'Follow-up risk' : undefined} tone={model.followUpRisk ? 'warn' : undefined} />
      </div>

      <div className="event-detail-grid">
        <div className="event-detail-main">
          <Section title="Event overview">
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

          <Section title="Client & contact">
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

          <Section title="Financials">
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
                <ul className="event-detail-list">
                  {model.payments.map((p, i) => (
                    <li key={`${p.date}-${p.amount}-${i}`}>
                      <strong>{formatCurrency(p.amount)}</strong>
                      {p.date ? ` · ${p.date}` : ''}
                      {p.method ? ` · ${p.method}` : ''}
                      {p.type ? ` · ${p.type}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          <Section title="Event plan">
            <dl className="event-detail-fields">
              {model.planFields.map(f => (
                <Field key={f.label} label={f.label} value={f.value} />
              ))}
            </dl>
          </Section>

          <Section title="Activity timeline">
            {model.timeline.length === 0 ? (
              <p className="event-detail-empty">No activity recorded yet.</p>
            ) : (
              <ol className="event-detail-timeline">
                {model.timeline.map(item => (
                  <li key={item.id} className={`event-detail-timeline__item event-detail-timeline__item--${item.kind}`}>
                    <span className="event-detail-timeline__dot" aria-hidden />
                    <div>
                      <strong>{item.label}</strong>
                      <span className="event-detail-timeline__when">{item.display}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Notes">
            {model.noteSections.length === 0 ? (
              <p className="event-detail-empty">No notes recorded yet.</p>
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
          <Section title="Suggested next steps">
            <ul className="event-detail-checklist">
              {model.nextSteps.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </Section>

          {model.statusQuickActions.length > 0 ? (
            <Section title="Status progression">
              <div className="event-detail-actions-stack">
                {model.statusQuickActions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={patchPending}
                    onClick={() => handleQuickStatus(action.patchStatus)}
                    title={action.description}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Documents">
            {model.documents.every(d => !d.onFile) && model.documentLinks.length === 0 ? (
              <p className="event-detail-empty">No linked documents yet.</p>
            ) : (
              <ul className="event-detail-list">
                {model.documents.map(d => (
                  <li key={d.key} className={d.onFile ? 'event-detail-doc--on' : 'event-detail-doc--off'}>
                    {d.label}
                    {d.onFile ? ' · on file' : ' · not linked'}
                  </li>
                ))}
                {model.documentLinks.map(d => (
                  <li key={d.fileName}>
                    {d.label} · {d.fileName}
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
