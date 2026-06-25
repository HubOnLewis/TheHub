import { Link, useParams } from 'react-router-dom';
import { formatCurrency, dealStatusForDisplay, HUB_LABELS } from '@hub-crm/shared';
import { pvStatusDisplay, type PvEventStatus } from '../../data/perfectVenueSeed.js';
import { ROUTES } from '../../config/paths.js';
import { Spinner } from '../../components/ui/index.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
import { isHubContaminatedRecord } from '@hub-crm/shared';
import { formatRelativeDate } from '../../config/productionData.js';
import { getFullPvEventById } from '../../data/pvDataLayer.js';
import DealDetailImported from './DealDetailImported.js';

type Props = {
  deal: Record<string, unknown>;
};

export default function DealDetailLive({ deal }: Props) {
  const id = String(deal._id ?? '');
  const title = String(deal.title ?? 'Event');
  const company = String(deal.company ?? '');
  const contact = String(deal.contact ?? '');
  const importMeta =
    deal.importMeta && typeof deal.importMeta === 'object'
      ? (deal.importMeta as Record<string, unknown>)
      : null;
  const grandTotal =
    typeof importMeta?.grandTotal === 'number'
      ? importMeta.grandTotal
      : typeof deal.amount === 'number'
        ? deal.amount
        : 0;
  const amountPaid = typeof importMeta?.amountPaid === 'number' ? importMeta.amountPaid : null;
  const balanceDue = typeof importMeta?.balanceDue === 'number' ? importMeta.balanceDue : null;
  const pvStatus = importMeta?.pvStatus ? String(importMeta.pvStatus) : null;
  const status = String(deal.status ?? 'Draft');
  const statusLabel = pvStatus
    ? pvStatusDisplay(pvStatus as PvEventStatus)
    : dealStatusForDisplay(status);
  const assignedTo = String(deal.assignedTo ?? 'Unassigned');
  const notes = typeof deal.notes === 'string' ? deal.notes : '';
  const documents = importMeta?.documents as Record<string, boolean> | undefined;
  const payments = Array.isArray(importMeta?.payments) ? importMeta.payments : [];

  return (
    <div className="deal-flagship-page command-page hub-demo-deal-page">
      <div style={{ marginBottom: 16 }}>
        <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12 }}>
          ← Events
        </Link>
      </div>

      <header className="flagship-hero flagship-hero--cinematic hub-demo-deal-hero">
        <div>
          <span className="ai-chip">Event</span>
          <h1>{title}</h1>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {HUB_LABELS.client}: <strong style={{ color: 'var(--text-primary)' }}>{company}</strong>
            {contact ? ` · ${contact}` : ''}
          </div>
        </div>

        <div className="flagship-grid" style={{ marginTop: 22 }}>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Status</div>
            <div className="flagship-stat__value" style={{ fontSize: 15 }}>
              {statusLabel}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Grand Total</div>
            <div className="flagship-stat__value">{formatCurrency(grandTotal)}</div>
          </div>
          {amountPaid != null ? (
            <div className="flagship-stat">
              <div className="flagship-stat__label">Amount Paid</div>
              <div className="flagship-stat__value">{formatCurrency(amountPaid)}</div>
            </div>
          ) : null}
          {balanceDue != null ? (
            <div className="flagship-stat">
              <div className="flagship-stat__label">Balance Due</div>
              <div className="flagship-stat__value">{formatCurrency(balanceDue)}</div>
            </div>
          ) : null}
          <div className="flagship-stat">
            <div className="flagship-stat__label">Owner</div>
            <div className="flagship-stat__value" style={{ fontSize: 15 }}>
              {assignedTo}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Last updated</div>
            <div className="flagship-stat__value" style={{ fontSize: 15 }}>
              {formatRelativeDate(deal.updatedAt as string)}
            </div>
          </div>
        </div>
      </header>

      {documents ? (
        <section className="card deal-panel" style={{ marginTop: 16 }}>
          <div className="deal-panel__title">Documents</div>
          <ul className="settings-list">
            {documents.eventSummary ? <li>Event summary on file</li> : null}
            {documents.beo ? <li>BEO on file</li> : null}
            {documents.staffBeo ? <li>Staff BEO on file</li> : null}
            {documents.invoice ? <li>Invoice on file</li> : null}
            {documents.agreement ? <li>Agreement on file</li> : null}
            {documents.menu ? <li>Menu on file</li> : null}
            {!Object.values(documents).some(Boolean) ? (
              <li className="settings-muted">No linked documents in refresh import</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {payments.length > 0 ? (
        <section className="card deal-panel" style={{ marginTop: 16 }}>
          <div className="deal-panel__title">Payment history</div>
          <ul className="settings-list">
            {(payments as Array<Record<string, unknown>>).map((p, i) => (
              <li key={i}>
                {formatCurrency(typeof p.amount === 'number' ? p.amount : 0)}
                {p.paymentDate ? ` · ${String(p.paymentDate).slice(0, 10)}` : ''}
                {p.method ? ` · ${String(p.method)}` : ''}
                {p.paymentType ? ` · ${String(p.paymentType)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notes ? (
        <section className="card deal-panel" style={{ marginTop: 16 }}>
          <div className="deal-panel__title">Notes</div>
          <p className="text-sm">{notes}</p>
        </section>
      ) : null}

      <p className="text-sm text-muted deal-tech-meta" style={{ marginTop: 16 }}>
        Event ID: {id}
      </p>
    </div>
  );
}

export function DealDetailLiveShell({
  isLoading,
  isError,
  deal,
}: {
  isLoading: boolean;
  isError: boolean;
  deal: Record<string, unknown> | undefined;
}) {
  const { dealId } = useParams<{ dealId: string }>();

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (deal) {
    if (
      isHubContaminatedRecord({
        title: String(deal.title ?? ''),
        company: String(deal.company ?? ''),
        contact: String(deal.contact ?? ''),
        notes: typeof deal.notes === 'string' ? deal.notes : undefined,
        unitId: typeof deal.unitId === 'string' ? deal.unitId : undefined,
        unitIds: Array.isArray(deal.unitIds) ? (deal.unitIds as string[]) : undefined,
      })
    ) {
      if (dealId && getFullPvEventById(dealId)) {
        return <DealDetailImported dealId={dealId} />;
      }
      return (
        <div className="page-simple hub-demo-deal-page">
          <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 16 }}>
            ← Events
          </Link>
          <div className="card page-section">
            <LiveEmptyState hint="This record is not part of the venue event CRM." />
          </div>
        </div>
      );
    }
    return <DealDetailLive deal={deal} />;
  }

  if (dealId && getFullPvEventById(dealId)) {
    return <DealDetailImported dealId={dealId} />;
  }

  return (
    <div className="page-simple">
      <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 16 }}>
        ← Events
      </Link>
      <div className="card page-section">
        <LiveEmptyState hint={isError ? 'This event was not found in CRM.' : undefined} />
      </div>
    </div>
  );
}