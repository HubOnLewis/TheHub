import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../components/operations/intel/OpsFilterChips.js';
import OperationalRowList, { type OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import ExecutiveRightRail from '../components/operations/intel/ExecutiveRightRail.js';
import {
  getExecutiveRailSections,
  getLeadIntelligence,
  PV_VENUE_SUMMARY,
} from '../data/operationalIntelligence.js';
import { opportunityDetailPath, ROUTES } from '../config/paths.js';

export default function Leads() {
  const [filter, setFilter] = useState('all');
  const leads = useMemo(() => getLeadIntelligence(), []);
  const rail = useMemo(
    () => getExecutiveRailSections().filter(s => ['proposals', 'inbox', 'occupancy'].includes(s.id)),
    [],
  );

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
    live: l.urgency === 'high',
    tags: l.urgency === 'high' ? ['Needs attention'] : undefined,
  }));

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
              { label: 'Open leads', value: String(PV_VENUE_SUMMARY.lead), hint: 'Inquiry queue' },
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
          linkAll={{ label: 'View inbox →', href: ROUTES.inbox }}
          dominant
        />

        <details className="lead-advanced-intel card">
          <summary className="lead-advanced-intel__summary">Operational intelligence (optional)</summary>
          <div className="lead-advanced-intel__body">
            <div className="command-stagger lead-advanced-intel__stagger">
              <div className="command-stagger__tile">
                <strong>{PV_VENUE_SUMMARY.lead}</strong>
                <span>Active inquiries</span>
              </div>
              <div className="command-stagger__tile">
                <strong>{formatCurrency(PV_VENUE_SUMMARY.proposalSentDollars)}</strong>
                <span>Proposal pipeline</span>
              </div>
              <div className="command-stagger__tile">
                <strong>81%</strong>
                <span>May occupancy</span>
              </div>
            </div>
            <ExecutiveRightRail sections={rail} className="lead-advanced-intel__rail" />
            {filter === 'proposal' ? (
              <div className="ops-insight-void">
                <h3>Conversion notes</h3>
                <ul>
                  <li>Proposal viewed but no deposit — Miller/Harris shower track</li>
                  <li>Vaughn Engagement · Ciara Trass · Jun 2027 hold</li>
                  <li>Warm deposit reminder within 48h of last view</li>
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </CommandPageFrame>
    </>
  );
}
