import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CommandPageFrame from '../../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../../components/operations/intel/OpsFilterChips.js';
import OpsIntelShell from '../../components/operations/intel/OpsIntelShell.js';
import OperationalRowList from '../../components/operations/intel/OperationalRowList.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
import { Spinner } from '../../components/ui/index.js';
import { ROUTES } from '../../config/paths.js';
import { useLeads } from '../../hooks/useLeads.js';
import { hasImportedVenueRecords } from '../../lib/operationalSource.js';
import {
  countLiveLeadFilter,
  mapLeadToOperationalRow,
  matchesLeadFilter,
} from '../../lib/liveDataMappers.js';
import LeadsImported from './LeadsImported.js';

export default function LeadsLive() {
  const [filter, setFilter] = useState('all');
  const { data, isLoading, isError } = useLeads({ active: true, limit: 100, sort: 'updatedAt', order: 'desc' });
  const leads = (data?.data ?? []) as Array<Record<string, unknown>>;
  const total = data?.total ?? leads.length;

  const filtered = useMemo(
    () => leads.filter(l => matchesLeadFilter(l, filter)),
    [leads, filter],
  );
  const rows = useMemo(() => filtered.map(mapLeadToOperationalRow), [filtered]);

  const openCount = leads.filter(l => !['Converted', 'Lost'].includes(String(l.status ?? ''))).length;
  const quotedCount = countLiveLeadFilter(leads, 'proposal');

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Spinner /> <span className="text-muted">Loading leads…</span>
      </div>
    );
  }

  if (!isError && total > 0) {
    return (
      <>
        <p className="page-crosslink page-crosslink--inline">
          <Link to={ROUTES.prospects}>Target prospects →</Link>
        </p>
        <CommandPageFrame
          hero={
            <OpsIntelShell
              eyebrow="Leads"
              title="Leads"
              subtitle="Open inquiries and early pipeline — work the queue first."
              stats={[
                { label: 'Open leads', value: String(openCount), hint: 'From CRM' },
                { label: 'Quoted', value: String(quotedCount), hint: 'Proposal stage' },
                { label: 'Showing', value: String(filtered.length), hint: 'In current filter' },
              ]}
            />
          }
          filters={
            <OpsFilterChips
              chips={[
                { id: 'all', label: 'All', active: filter === 'all', count: openCount },
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
      </>
    );
  }

  if (hasImportedVenueRecords()) {
    return <LeadsImported />;
  }

  return (
    <div className="card page-section">
      <LiveEmptyState hint={isError ? 'Could not load leads from the API.' : undefined} />
    </div>
  );
}