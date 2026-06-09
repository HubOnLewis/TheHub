import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import VenueIntelRows, { type VenueIntelRow } from '../components/operations/intel/VenueIntelRows.js';
import { getMyWorkIntelligence } from '../data/operationalIntelligence.js';
import { ROUTES } from '../config/paths.js';
import { useDemoOpsStore, countPendingApprovals } from '../state/demoOpsStore.js';

export default function MyWork() {
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const approvals = useDemoOpsStore(s => s.approvals);
  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const pendingApprovals = countPendingApprovals(approvals);
  const work = useMemo(() => getMyWorkIntelligence(), []);
  const urgent = work.filter(w => w.urgency === 'urgent' || w.urgency === 'high');

  const rows: VenueIntelRow[] = work.map(w => ({
    id: w.id,
    href: w.link,
    urgency: w.urgency === 'urgent' ? 'critical' : w.urgency === 'high' ? 'high' : 'medium',
    cells: [
      { primary: w.kind, secondary: w.dueLabel },
      { primary: w.title, secondary: w.subtitle },
      { primary: w.dueLabel },
      { primary: w.urgency },
    ],
    tags: w.urgency === 'urgent' ? ['Today'] : undefined,
  }));

  return (
    <div className="command-page venue-ops-page">
      <DemoFlowNav />
      <OpsIntelShell
        eyebrow="Personal command center"
        title="My Work"
        subtitle="Assigned opportunities, tasks, follow-ups, and high-pressure events — operational queue for the coordinator."
        stats={[
          { label: 'Queue items', value: String(work.length), hint: 'Tasks + follow-ups + hot events' },
          { label: 'Urgent', value: String(urgent.length), hint: 'Needs action now' },
          { label: 'Approvals', value: String(pendingApprovals), hint: 'Autopilot pending', tone: 'warn' },
        ]}
        actions={
          <>
            <Link to={ROUTES.autopilot} className="btn btn-primary btn-sm">
              Autopilot ({pendingApprovals})
            </Link>
            <Link to={ROUTES.tasks} className="btn btn-secondary btn-sm">
              Tasks →
            </Link>
          </>
        }
      />
      <VenueIntelRows title="Your operational queue" columns={['Type', 'Item', 'Due', 'Priority']} rows={rows} />
    </div>
  );
}
