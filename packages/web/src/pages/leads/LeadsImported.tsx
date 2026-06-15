import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import CommandPageFrame from '../../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../../components/operations/intel/OpsFilterChips.js';
import OpsIntelShell from '../../components/operations/intel/OpsIntelShell.js';
import OperationalRowList, { type OperationalRow } from '../../components/operations/intel/OperationalRowList.js';
import ImportedSourceNote from '../../components/live/ImportedSourceNote.js';
import { getLeadIntelligence, PV_VENUE_SUMMARY } from '../../data/operationalIntelligence.js';
import { opportunityDetailPath, ROUTES } from '../../config/paths.js';

export default function LeadsImported() {
  const [filter, setFilter] = useState('all');
  const leads = useMemo(() => getLeadIntelligence(), []);

  const filtered = leads.filter(l => {
    if (filter === 'urgent') return l.urgency === 'high';
    if (filter === 'proposal') return l.summary.includes('Proposal');
    if (filter === 'stalled') return l.sla !== 'Met' || l.aiAssessment.includes('deposit');
    return true;
  });

  const rows: OperationalRow[] = filtered.map(l => ({
    id: l.id,
    href: l.linkId ? opportunityDetailPath(l.linkId) : undefined,
    stage: l.source,
    stageTone: l.urgency === 'high' ? 'rose' : 'amber',
    title: l.client,
    subtitle: l.org,
    meta: `${l.summary} · ${l.when}`,
    value: l.value ? formatCurrency(l.value) : 'Inquiry',
    progress: l.urgency === 'high' ? 35 : l.summary.includes('Proposal') ? 55 : 70,
    urgency: l.urgency === 'high' ? 'high' : l.urgency === 'medium' ? 'medium' : 'low',
    aiHint: l.aiAssessment,
    live: false,
    tags: l.urgency === 'high' ? ['Needs attention'] : undefined,
  }));

  return (
    <>
      <ImportedSourceNote style={{ marginBottom: 12 }} />
      <p className="page-crosslink page-crosslink--inline">
        <Link to={ROUTES.prospects}>Target prospects →</Link>
      </p>
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Leads"
            title="Leads"
            subtitle="Imported inquiry queue from Perfect Venue — not live-synced."
            stats={[
              { label: 'Open leads', value: String(PV_VENUE_SUMMARY.lead), hint: 'Imported records' },
              {
                label: 'Proposals out',
                value: String(PV_VENUE_SUMMARY.proposalSent),
                hint: formatCurrency(PV_VENUE_SUMMARY.proposalSentDollars),
              },
              { label: 'Showing', value: String(filtered.length), hint: 'In current filter' },
            ]}
          />
        }
        filters={
          <OpsFilterChips
            chips={[
              { id: 'all', label: 'All', active: filter === 'all', count: leads.length },
              {
                id: 'urgent',
                label: 'Needs attention',
                active: filter === 'urgent',
                count: leads.filter(l => l.urgency === 'high').length,
              },
              {
                id: 'proposal',
                label: 'Proposal active',
                active: filter === 'proposal',
                count: leads.filter(l => l.summary.includes('Proposal')).length,
              },
              {
                id: 'stalled',
                label: 'Stalled',
                active: filter === 'stalled',
                count: leads.filter(l => l.sla !== 'Met').length,
              },
            ]}
            onSelect={setFilter}
          />
        }
      >
        <OperationalRowList
          title="Lead queue"
          rows={rows}
          linkAll={{ label: 'View events →', href: ROUTES.opportunities }}
          dominant
        />
      </CommandPageFrame>
    </>
  );
}