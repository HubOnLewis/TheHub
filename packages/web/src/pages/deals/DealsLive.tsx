import { useMemo, useState } from 'react';
import { formatCurrency } from '@hub-crm/shared';
import OpsIntelShell from '../../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../../components/operations/intel/OpsFilterChips.js';
import OpportunityLiveView, { type EventListFilter } from '../../components/opportunities/OpportunityLiveView.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
import { Spinner } from '../../components/ui/index.js';
import { useDeals } from '../../hooks/useDeals.js';
import { hasImportedVenueRecords } from '../../lib/operationalSource.js';
import { countDealPressure, matchesDealFilter } from '../../lib/liveDataMappers.js';
import DealsImported from './DealsImported.js';

export default function DealsLive() {
  const [filter, setFilter] = useState<EventListFilter>('all');
  const { data, isLoading, isError } = useDeals({ active: true, limit: 100, sort: 'updatedAt', order: 'desc' });
  const deals = (data?.data ?? []) as Array<Record<string, unknown>>;
  const total = data?.total ?? deals.length;

  const activeDeals = useMemo(
    () => deals.filter(d => !['Lost', 'Delivered'].includes(String(d.status ?? ''))),
    [deals],
  );

  const pipelineDollars = useMemo(
    () => activeDeals.reduce((n, d) => n + (typeof d.amount === 'number' ? d.amount : 0), 0),
    [activeDeals],
  );

  const confirmedCount = useMemo(
    () => activeDeals.filter(d => ['Approved', 'Won', 'In Build'].includes(String(d.status ?? ''))).length,
    [activeDeals],
  );

  const pressureCount = useMemo(() => countDealPressure(activeDeals), [activeDeals]);
  const filterCount = (id: EventListFilter) =>
    activeDeals.filter(d => matchesDealFilter(d, id)).length;

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Spinner /> <span className="text-muted">Loading events…</span>
      </div>
    );
  }

  if (!isError && total > 0) {
    return (
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Events"
            title="Events"
            subtitle="Active bookings from your CRM pipeline."
            stats={[
              {
                label: 'Active pipeline',
                value: formatCurrency(pipelineDollars),
                hint: `${activeDeals.length} events`,
              },
              {
                label: 'Needs attention',
                value: String(pressureCount),
                tone: pressureCount > 0 ? 'warn' : undefined,
              },
              { label: 'Confirmed', value: String(confirmedCount), tone: 'good' },
            ]}
          />
        }
        filters={
          <OpsFilterChips
            chips={[
              { id: 'all', label: 'All events', active: filter === 'all', count: filterCount('all') },
              { id: 'balance', label: 'Balance due', active: filter === 'balance', count: filterCount('balance') },
              { id: 'approaching', label: 'Upcoming', active: filter === 'approaching', count: filterCount('approaching') },
              { id: 'stale', label: 'Stale', active: filter === 'stale', count: filterCount('stale') },
            ]}
            onSelect={id => setFilter(id as EventListFilter)}
          />
        }
      >
        <OpportunityLiveView filter={filter} />
      </CommandPageFrame>
    );
  }

  if (hasImportedVenueRecords()) {
    return <DealsImported />;
  }

  return (
    <div className="card page-section">
      <LiveEmptyState hint={isError ? 'Could not load events from the API.' : undefined} />
    </div>
  );
}