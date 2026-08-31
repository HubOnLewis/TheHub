import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  formatCurrency,
  DEAL_STATUSES,
  dealStatusForDisplay,
  type DealStatus,
  type PatchDealPayload,
} from '@hub-crm/shared';
import { ROUTES, accountDetailPath } from '../../config/paths.js';
import { PORTAL_ROUTES } from '../../portal/paths.js';
import { Modal, Spinner } from '../ui/index.js';
import type { EventDetailViewModel, EventDetailEditForm } from '../../lib/eventDetail.js';
import {
  buildEventDetailPatch,
  CRM_STATUS_TO_PV,
  displayOrEmpty,
  eventDetailEditFormFromModel,
} from '../../lib/eventDetail.js';
import EventMoneyPanel from '../venue/EventMoneyPanel.js';
import EventDocsPanel from '../venue/EventDocsPanel.js';
import VenueStageStepper from '../venue/VenueStageStepper.js';
import EventAiAssist from '../venue/EventAiAssist.js';
import { openVenueDocument } from '../../venue/documentGenerator.js';
import client from '../../api/client.js';

type EventTab = 'overview' | 'money' | 'docs' | 'activity' | 'portal';

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
  const isEmail = label.toLowerCase() === 'email' && value.includes('@');
  const isPhone = label.toLowerCase() === 'phone' && !isEmpty && /[\d+]/.test(value);
  return (
    <div className="event-detail-field">
      <dt className="event-detail-field__label">{label}</dt>
      <dd className={`event-detail-field__value${isEmpty ? ' event-detail-field__value--empty' : ''}`}>
        {isEmpty ? (
          <span className="event-detail-placeholder">{value}</span>
        ) : isEmail ? (
          <a href={`mailto:${value}`}>{value}</a>
        ) : isPhone ? (
          <a href={`tel:${value.replace(/[^\d+]/g, '')}`}>{value}</a>
        ) : (
          value
        )}
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
  const [tab, setTab] = useState<EventTab>('overview');
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const fromLead = searchParams.get('fromLead') === '1';

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const copyText = (text: string, ok: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => flash(ok),
      () => window.prompt('Copy this link:', text),
    );
  };

  const portalLoginPath = `${PORTAL_ROUTES.login}?event=${encodeURIComponent(model.id)}`;
  const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${portalLoginPath}`;

  const copyGuestLink = async (pay = false) => {
    try {
      const { data } = await client.post<{ path: string }>(`/portal/links/${model.id}`);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}${data.path}${pay ? '&pay=1' : ''}`;
      copyText(url, pay ? 'Signed pay link copied.' : 'Signed guest portal link copied.');
    } catch {
      copyText(pay ? `${portalUrl}&pay=1` : portalUrl, 'Guest link copied (staff session may be required).');
    }
  };

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
      const pvStatus = CRM_STATUS_TO_PV[patchStatus];
      await onPatch({
        status: patchStatus,
        importMeta: pvStatus
          ? {
              pvStatus,
              ...(patchStatus === 'Won' || patchStatus === 'In Build' || patchStatus === 'Delivered'
                ? { amountPaid: model.amountPaid, balanceDue: model.balanceDue, grandTotal: model.grandTotal }
                : {}),
            }
          : undefined,
      });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not update status');
    }
  };

  const runPrimaryAction = () => {
    const stage = model.pipelineStage;
    if (stage === 'proposal_sent' || stage === 'balance_due' || /deposit|balance|collect/i.test(model.primaryActionLabel)) {
      setTab('money');
      return;
    }
    if (stage === 'qualified' || /proposal/i.test(model.primaryActionLabel)) {
      setTab('docs');
      openVenueDocument('proposal', model);
      return;
    }
    if (stage === 'confirmed' || /prep|plan/i.test(model.primaryActionLabel)) {
      setTab('docs');
      return;
    }
    const first = model.statusQuickActions[0];
    if (first?.patchStatus) {
      void handleQuickStatus(first.patchStatus);
    } else if (canAddNote) {
      setNoteOpen(true);
    } else {
      openEdit();
    }
  };

  return (
    <div className="event-command-center hub-demo-deal-page">
      <div className="event-detail-back">
        <Link to={ROUTES.opportunities} className="btn btn-ghost btn-sm">
          ← Back to Events
        </Link>
      </div>

      <VenueStageStepper pipelineStage={model.pipelineStage} />

      {fromLead ? (
        <div className="event-from-lead-banner" role="status">
          Converted from a lead inquiry. Confirm date, guests, and space, then send a proposal or deposit link.
        </div>
      ) : null}

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
                  onClick={runPrimaryAction}
                >
                  {model.primaryActionLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary event-detail-hero__btn-secondary"
                  onClick={openEdit}
                  disabled={patchPending}
                >
                  Edit details
                </button>
                <div className="event-detail-hero__secondary">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openVenueDocument('proposal', model)}
                  >
                    Proposal
                  </button>
                  {canAddNote ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNoteOpen(true)}>
                      Add note
                    </button>
                  ) : null}
                  <a
                    className="btn btn-ghost btn-sm"
                    href={`${PORTAL_ROUTES.login}?event=${encodeURIComponent(model.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Guest portal
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void copyGuestLink(false)}
                  >
                    Copy guest link
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary event-detail-hero__btn-secondary"
                onClick={() => openVenueDocument('proposal', model)}
              >
                Generate proposal
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="event-detail-tabs" aria-label="Event sections">
        {(
          [
            ['overview', 'Overview'],
            ['money', 'Money'],
            ['docs', 'Docs'],
            ['activity', 'Activity'],
            ['portal', 'Portal'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`event-detail-tabs__btn${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

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
          {tab === 'overview' ? (
            <>
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

          <Section title="Event plan" subtitle="Operational planning and execution notes">
            <dl className="event-detail-fields">
              {model.planFields.map(f => (
                <Field key={f.label} label={f.label} value={f.value} />
              ))}
            </dl>
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
            </>
          ) : null}

          {tab === 'money' ? (
            <Section title="Payments & balances" subtitle="Deposit and balance links · payment history">
              <EventMoneyPanel model={model} onPatch={onPatch} patchPending={patchPending} />
            </Section>
          ) : null}

          {tab === 'docs' ? (
            <Section title="Documents" subtitle="Proposals, BEOs, and payment summaries">
              <EventDocsPanel model={model} />
            </Section>
          ) : null}

          {tab === 'activity' ? (
            <>
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
            <EventAiAssist
              model={model}
              onSaveNote={canAddNote ? onAddNote : undefined}
            />
            </>
          ) : null}

          {tab === 'portal' ? (
            <Section title="Guest portal" subtitle="What the client sees — share one link">
              <div className="event-portal-preview">
                <div className="event-portal-preview__card">
                  <span className="event-portal-preview__eyebrow">Guest view</span>
                  <strong className="event-portal-preview__title">{model.title}</strong>
                  <p>
                    {model.eventDateDisplay !== EMPTY ? model.eventDateDisplay : 'Date not captured yet'}
                    {model.guests != null ? ` · ${model.guests} guests` : ''}
                    {model.space ? ` · ${model.space}` : ''}
                  </p>
                  <p className="event-portal-preview__money">
                    {model.grandTotal != null ? formatCurrency(model.grandTotal) : 'Package not captured'}
                    {hasBalanceDue ? ` · ${formatCurrency(model.balanceDue!)} remaining` : ' · Paid in full'}
                  </p>
                </div>
                <div className="event-portal-panel">
                  <p>
                    Guests use a signed link (not the raw event id). Card charges are not live until Stripe is
                    connected — staff can still record payments on the Money tab.
                  </p>
                  <div className="event-portal-panel__actions">
                    <a
                      className="btn btn-primary"
                      href={`${PORTAL_ROUTES.login}?event=${encodeURIComponent(model.id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview guest portal
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void copyGuestLink(false)}
                    >
                      Copy guest link
                    </button>
                    {hasBalanceDue ? (
                      <button type="button" className="btn btn-ghost" onClick={() => void copyGuestLink(true)}>
                        Copy pay link
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Section>
          ) : null}
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

          <Section title="Quick tools" subtitle="Money · docs · portal">
            <div className="event-detail-quick-tools">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('money')}>
                Payment links
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openVenueDocument('beo', model)}>
                Generate BEO
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('portal')}>
                Portal share
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('activity')}>
                AI drafts
              </button>
            </div>
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
                  <option key={s} value={s}>{dealStatusForDisplay(s)}</option>
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
      {toast ? (
        <div className="hub-copy-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
