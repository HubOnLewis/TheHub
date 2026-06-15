import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, dealStatusForDisplay } from '@hub-crm/shared';
import LiveEmptyState from '../live/LiveEmptyState.js';
import { Spinner } from '../ui/index.js';
import { opportunityDetailPath } from '../../config/paths.js';
import { useDeals } from '../../hooks/useDeals.js';
import { formatRelativeDate } from '../../config/productionData.js';
import { matchesDealFilter } from '../../lib/liveDataMappers.js';
import type { EventListFilter } from './opportunityLiveTypes.js';

export type { EventListFilter } from './opportunityLiveTypes.js';

function DealRow({ deal }: { deal: Record<string, unknown> }) {
  const id = String(deal._id ?? '');
  const status = String(deal.status ?? 'Draft');
  const amount = typeof deal.amount === 'number' ? deal.amount : 0;
  const exec = deal.dealExecutionState as { pressureLevel?: string } | undefined;
  const urgency = exec?.pressureLevel === 'critical' ? 'critical' : exec?.pressureLevel === 'high' ? 'high' : 'medium';

  return (
    <div className={`venue-intel-table__row--data venue-intel-row--${urgency}`}>
      <span className="venue-intel-table__cell">
        <strong>{String(deal.title ?? 'Event')}</strong>
        <span className="venue-intel-table__sub">{String(deal.company ?? '')}</span>
      </span>
      <span className="venue-intel-table__cell">
        <strong>{dealStatusForDisplay(status)}</strong>
        <span className="venue-intel-table__sub">Updated {formatRelativeDate(deal.updatedAt as string)}</span>
      </span>
      <span className="venue-intel-table__cell">
        <strong>{formatCurrency(amount)}</strong>
        <span className="venue-intel-table__sub">{String(deal.contact ?? '')}</span>
      </span>
      <span className="venue-intel-table__cell">
        <strong>{String(deal.assignedTo ?? 'Unassigned')}</strong>
        <span className="venue-intel-table__meta">{exec?.pressureLevel ?? 'normal'} pressure</span>
      </span>
    </div>
  );
}

export default function OpportunityLiveView({ filter = 'all' }: { filter?: EventListFilter }) {
  const { data, isLoading, isError } = useDeals({ active: true, limit: 100, sort: 'updatedAt', order: 'desc' });
  const deals = (data?.data ?? []) as Array<Record<string, unknown>>;

  const filtered = useMemo(
    () => deals.filter(d => matchesDealFilter(d, filter)),
    [deals, filter],
  );

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Spinner /> <span className="text-muted">Loading events…</span>
      </div>
    );
  }

  if (isError) {
    return <LiveEmptyState hint="Could not load events from the API." />;
  }

  if (filtered.length === 0) {
    return <LiveEmptyState />;
  }

  return (
    <div className="opp-intel-buckets">
      <section className="opp-bucket opp-bucket--slate">
        <div className="venue-intel-panel opp-bucket__body">
          <div className="venue-intel-table__row--head opp-bucket__cols">
            <span>Event</span>
            <span>Status · Updated</span>
            <span>Value</span>
            <span>Owner</span>
          </div>
          {filtered.map(d => {
            const id = String(d._id ?? '');
            return (
              <Link key={id} to={opportunityDetailPath(id)} className="venue-intel-table__link">
                <DealRow deal={d} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}