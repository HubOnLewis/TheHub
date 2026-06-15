import { Link, useParams } from 'react-router-dom';
import { formatCurrency, dealStatusForDisplay, HUB_LABELS } from '@hub-crm/shared';
import { ROUTES } from '../../config/paths.js';
import { Spinner } from '../../components/ui/index.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
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
  const amount = typeof deal.amount === 'number' ? deal.amount : 0;
  const status = String(deal.status ?? 'Draft');
  const assignedTo = String(deal.assignedTo ?? 'Unassigned');
  const notes = typeof deal.notes === 'string' ? deal.notes : '';

  return (
    <div className="deal-flagship-page command-page">
      <div style={{ marginBottom: 16 }}>
        <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12 }}>
          ← Events
        </Link>
      </div>

      <header className="flagship-hero flagship-hero--cinematic">
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
              {dealStatusForDisplay(status)}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Revenue</div>
            <div className="flagship-stat__value">{formatCurrency(amount)}</div>
          </div>
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

      {notes ? (
        <section className="card deal-panel" style={{ marginTop: 16 }}>
          <div className="deal-panel__title">Notes</div>
          <p className="text-sm">{notes}</p>
        </section>
      ) : null}

      <p className="text-sm text-muted" style={{ marginTop: 16 }}>
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