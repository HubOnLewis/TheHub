import { useMemo, useState } from 'react';
import { formatCurrency, HUB_LABELS } from '@hub-crm/shared';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../components/operations/intel/OpsFilterChips.js';
import AccountIntelView, { type AccountFilterId } from '../components/accounts/AccountIntelView.js';
import { getExecutiveRailSections, PV_VENUE_SUMMARY } from '../data/operationalIntelligence.js';
import { getAccountIntelSections } from '../data/pvUiIntelligence.js';
import { ROUTES } from '../config/paths.js';

export default function Companies() {
  const [filter, setFilter] = useState<AccountFilterId>('all');
  const sections = useMemo(() => getAccountIntelSections(), []);
  const rail = useMemo(
    () => getExecutiveRailSections().filter(s => ['vip', 'balances', 'proposals'].includes(s.id)),
    [],
  );

  const counts = {
    all: sections.all.length,
    vip: sections.vipRepeat.length,
    upcoming: sections.upcoming.length,
    balance: sections.balanceRisk.length,
    dormant: sections.dormantValuable.length,
    recent: sections.recent.length,
  };

  return (
    <>
      <DemoFlowNav />
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Relationship intelligence"
            title={HUB_LABELS.accounts}
            subtitle="234 real accounts from Perfect Venue — VIP repeats, balances, and expansion windows."
            stats={[
              { label: 'Relationships', value: String(counts.all), hint: 'PV accounts' },
              { label: 'VIP / repeat', value: String(counts.vip), hint: '3+ events or series' },
              {
                label: 'Balances',
                value: formatCurrency(
                  sections.balanceRisk.reduce((s, a) => s + a.balanceOutstanding, 0),
                ),
                tone: 'warn',
              },
            ]}
          />
        }
        filters={
          <OpsFilterChips
            chips={[
              { id: 'all', label: 'All', active: filter === 'all', count: counts.all },
              { id: 'vip', label: 'VIP / repeat', active: filter === 'vip', count: counts.vip },
              {
                id: 'upcoming',
                label: 'Upcoming',
                active: filter === 'upcoming',
                count: counts.upcoming,
              },
              {
                id: 'balance',
                label: 'Balance risk',
                active: filter === 'balance',
                count: counts.balance,
              },
              {
                id: 'dormant',
                label: 'Dormant · valuable',
                active: filter === 'dormant',
                count: counts.dormant,
              },
              {
                id: 'recent',
                label: 'Recent',
                active: filter === 'recent',
                count: counts.recent,
              },
            ]}
            onSelect={id => setFilter(id as AccountFilterId)}
            aiHint="Elevate Mentoring and similar repeat accounts surface in VIP — not flat spreadsheet rows."
          />
        }
        railSections={rail}
      >
        <AccountIntelView filter={filter} />
        <div className="ops-insight-void">
          <h3>Relationship momentum</h3>
          <ul>
            <li>{PV_VENUE_SUMMARY.activeEvents} active events in pipeline</li>
            <li>{counts.vip} VIP / repeat accounts from export</li>
            <li>{counts.upcoming} accounts with upcoming bookings</li>
          </ul>
          <a href={ROUTES.pipeline} className="exec-panel__link">
            Pipeline map →
          </a>
        </div>
      </CommandPageFrame>
    </>
  );
}
