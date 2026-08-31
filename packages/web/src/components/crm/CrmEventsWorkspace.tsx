import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/index.js';
import { useDeals, useDealMutations } from '../../hooks/useDeals.js';
import MetricCard from './MetricCard.js';
import EventsTable from './EventsTable.js';
import FilterDrawer from './FilterDrawer.js';
import EmptyState from './EmptyState.js';
import LoadingState from './LoadingState.js';
import CrmEventSourceBanner from './CrmEventSourceBanner.js';
import CrmEventSourceDiagnostics from './CrmEventSourceDiagnostics.js';
import AddEventModal from './AddEventModal.js';
import AttentionRail from '../venue/AttentionRail.js';
import {
  filterCrmRows,
  mapApiDealsToWorkspaceRows,
  type CrmMetricCategory,
} from '../../lib/crmEvents.js';
import { useDashboardStats } from '../../hooks/useDashboard.js';
import {
  logCrmEventSourceDiagnostics,
  resolveCrmEventSource,
} from '../../lib/crmEventSource.js';
import { matchesDealFilter } from '../../lib/liveDataMappers.js';
import type { EventListFilter } from '../opportunities/opportunityLiveTypes.js';
import { hasImportedVenueRecords } from '../../lib/operationalSource.js';
import { ROUTES } from '../../config/paths.js';
import { useVenueAttention } from '../../hooks/useAgentSnapshot.js';
import { formatCurrency } from '@hub-crm/shared';

type Props = {
  title?: string;
};

export default function CrmEventsWorkspace({ title = 'Active Events' }: Props) {
  const user = useAppStore(s => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<CrmMetricCategory | 'all'>('active');
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState<EventListFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(() => searchParams.get('new') === '1');

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAddOpen(true);
    }
  }, [searchParams]);

  const closeAdd = () => {
    setAddOpen(false);
    if (searchParams.get('new') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  const { data: dealsPage, isLoading, isError } = useDeals({
    limit: 500,
    sort: 'updatedAt',
    order: 'desc',
  });
  const { remove: deleteDeal } = useDealMutations();

  const apiRows = useMemo(() => {
    const deals = (dealsPage?.data ?? []) as Array<Record<string, unknown>>;
    return mapApiDealsToWorkspaceRows(deals);
  }, [dealsPage]);

  const apiLoaded = !isLoading && !isError;
  const apiEmpty = apiLoaded && apiRows.length === 0;
  const useApi = apiLoaded && apiRows.length > 0;

  const manifest = useMemo(
    () => resolveCrmEventSource({ apiRows, useApi, apiError: isError, apiEmpty }),
    [apiRows, useApi, isError, apiEmpty],
  );

  const { data: dashStats } = useDashboardStats();

  useEffect(() => {
    logCrmEventSourceDiagnostics(manifest);
  }, [manifest]);

  const filteredRows = useMemo(() => {
    let rows = filterCrmRows(manifest.rows, statusFilter, {
      mineOnly,
      userId: user?.email ?? user?.name,
      search,
    });
    if (useApi && advancedFilter !== 'all') {
      const dealMap = new Map(
        ((dealsPage?.data ?? []) as Array<Record<string, unknown>>).map(d => [
          String(d._id),
          d,
        ]),
      );
      rows = rows.filter(r => {
        const deal = dealMap.get(r.id);
        return deal ? matchesDealFilter(deal, advancedFilter) : true;
      });
    }
    return rows;
  }, [manifest.rows, statusFilter, mineOnly, user, search, useApi, advancedFilter, dealsPage]);

  const { items: attention, source: attentionSource } = useVenueAttention(manifest.rows);

  const nextActionStats = useMemo(() => {
    const balance = manifest.rows.reduce((s, r) => s + (r.balanceDue ?? 0), 0);
    const thisWeek = attention.filter(a => a.priority === 'critical' || a.priority === 'high').length;
    return {
      attention: attention.length,
      balance,
      highPriority: thisWeek,
    };
  }, [manifest.rows, attention]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    if (!useApi) return;
    if (window.confirm('Archive this event?')) {
      deleteDeal.mutate(id);
    }
  };

  if (isLoading && !hasImportedVenueRecords()) {
    return <LoadingState />;
  }

  return (
    <div className="crm-events-workspace">
      <div className="crm-events-intro">
        <header className="crm-page-header">
          <h1 className="crm-page-header__title">{title}</h1>
          <p className="crm-page-header__subtitle">
            What needs worked · what is booked · what is at risk — your venue command home.
          </p>
        </header>

        <CrmEventSourceBanner manifest={manifest} apiError={isError} />
      </div>
      <CrmEventSourceDiagnostics manifest={manifest} />

      <div className="crm-home-next-strip" role="status">
        <div className="crm-home-next-pill">
          <span>Needs attention</span>
          <strong>{nextActionStats.attention}</strong>
        </div>
        <div className={`crm-home-next-pill${nextActionStats.balance > 0 ? ' crm-home-next-pill--warn' : ''}`}>
          <span>Balances due</span>
          <strong>{formatCurrency(nextActionStats.balance)}</strong>
        </div>
        <div className={`crm-home-next-pill${nextActionStats.highPriority > 0 ? ' crm-home-next-pill--urgent' : ''}`}>
          <span>High priority</span>
          <strong>{nextActionStats.highPriority}</strong>
        </div>
        <Link to={ROUTES.calendar} className="crm-home-next-link">
          Open calendar →
        </Link>
        <Link to={ROUTES.tasks} className="crm-home-next-link">
          Open tasks →
        </Link>
        <Link to={ROUTES.ownerBriefing} className="crm-home-next-link">
          Owner briefing →
        </Link>
      </div>

      {attention[0] ? (
        <div className="crm-start-here">
          <div>
            <span className="crm-start-here__kicker">Start here</span>
            <strong>{attention[0].title}</strong>
            <p>{attention[0].detail}</p>
          </div>
          <Link to={attention[0].href} className="btn btn-primary">
            {attention[0].actionLabel}
          </Link>
        </div>
      ) : null}

      <AttentionRail items={attention} title="Do this next" max={5} />
      <p className="text-muted text-sm" style={{ margin: '-8px 0 16px' }}>
        {attentionSource === 'api-agents'
          ? 'Live agent snapshot from CRM events and leads — not Perfect Venue seed.'
          : 'Live rules on current CRM rows. Open Briefing to refresh the stored agent run.'}
      </p>

      {manifest.sourceId === 'live-api' && dashStats ? (
        <WorkspaceKpiStrip stats={dashStats} />
      ) : null}

      <div className="crm-metric-strip" role="tablist" aria-label="Event summary">
        <MetricCard
          card={manifest.metrics.find(m => m.id === 'active') ?? manifest.metrics[0]}
          selected={statusFilter === 'active'}
          onSelect={() => setStatusFilter('active')}
        />
        {manifest.metrics
          .filter(m => m.id !== 'active')
          .map(card => (
            <MetricCard
              key={card.id}
              card={card}
              selected={statusFilter === card.id}
              onSelect={() => setStatusFilter(card.id)}
            />
          ))}
      </div>

      <section className="crm-events-panel">
        <header className="crm-events-toolbar">
          <div className="crm-events-toolbar__left">
            <p className="crm-events-toolbar__meta">
              {filteredRows.length} event{filteredRows.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="crm-events-toolbar__right">
            <input
              type="search"
              className="crm-events-toolbar__search"
              placeholder="Search events…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search events"
            />
            <button
              type="button"
              className={`btn btn-ghost btn-sm${mineOnly ? ' active' : ''}`}
              onClick={() => setMineOnly(v => !v)}
            >
              My Events
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFilterOpen(true)}
            >
              Filters
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm crm-events-add-btn"
              onClick={() => setAddOpen(true)}
            >
              + Add Event
            </button>
          </div>
        </header>

        {selectedIds.size > 0 ? (
          <div className="crm-bulk-bar">
            <span>{selectedIds.size} selected</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </div>
        ) : null}

        {filteredRows.length === 0 ? (
          <EmptyState
            title={manifest.rowCount === 0 ? 'No events loaded yet' : 'No events match this filter'}
            hint={
              manifest.rowCount === 0
                ? 'Add a new event or capture a lead to begin.'
                : isError
                  ? 'Could not load events from the API.'
                  : 'Try another status card or clear filters.'
            }
            actionLabel="Add Event"
            onAction={() => setAddOpen(true)}
            secondaryActionLabel={manifest.rowCount === 0 ? 'Import Events' : undefined}
            secondaryActionTo={manifest.rowCount === 0 ? `${ROUTES.settings}/data-import` : undefined}
          />
        ) : (
          <EventsTable
            rows={filteredRows}
            onDelete={useApi ? handleDelete : undefined}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            showBulkSelect={selectedIds.size > 0}
          />
        )}
      </section>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        search={search}
        onSearchChange={setSearch}
        advancedFilter={advancedFilter}
        onAdvancedFilterChange={setAdvancedFilter}
      />

      <AddEventModal open={addOpen} onClose={closeAdd} />
    </div>
  );
}

function WorkspaceKpiStrip({
  stats,
}: {
  stats: NonNullable<ReturnType<typeof useDashboardStats>['data']>;
}) {
  const openLeads = (stats.leadsByStatus ?? [])
    .filter(s => !['Converted', 'Lost'].includes(s._id))
    .reduce((n, s) => n + s.count, 0);
  const pipelineDeals = (stats.dealsByStatus ?? [])
    .filter(s => !['Lost', 'Delivered'].includes(s._id))
    .reduce((n, s) => n + s.count, 0);

  if (openLeads === 0 && pipelineDeals === 0) return null;

  return (
    <div className="crm-kpi-strip crm-pipeline-summary command-stat-strip" role="status">
      {openLeads > 0 ? (
        <div className="tasks-stat-pill">
          <span className="tasks-stat-pill__label">Open leads</span>
          <strong>{openLeads}</strong>
        </div>
      ) : null}
      {pipelineDeals > 0 ? (
        <div className="tasks-stat-pill">
          <span className="tasks-stat-pill__label">Pipeline events</span>
          <strong>{pipelineDeals}</strong>
        </div>
      ) : null}
      {(stats.followUpOverdueOpen ?? 0) > 0 ? (
        <div className="tasks-stat-pill tasks-stat-pill--urgent">
          <span className="tasks-stat-pill__label">Overdue follow-ups</span>
          <strong>{stats.followUpOverdueOpen}</strong>
        </div>
      ) : null}
    </div>
  );
}
