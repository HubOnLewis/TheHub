import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency, type LeadStatus, type PatchLeadPayload } from '@hub-crm/shared';
import { Modal } from '../ui/index.js';
import { ROUTES, opportunityDetailPath } from '../../config/paths.js';
import {
  LEAD_STATUSES,
  buildLeadDetailPatch,
  displayOrEmpty,
  leadDetailEditFormFromModel,
  type LeadDetailEditForm,
  type LeadDetailViewModel,
} from '../../lib/leadDetail.js';
import { useDealMutations } from '../../hooks/useDeals.js';
import { useAppStore } from '../../store/index.js';
import LeadAiAssist from '../venue/LeadAiAssist.js';

type Props = {
  model: LeadDetailViewModel;
  onPatch?: (data: PatchLeadPayload) => Promise<void>;
  patchPending?: boolean;
  patchError?: string | null;
};

const EVENT_TYPES = [
  'Wedding',
  'Corporate',
  'Birthday',
  'Graduation',
  'Baby shower',
  'Fundraiser',
  'Private party',
  'Other',
] as const;

const SPACES = ['Main Hall', 'Gallery', 'Patio', 'Full venue', 'TBD'] as const;

function Field({ label, value }: { label: string; value: string }) {
  const isEmpty = value === 'Not captured yet';
  return (
    <div className="event-detail-field">
      <dt className="event-detail-field__label">{label}</dt>
      <dd className={`event-detail-field__value${isEmpty ? ' event-detail-field__value--empty' : ''}`}>
        {isEmpty ? <span className="event-detail-placeholder">{value}</span> : value}
      </dd>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  const isEmpty = value === 'Not captured yet';
  return (
    <div className="event-detail-kpi">
      <span className="event-detail-kpi__label">{label}</span>
      <strong className={`event-detail-kpi__value${isEmpty ? ' event-detail-kpi__value--empty' : ''}`}>
        {isEmpty ? <span className="event-detail-placeholder">{value}</span> : value}
      </strong>
    </div>
  );
}

export default function LeadDetailCommandCenter({
  model,
  onPatch,
  patchPending = false,
  patchError = null,
}: Props) {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const { create } = useDealMutations();
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<LeadDetailEditForm>(() => leadDetailEditFormFromModel(model));
  const [noteDraft, setNoteDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const editable = model.canPatch && Boolean(onPatch);
  const valueDisplay =
    model.estimatedValue && !Number.isNaN(Number(model.estimatedValue))
      ? formatCurrency(Number(model.estimatedValue))
      : 'Not captured yet';

  const openEdit = () => {
    setEditForm(leadDetailEditFormFromModel(model));
    setLocalError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!onPatch) return;
    setLocalError(null);
    try {
      await onPatch(buildLeadDetailPatch(editForm));
      setEditOpen(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save lead');
    }
  };

  const advanceStatus = async (status: LeadStatus) => {
    if (!onPatch) return;
    setLocalError(null);
    try {
      await onPatch({ status });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not update status');
    }
  };

  const saveNote = async () => {
    if (!onPatch || !noteDraft.trim()) return;
    setLocalError(null);
    const nextNotes = model.notes
      ? `${model.notes}\n\n${noteDraft.trim()}`
      : noteDraft.trim();
    try {
      await onPatch({ notes: nextNotes });
      setNoteDraft('');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save note');
    }
  };

  const convertToEvent = async () => {
    if (model.linkedEventId) {
      navigate(opportunityDetailPath(model.linkedEventId));
      return;
    }
    if (model.isReferenceOnly) {
      setConvertError('Reference inquiry — open the linked event or create a new booking from Home.');
      return;
    }
    setConverting(true);
    setConvertError(null);
    try {
      const amount = Number(model.estimatedValue) || 0;
      const created = (await create.mutateAsync({
        title: model.title || `${model.contact} event`,
        company: model.company === 'Not captured yet' ? model.contact : model.company,
        contact: model.contact === 'Not captured yet' ? 'Contact' : model.contact,
        amount,
        assignedTo: model.owner !== 'Not captured yet' ? model.owner : user?.name || undefined,
        leadId: model.id,
        notes: model.notes || undefined,
        status: 'Draft',
        importMeta: {
          source: 'lead_convert',
          leadId: model.id,
          contactEmail: model.email || undefined,
          contactPhone: model.phone || undefined,
          leadSource: model.source || undefined,
          eventDateIso: model.eventDateHint || undefined,
          guests: model.guestCount ? Number(model.guestCount) : undefined,
          eventType: model.eventType || undefined,
          space: model.spacePreference || undefined,
          grandTotal: amount,
          amountPaid: 0,
          balanceDue: amount,
          pvStatus: 'qualified',
        },
      })) as { _id?: string };
      const newId = created?._id;
      if (newId) navigate(`${opportunityDetailPath(String(newId))}?fromLead=1`);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Could not convert lead');
    } finally {
      setConverting(false);
    }
  };

  const errorMsg = localError || patchError || convertError;

  return (
    <div className="event-command-center lead-command-center hub-demo-deal-page">
      <div className="event-detail-back">
        <Link to={ROUTES.leads} className="btn btn-ghost btn-sm">
          ← Back to Leads
        </Link>
      </div>

      <header className="event-detail-hero">
        <div className="event-detail-hero__glow" aria-hidden />
        <div className="event-detail-hero__inner">
          <div className="event-detail-hero__main">
            <span className="event-detail-eyebrow">Lead inquiry</span>
            <h1 className="event-detail-title">{model.title}</h1>
            <p className="event-detail-subtitle">
              <strong>{model.contact}</strong>
              {model.company !== 'Not captured yet' && model.contact !== model.company
                ? ` · ${model.company}`
                : ''}
            </p>
            <div className="event-detail-pill-row">
              <span className="event-detail-pill event-detail-pill--status">{model.statusLabel}</span>
              {model.source ? (
                <span className="event-detail-pill event-detail-pill--date">{model.source}</span>
              ) : null}
              <span className="event-detail-pill event-detail-pill--owner">
                {model.owner !== 'Not captured yet' ? model.owner : 'Unassigned'}
              </span>
            </div>
            <p className="event-detail-hero__updated">
              Last activity · {model.lastActivityDisplay}
            </p>
          </div>
          <div className="event-detail-hero__actions">
            {model.linkedEventId ? (
              <Link
                to={opportunityDetailPath(model.linkedEventId)}
                className="btn btn-primary event-detail-hero__btn-primary"
              >
                View linked event
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary event-detail-hero__btn-primary"
                disabled={converting || model.status === 'Lost' || model.status === 'Converted'}
                onClick={() => void convertToEvent()}
              >
                {converting ? 'Converting…' : model.status === 'Converted' ? 'Already converted' : 'Convert to event'}
              </button>
            )}
            {editable ? (
              <button type="button" className="btn btn-secondary event-detail-hero__btn-secondary" onClick={openEdit}>
                Edit inquiry
              </button>
            ) : (
              <Link to={ROUTES.opportunities} className="btn btn-secondary event-detail-hero__btn-secondary">
                View events
              </Link>
            )}
          </div>
        </div>
      </header>

      {errorMsg ? (
        <div className="event-detail-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <div className="event-detail-kpi-row lead-detail-kpi-row">
        <KpiCard label="Status" value={model.statusLabel} />
        <KpiCard label="Desired date" value={displayOrEmpty(model.eventDateHint)} />
        <KpiCard label="Guests" value={displayOrEmpty(model.guestCount)} />
        <KpiCard label="Estimated value" value={valueDisplay} />
        <KpiCard label="Last activity" value={model.lastActivityDisplay} />
      </div>

      <div className="event-detail-grid">
        <div className="event-detail-main">
          <section className="event-detail-section">
            <header className="event-detail-section__header">
              <span className="event-detail-section__accent" aria-hidden />
              <div className="event-detail-section__heading">
                <h2 className="event-detail-section__title">Contact</h2>
                <p className="event-detail-section__subtitle">Primary contact and account details</p>
              </div>
            </header>
            <div className="event-detail-section__body">
              <dl className="event-detail-fields event-detail-fields--grid">
                <Field label="Contact name" value={model.contact} />
                <Field label="Account / company" value={model.company} />
                <Field label="Email" value={displayOrEmpty(model.email)} />
                <Field label="Phone" value={displayOrEmpty(model.phone)} />
                <Field label="Owner" value={model.owner} />
                <Field label="Lead source" value={displayOrEmpty(model.source)} />
              </dl>
            </div>
          </section>

          <section className="event-detail-section">
            <header className="event-detail-section__header">
              <span className="event-detail-section__accent" aria-hidden />
              <div className="event-detail-section__heading">
                <h2 className="event-detail-section__title">Inquiry details</h2>
                <p className="event-detail-section__subtitle">What the client is asking for</p>
              </div>
            </header>
            <div className="event-detail-section__body">
              <dl className="event-detail-fields event-detail-fields--grid">
                <Field label="Event type" value={displayOrEmpty(model.eventType)} />
                <Field label="Desired date" value={displayOrEmpty(model.eventDateHint)} />
                <Field label="Guest count" value={displayOrEmpty(model.guestCount)} />
                <Field label="Space preference" value={displayOrEmpty(model.spacePreference)} />
                <Field label="Inquiry summary" value={displayOrEmpty(model.inquirySummary)} />
                <Field label="Created" value={model.createdDisplay} />
              </dl>
              {model.notes ? (
                <article className="event-detail-note" style={{ marginTop: 16 }}>
                  <h3 className="event-detail-subheading">Notes</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{model.notes}</p>
                </article>
              ) : (
                <p className="event-detail-empty-state event-detail-empty-state--compact" style={{ marginTop: 16 }}>
                  No notes recorded yet.
                </p>
              )}
              {editable ? (
                <div className="lead-note-compose" style={{ marginTop: 16 }}>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Add a note about this inquiry…"
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: 8 }}
                    disabled={patchPending || !noteDraft.trim()}
                    onClick={() => void saveNote()}
                  >
                    Add note
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <LeadAiAssist
            model={model}
            onSaveNote={
              editable
                ? async body => {
                    if (!onPatch) return;
                    const nextNotes = model.notes ? `${model.notes}\n\n${body.trim()}` : body.trim();
                    await onPatch({ notes: nextNotes });
                  }
                : undefined
            }
          />
        </div>

        <aside className="event-detail-rail">
          {editable && model.status !== 'Converted' && model.status !== 'Lost' ? (
            <section className="event-detail-section">
              <header className="event-detail-section__header">
                <span className="event-detail-section__accent" aria-hidden />
                <div className="event-detail-section__heading">
                  <h2 className="event-detail-section__title">Pipeline status</h2>
                  <p className="event-detail-section__subtitle">Advance this inquiry</p>
                </div>
              </header>
              <div className="event-detail-section__body">
                <div className="lead-status-actions">
                  {LEAD_STATUSES.filter(s => s !== 'Converted').map(status => (
                    <button
                      key={status}
                      type="button"
                      className={`btn btn-sm ${model.status === status ? 'btn-primary' : 'btn-secondary'}`}
                      disabled={patchPending || model.status === status}
                      onClick={() => void advanceStatus(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="event-detail-section event-detail-section--workflow">
            <header className="event-detail-section__header">
              <span className="event-detail-section__accent" aria-hidden />
              <div className="event-detail-section__heading">
                <h2 className="event-detail-section__title">Suggested next steps</h2>
                <p className="event-detail-section__subtitle">Work this inquiry toward a confirmed event</p>
              </div>
            </header>
            <div className="event-detail-section__body">
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
            </div>
          </section>

          {model.isReferenceOnly ? (
            <section className="event-detail-section">
              <header className="event-detail-section__header">
                <span className="event-detail-section__accent" aria-hidden />
                <div className="event-detail-section__heading">
                  <h2 className="event-detail-section__title">Record source</h2>
                </div>
              </header>
              <div className="event-detail-section__body">
                <p className="event-detail-section__subtitle" style={{ margin: 0 }}>
                  Reference inquiry — view the linked event for full operational detail when available.
                </p>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {editOpen ? (
        <Modal
          title="Edit inquiry details"
          onClose={() => setEditOpen(false)}
          width={640}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={patchPending}>
                {patchPending ? 'Saving…' : 'Save changes'}
              </button>
            </>
          }
        >
          <div className="form-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Contact name</span>
              <input className="form-input" value={editForm.contact} onChange={e => setEditForm(f => ({ ...f, contact: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Account / company</span>
              <input className="form-input" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Email</span>
              <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Phone</span>
              <input className="form-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Source</span>
              <input className="form-input" value={editForm.source} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Owner</span>
              <input className="form-input" value={editForm.assignedTo} onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Status</span>
              <select className="form-select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as LeadStatus }))}>
                {LEAD_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Desired date</span>
              <input className="form-input" type="date" value={editForm.eventDate} onChange={e => setEditForm(f => ({ ...f, eventDate: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Event type</span>
              <select className="form-select" value={editForm.eventType} onChange={e => setEditForm(f => ({ ...f, eventType: e.target.value }))}>
                <option value="">Not captured yet</option>
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Guest count</span>
              <input className="form-input" type="number" min={0} value={editForm.guestCount} onChange={e => setEditForm(f => ({ ...f, guestCount: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Space preference</span>
              <select className="form-select" value={editForm.spacePreference} onChange={e => setEditForm(f => ({ ...f, spacePreference: e.target.value }))}>
                <option value="">Not captured yet</option>
                {SPACES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6 }}>
              <span>Estimated value</span>
              <input className="form-input" type="number" min={0} value={editForm.estimatedValue} onChange={e => setEditForm(f => ({ ...f, estimatedValue: e.target.value }))} />
            </label>
            <label className="form-field" style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
              <span>Notes</span>
              <textarea className="form-textarea" rows={4} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
