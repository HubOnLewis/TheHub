import { useMemo, useState } from 'react';
import { HUB_LABELS } from '@hub-crm/shared';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../components/operations/intel/OpsFilterChips.js';
import OperationalRowList, { type OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import {
  getExecutiveRailSections,
  getFollowUpIntelligence,
  PV_OVERDUE_FOLLOWUPS,
} from '../data/operationalIntelligence.js';
import { ROUTES } from '../config/paths.js';

export default function FollowUps() {
  const [filter, setFilter] = useState('all');
  const items = useMemo(() => getFollowUpIntelligence(), []);
  const rail = useMemo(
    () => getExecutiveRailSections().filter(s => ['inbox', 'balances', 'proposals'].includes(s.id)),
    [],
  );

  const filtered = items.filter(f => {
    if (filter === 'urgent') return f.urgency === 'high';
    if (filter === 'inbox') return f.what.startsWith('Reply');
    return true;
  });

  const rows: OperationalRow[] = filtered.map(f => ({
    id: f.id,
    stage: f.urgency === 'high' ? 'Urgent' : 'Queue',
    stageTone: f.urgency === 'high' ? 'rose' : 'amber',
    title: f.what,
    subtitle: f.who,
    meta: f.context,
    value: f.due,
    progress: f.urgency === 'high' ? 28 : 60,
    urgency: f.urgency,
    aiHint: `${f.aiTone}${f.relationshipRisk ? ` · Risk: ${f.relationshipRisk}` : ''}`,
    live: f.urgency === 'high',
  }));

  return (
    <>
      <DemoFlowNav />
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Communication urgency"
            title={HUB_LABELS.followUps}
            subtitle="Response pacing, proposal follow-ups, and coordinator action queue."
            stats={[
              { label: 'Queue', value: String(items.length) },
              { label: 'Urgent', value: String(items.filter(i => i.urgency === 'high').length), tone: 'warn' },
              { label: 'PV overdue', value: String(PV_OVERDUE_FOLLOWUPS.length) },
            ]}
          />
        }
        filters={
          <OpsFilterChips
            chips={[
              { id: 'all', label: 'All', active: filter === 'all', count: items.length },
              { id: 'urgent', label: 'Urgent', active: filter === 'urgent', count: items.filter(i => i.urgency === 'high').length },
              { id: 'inbox', label: 'Inbox replies', active: filter === 'inbox', count: items.filter(i => i.what.startsWith('Reply')).length },
            ]}
            onSelect={setFilter}
            aiHint="AI: warm tone for proposal follow-ups; professional for balance reminders."
          />
        }
        railSections={rail}
      >
        <OperationalRowList
          title="Actionable communication queue"
          rows={rows}
          dominant
          linkAll={{ label: 'Inbox →', href: ROUTES.inbox }}
        />
        <div className="ops-insight-void">
          <h3>Response pacing</h3>
          <ul>
            <li>Unread threads surface first — coordinator owns reply within SLA</li>
            <li>WAREIA deposit cadence · recurring chapter risk</li>
            <li>Proposal follow-up sent May 19 · Vaughn Engagement track</li>
          </ul>
        </div>
      </CommandPageFrame>
    </>
  );
}
