import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, HUB_LABELS } from '@hub-crm/shared';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import ExecutiveRightRail from '../components/operations/intel/ExecutiveRightRail.js';
import OperationalRowList, { type OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import {
  getExecutiveRailSections,
  getOpportunityIntelligence,
  getOwnerBriefingMemo,
  PV_VENUE_SUMMARY,
  pvStatusDisplay,
} from '../data/operationalIntelligence.js';
import { ROUTES } from '../config/paths.js';

export default function ForecastReview() {
  const memo = getOwnerBriefingMemo();
  const rail = useMemo(() => getExecutiveRailSections(), []);
  const opportunities = useMemo(() => getOpportunityIntelligence(), []);

  const atRisk: OperationalRow[] = opportunities
    .filter(o => o.intel.urgency === 'high' || o.intel.urgency === 'critical')
    .slice(0, 8)
    .map(({ event, intel, link }) => ({
      id: event.id,
      href: link,
      stage: pvStatusDisplay(event.pvStatus),
      stageTone: 'rose' as const,
      title: event.title,
      subtitle: event.client,
      meta: intel.flags.join(' · '),
      value: formatCurrency(event.value),
      progress: intel.closeScore,
      urgency: intel.urgency,
      aiHint: intel.aiLine,
      live: true,
    }));

  const commitRows: OperationalRow[] = opportunities
    .filter(o => o.event.pvStatus === 'confirmed' || o.event.pvStatus === 'balance_due')
    .slice(0, 6)
    .map(({ event, intel, link }) => ({
      id: `c-${event.id}`,
      href: link,
      stage: 'Commit',
      stageTone: 'green' as const,
      title: event.title,
      subtitle: event.client,
      value: formatCurrency(event.value),
      progress: intel.closeScore,
      aiHint: intel.aiLine,
    }));

  return (
    <>
      <DemoFlowNav />
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Executive intelligence center"
            title={HUB_LABELS.insights}
            subtitle="Forecast confidence, revenue at risk, and operational narrative — not three lonely cards."
            stats={[
              { label: 'Pipeline', value: formatCurrency(PV_VENUE_SUMMARY.activePipelineDollars) },
              { label: 'May occupancy', value: '81%', hint: 'PV calendar', tone: 'good' },
              { label: 'At risk', value: String(atRisk.length), tone: 'warn' },
            ]}
          />
        }
        rail={<ExecutiveRightRail sections={rail} />}
      >
        <div className="insights-command-grid">
          <article className="insights-narrative">
            <h2>Operating narrative</h2>
            <p style={{ margin: '0 0 12px', lineHeight: 1.55, opacity: 0.92 }}>{memo.focus}</p>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
              Top decisions
            </h3>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {memo.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ol>
            <Link to={ROUTES.ownerBriefing} className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
              Owner briefing →
            </Link>
          </article>
          <div>
            <OperationalRowList title="Revenue at risk" rows={atRisk} />
          </div>
        </div>
        <OperationalRowList title="Commit & confirmed path" rows={commitRows} linkAll={{ label: 'Pipeline →', href: ROUTES.pipeline }} />
        <div className="ops-insight-void">
          <h3>Automation & expansion signals</h3>
          <ul>
            {memo.overnight.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      </CommandPageFrame>
    </>
  );
}
