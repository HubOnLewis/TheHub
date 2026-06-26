import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import type { CreateLeadPayload } from '@hub-crm/shared';
import { ROUTES, opportunityDetailPath } from '../../config/paths.js';
import type { LeadDetailViewModel } from '../../lib/leadDetail.js';
import { displayOrEmpty } from '../../lib/leadDetail.js';

type Props = {
  model: LeadDetailViewModel;
  onPatch?: (data: Partial<CreateLeadPayload>) => Promise<void>;
};

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

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'ok' }) {
  const isEmpty = value === 'Not captured yet';
  return (
    <div className={`event-detail-kpi${tone ? ` event-detail-kpi--${tone}` : ''}`}>
      <span className="event-detail-kpi__label">{label}</span>
      <strong className={`event-detail-kpi__value${isEmpty ? ' event-detail-kpi__value--empty' : ''}`}>
        {isEmpty ? <span className="event-detail-placeholder">{value}</span> : value}
      </strong>
    </div>
  );
}

export default function LeadDetailCommandCenter({ model }: Props) {
  const valueDisplay =
    model.estimatedValue && !Number.isNaN(Number(model.estimatedValue))
      ? formatCurrency(Number(model.estimatedValue))
      : 'Not captured yet';

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
              <Link to={opportunityDetailPath(model.linkedEventId)} className="btn btn-primary event-detail-hero__btn-primary">
                View linked event
              </Link>
            ) : null}
            <Link to={ROUTES.opportunities} className="btn btn-secondary event-detail-hero__btn-secondary">
              View events
            </Link>
          </div>
        </div>
      </header>

      <div className="event-detail-kpi-row lead-detail-kpi-row">
        <KpiCard label="Status" value={model.statusLabel} />
        <KpiCard label="Desired date" value={displayOrEmpty(model.eventDateHint)} />
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
                <Field label="Inquiry summary" value={displayOrEmpty(model.inquirySummary)} />
                <Field label="Desired date" value={displayOrEmpty(model.eventDateHint)} />
                <Field label="Created" value={model.createdDisplay} />
                <Field label="Last updated" value={model.updatedDisplay} />
              </dl>
              {model.notes ? (
                <article className="event-detail-note" style={{ marginTop: 16 }}>
                  <h3 className="event-detail-subheading">Notes</h3>
                  <p>{model.notes}</p>
                </article>
              ) : (
                <p className="event-detail-empty-state event-detail-empty-state--compact" style={{ marginTop: 16 }}>
                  No notes recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="event-detail-rail">
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
                  Reference inquiry record — view the linked event for full operational detail when available.
                </p>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
