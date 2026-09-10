import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CommandPageFrame from '../../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../../components/operations/intel/OpsFilterChips.js';
import OpsIntelShell from '../../components/operations/intel/OpsIntelShell.js';
import OperationalRowList from '../../components/operations/intel/OperationalRowList.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
import AddLeadModal from '../../components/leads/AddLeadModal.js';
import { Spinner } from '../../components/ui/index.js';
import { ROUTES } from '../../config/paths.js';
import { useLeads } from '../../hooks/useLeads.js';
import { hasImportedVenueRecords } from '../../lib/operationalSource.js';
import {
  countLiveLeadFilter,
  mapLeadToOperationalRow,
  matchesLeadFilter,
} from '../../lib/liveDataMappers.js';
import {
  resolveLeadsQueueAuthority,
  type LeadsQueueView,
} from '../../lib/leadsQueueAuthority.js';
import LeadsImported from './LeadsImported.js';

export default function LeadsLive() {
  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [queueView, setQueueView] = useState<LeadsQueueView>('live');
  // Do not use active=true — that hides Converted leads created by /book and triggers PV fallback.
  const { data, isLoading, isError } = useLeads({ limit: 100, sort: 'updatedAt', order: 'desc' });
  const leads = (data?.data ?? []) as Array<Record<string, unknown>>;
  const total = data?.total ?? leads.length;
  const hasImported = hasImportedVenueRecords();

  const authority = resolveLeadsQueueAuthority({
    isLoading,
    isError,
    liveTotal: total,
    hasImportedRecords: hasImported,
    selectedView: queueView,
  });

  const filtered = useMemo(
    () => leads.filter(l => matchesLeadFilter(l, filter)),
    [leads, filter],
  );
  const rows = useMemo(() => filtered.map(mapLeadToOperationalRow), [filtered]);

  const openCount = countLiveLeadFilter(leads, 'open');
  const quotedCount = countLiveLeadFilter(leads, 'proposal');
  const convertedCount = countLiveLeadFilter(leads, 'converted');

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Spinner /> <span className="text-muted">Loading leads…</span>
      </div>
    );
  }

  const sourceSwitcher =
    authority.allowImportedReference ? (
      <div className="page-crosslink page-crosslink--inline" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${authority.view === 'live' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setQueueView('live')}
        >
          Live CRM
        </button>
        <button
          type="button"
          className={`btn ${authority.view === 'imported' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setQueueView('imported')}
        >
          Perfect Venue import
        </button>
        <Link to={ROUTES.prospects}>Target prospects →</Link>
      </div>
    ) : (
      <p className="page-crosslink page-crosslink--inline">
        <Link to={ROUTES.prospects}>Target prospects →</Link>
      </p>
    );

  if (authority.view === 'imported') {
    return (
      <>
        {sourceSwitcher}
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Source: <strong>PERFECT VENUE IMPORT</strong> — historical reference only. Live CRM remains the operator queue.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + New lead
          </button>
        </div>
        <LeadsImported />
        <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  return (
    <>
      {sourceSwitcher}
      <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
        Source: <strong>{authority.sourceLabel}</strong>
        {authority.liveApiOk ? ' — Mongo CRM working queue.' : ' — live API unavailable.'}
      </p>
      {authority.liveApiOk && total > 0 ? (
        <CommandPageFrame
          hero={
            <OpsIntelShell
              eyebrow="Leads"
              title="Leads"
              subtitle="Live CRM inquiries and pipeline — Perfect Venue history is under Perfect Venue import."
              stats={[
                { label: 'Open leads', value: String(openCount), hint: 'Live CRM' },
                { label: 'Converted', value: String(convertedCount), hint: 'Linked to events' },
                { label: 'Showing', value: String(filtered.length), hint: 'In current filter' },
              ]}
              actions={
                <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                  + New lead
                </button>
              }
            />
          }
          filters={
            <OpsFilterChips
              chips={[
                { id: 'all', label: 'All', active: filter === 'all', count: total },
                { id: 'open', label: 'Open', active: filter === 'open', count: openCount },
                {
                  id: 'urgent',
                  label: 'Needs attention',
                  active: filter === 'urgent',
                  count: countLiveLeadFilter(leads, 'urgent'),
                },
                {
                  id: 'proposal',
                  label: 'Quoted',
                  active: filter === 'proposal',
                  count: quotedCount,
                },
                {
                  id: 'converted',
                  label: 'Converted',
                  active: filter === 'converted',
                  count: convertedCount,
                },
                {
                  id: 'stalled',
                  label: 'Stalled',
                  active: filter === 'stalled',
                  count: countLiveLeadFilter(leads, 'stalled'),
                },
              ]}
              onSelect={setFilter}
            />
          }
        >
          <OperationalRowList
            title="Lead queue"
            rows={rows}
            linkAll={{ label: 'View all leads →', href: ROUTES.leads }}
            dominant
          />
        </CommandPageFrame>
      ) : (
        <div className="card page-section" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
          <LiveEmptyState hint={authority.liveHint ?? 'No open leads yet — capture your first inquiry.'} />
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + New lead
          </button>
          {authority.allowImportedReference ? (
            <button type="button" className="btn btn-ghost" onClick={() => setQueueView('imported')}>
              View Perfect Venue import history
            </button>
          ) : null}
        </div>
      )}
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
