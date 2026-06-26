import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/index.js';
import { useDeals, useDealMutations } from '../../hooks/useDeals.js';
import MetricCard from './MetricCard.js';
import EventsTable from './EventsTable.js';
import FilterDrawer from './FilterDrawer.js';
import EmptyState from './EmptyState.js';
import LoadingState from './LoadingState.js';
import CrmEventSourceBanner from './CrmEventSourceBanner.js';
import CrmEventSourceDiagnostics from './CrmEventSourceDiagnostics.js';
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

type Props = {
  title?: string;
};

export default function CrmEventsWorkspace({ title = 'Active Events' }: Props) {
  const user = useAppStore(s => s.user);
  const [statusFilter, setStatusFilter] = useState<CrmMetricCategory | 'all'>('active');
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState<EventListFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
            Live booking pipeline, balances, follow-ups, and upcoming event readiness.
          </p>
        </header>

        <CrmEventSourceBanner manifest={manifest} apiError={isError} />
      </div>
      <CrmEventSourceDiagnostics manifest={manifest} />

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
            <Link to={`${ROUTES.opportunities}?new=1`} className="btn btn-primary btn-sm crm-events-add-btn">
              + Add Event
            </Link>
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
                ? 'Import Perfect Venue events or add a new event to begin.'
                : isError
                  ? 'Could not load events from the API.'
                  : 'Try another status card or clear filters.'
            }
            actionLabel="Add Event"
            actionTo={`${ROUTES.opportunities}?new=1`}
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
