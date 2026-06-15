import { useMemo, useState } from 'react';
import { formatCurrency } from '@hub-crm/shared';
import OpsIntelShell from '../../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../../components/operations/intel/OpsFilterChips.js';
import OpportunityIntelView, { type EventListFilter } from '../../components/opportunities/OpportunityIntelView.js';
import { getPipelineSummaryStats } from '../../data/operationalIntelligence.js';
import { getOpportunityIntelSections } from '../../data/pvUiIntelligence.js';

export default function DealsDemo() {
  const [filter, setFilter] = useState<EventListFilter>('all');
  const stats = getPipelineSummaryStats();
  const sections = useMemo(() => getOpportunityIntelSections(), []);

  const pressureCount =
    sections.balanceRisk.length +
    sections.eventApproaching.length +
    sections.proposalStale.length;

  return (
    <CommandPageFrame
      hero={
        <OpsIntelShell
          eyebrow="Events"
          title="Events"
          subtitle="Confirmed and in-progress bookings — status, revenue, and readiness at a glance."
          stats={[
            { label: 'Active pipeline', value: formatCurrency(stats.pipelineDollars), hint: `${stats.activePipeline} events` },
            { label: 'Needs attention', value: String(pressureCount), tone: pressureCount > 0 ? 'warn' : undefined },
            { label: 'Confirmed', value: String(stats.confirmed), tone: 'good' },
          ]}
        />
      }
      filters={
        <OpsFilterChips
          chips={[
            { id: 'all', label: 'All events', active: filter === 'all', count: stats.activePipeline },
            { id: 'balance', label: 'Balance due', active: filter === 'balance', count: sections.balanceRisk.length },
            { id: 'approaching', label: 'Upcoming', active: filter === 'approaching', count: sections.eventApproaching.length },
            { id: 'stale', label: 'Stale proposals', active: filter === 'stale', count: sections.proposalStale.length },
          ]}
          onSelect={id => setFilter(id as EventListFilter)}
        />
      }
    >
      <OpportunityIntelView filter={filter} />
    </CommandPageFrame>
  );
}