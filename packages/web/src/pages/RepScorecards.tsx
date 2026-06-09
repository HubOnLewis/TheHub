import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import ExecutiveRightRail from '../components/operations/intel/ExecutiveRightRail.js';
import {
  getExecutiveRailSections,
  getRepScorecardMetrics,
  PV_TASKS,
} from '../data/operationalIntelligence.js';
import { ROUTES } from '../config/paths.js';

export default function RepScorecards() {
  const metrics = useMemo(() => getRepScorecardMetrics(), []);
  const rail = useMemo(
    () => getExecutiveRailSections().filter(s => ['occupancy', 'automation', 'proposals'].includes(s.id)),
    [],
  );
  const coordinators = useMemo(() => {
    const map = new Map<string, { tasks: number; overdue: number }>();
    for (const t of PV_TASKS) {
      const cur = map.get(t.owner.name) ?? { tasks: 0, overdue: 0 };
      cur.tasks += 1;
      if (t.overdue) cur.overdue += 1;
      map.set(t.owner.name, cur);
    }
    return [...map.entries()];
  }, []);

  return (
    <>
      <DemoFlowNav />
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Coordinator operational health"
            title="Rep Scorecards"
            subtitle="Response speed, proposal conversion, balance collection, and task load — PV-backed."
            stats={metrics.slice(0, 4).map(m => ({ label: m.label, value: m.value, hint: m.sub }))}
          />
        }
        rail={<ExecutiveRightRail sections={rail} />}
      >
        <div className="command-stagger" style={{ marginBottom: 14 }}>
          {coordinators.map(([name, stats], i) => (
            <div
              key={name}
              className={`command-stagger__tile${i === 1 ? ' command-stagger__tile--offset' : ''}`}
            >
              <strong>{name}</strong>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {stats.tasks} tasks · {stats.overdue} overdue
              </span>
              <Link to={ROUTES.myWork} style={{ fontSize: 11, fontWeight: 700, marginTop: 6, display: 'inline-block' }}>
                Queue →
              </Link>
            </div>
          ))}
        </div>
        <div className="ops-insight-void">
          <h3>Operational health signals</h3>
          <ul>
            <li>Kisi sequences queued · Dufferfest & Miller/Harris</li>
            <li>Proposal follow-up velocity · Vaughn Engagement track</li>
            <li>WAREIA recurring chapter · deposit cadence watch</li>
          </ul>
        </div>
      </CommandPageFrame>
    </>
  );
}
