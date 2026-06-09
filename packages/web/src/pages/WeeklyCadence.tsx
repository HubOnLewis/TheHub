import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import ExecutiveRightRail from '../components/operations/intel/ExecutiveRightRail.js';
import {
  getExecutiveRailSections,
  getWeeklyCadenceBrief,
  PV_AI_ATTENTION,
  PV_EXECUTIVE_ANCHORS,
  PV_VENUE_SUMMARY,
} from '../data/operationalIntelligence.js';
import { ROUTES } from '../config/paths.js';

export default function WeeklyCadence() {
  const brief = getWeeklyCadenceBrief();
  const rail = getExecutiveRailSections().filter(s =>
    ['occupancy', 'balances', 'collisions', 'automation'].includes(s.id),
  );

  return (
    <>
      <DemoFlowNav />
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Executive narrative workspace"
            title="Weekly Cadence"
            subtitle="Occupancy pacing, unresolved balances, coordinator workload, and AI weekly summary."
            stats={[
              { label: 'Occupancy', value: brief.occupancy, tone: 'good' },
              { label: 'Stale proposals', value: String(brief.proposals), tone: 'warn' },
              { label: 'Open tasks', value: String(brief.tasksOpen) },
              { label: 'Pipeline', value: formatCurrency(PV_VENUE_SUMMARY.activePipelineDollars) },
            ]}
          />
        }
        rail={<ExecutiveRightRail sections={rail} />}
      >
        <article className="insights-narrative" style={{ marginBottom: 14 }}>
          <h2>Weekly operating narrative</h2>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{brief.headline}</p>
        </article>
        <div className="insights-command-grid">
          <div className="briefing-memo__block">
            <h2>Risks this week</h2>
            <ul>
              {brief.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="briefing-memo__block">
            <h2>Stale proposals</h2>
            <ul>
              {PV_EXECUTIVE_ANCHORS.staleProposals.map(s => (
                <li key={s.title}>
                  {s.title} · {s.days}d · {formatCurrency(s.value)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="briefing-memo__block">
          <h2>Agent attention</h2>
          <ul>
            {PV_AI_ATTENTION.map(a => (
              <li key={a.id}>{a.text}</li>
            ))}
          </ul>
          <Link to={ROUTES.autopilot} style={{ fontSize: 12, marginTop: 10, display: 'inline-block' }}>
            Autopilot →
          </Link>
        </div>
      </CommandPageFrame>
    </>
  );
}
