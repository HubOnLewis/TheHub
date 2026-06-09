import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import SystemPulseCard from '../components/operations/SystemPulseCard.js';
import ActivityTimeline from '../components/operations/ActivityTimeline.js';
import AgentWatchBadge from '../components/agents/AgentWatchBadge.js';
import EmbeddedAgentPanel from '../components/agents/EmbeddedAgentPanel.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import ContextAgentDock from '../components/agents/ContextAgentDock.js';
import {
  OWNER_BALANCES_ATTENTION,
  OWNER_BRIEFING_META,
  OWNER_STAFFING_PRESSURE,
  OWNER_TODAY_EVENTS,
} from '../data/executiveDemo.js';
import { DASHBOARD_AGENT_WATCH } from '../data/embeddedAgentInsights.js';
import { DEMO_OVERDUE_FOLLOWUPS } from '../data/demoVenue.js';
import { countPendingApprovals, useDemoOpsStore } from '../state/demoOpsStore.js';

const LOAD_INS = [
  { id: 'li1', event: 'ICT Investor Lunch', window: '10:30a setup · 11:30a doors', space: 'Event Space', stress: 'elevated' as const },
  { id: 'li2', event: 'Bingo fundraiser', window: '2:30p flip · 4:00p start', space: 'Event Space', stress: 'high' as const },
];

const RISKS = [
  { id: 'r1', label: 'Miller/Harris balance · Jun 7', severity: 'high', detail: 'Final balance due · reminder drafted' },
  { id: 'r2', label: 'Jun 6–7 turnover', severity: 'medium', detail: 'Dufferfest load-in then shower flip' },
  { id: 'r3', label: '3 Autopilot approvals', severity: 'medium', detail: 'Kisi batch · client drafts' },
];

export default function TodayOperations() {
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const tasks = useDemoOpsStore(s => s.tasks);
  const approvals = useDemoOpsStore(s => s.approvals);
  const completeTask = useDemoOpsStore(s => s.completeTask);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const openTasks = useMemo(() => tasks.filter(t => t.status === 'open').slice(0, 8), [tasks]);
  const pendingApprovals = useMemo(
    () => Object.values(approvals).filter(a => a.status === 'pending'),
    [approvals],
  );
  const pendingCount = countPendingApprovals(approvals);

  return (
    <div className="today-ops command-page">
      <DemoFlowNav />
      <header className="today-ops__hero">
        <div>
          <span className="today-ops__badge">Mission control</span>
          <h1 className="page-title">Today</h1>
          <p className="page-subtitle">
            {OWNER_BRIEFING_META.venue} · {OWNER_BRIEFING_META.periodLabel} — what needs attention right now.
          </p>
        </div>
        <div className="today-ops__hero-actions">
          <Link to={ROUTES.ownerBriefing} className="btn btn-secondary btn-sm">
            Owner briefing →
          </Link>
          <Link to={ROUTES.autopilot} className="btn btn-primary btn-sm">
            Autopilot queue ({pendingCount})
          </Link>
        </div>
      </header>

      <ContextAgentDock context="dashboard" compact />

      <div className="today-ops__watch">
        <AgentWatchBadge
          activeCount={DASHBOARD_AGENT_WATCH.activeCount}
          headline={DASHBOARD_AGENT_WATCH.headline}
          sub={DASHBOARD_AGENT_WATCH.sub}
        />
      </div>

      <div className="today-ops__grid">
        <section className="today-block today-block--events">
          <h2>Today&apos;s events</h2>
          <ul className="today-list">
            {OWNER_TODAY_EVENTS.map(e => (
              <li key={e.id} className="today-list__row">
                <span className="today-list__time">{e.time}</span>
                <div>
                  <strong>{e.title}</strong>
                  <span>
                    {e.space} · {e.guests} guests · {e.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.calendar} className="today-block__link">
            Calendar intelligence →
          </Link>
        </section>

        <section className="today-block today-block--tasks">
          <h2>Today&apos;s tasks</h2>
          <ul className="today-list">
            {openTasks.map(t => (
              <li key={t.id} className={`today-list__row${t.overdue ? ' today-list__row--urgent' : ''}`}>
                <span className="today-list__prio">{t.priority}</span>
                <div>
                  <strong>{t.title}</strong>
                  <span>
                    {t.owner.name} · {t.linkedEvent}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => completeTask(t.id)}>
                  Done
                </button>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.tasks} className="today-block__link">
            Task center →
          </Link>
        </section>

        <section className="today-block today-block--risks">
          <h2>Today&apos;s risks</h2>
          <ul className="today-risk-list">
            {RISKS.map(r => (
              <li key={r.id} className={`today-risk today-risk--${r.severity}`}>
                <strong>{r.label}</strong>
                <span>{r.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="today-block today-block--approvals">
          <h2>Today&apos;s approvals</h2>
          {pendingApprovals.length === 0 ? (
            <p className="today-empty">Queue clear — agents standing by.</p>
          ) : (
            <ul className="today-list">
              {pendingApprovals.map(a => (
                <li key={a.id} className="today-list__row">
                  <div>
                    <strong>{a.title}</strong>
                    <span>
                      {a.agent} · {a.waitingOn}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to={ROUTES.autopilot} className="today-block__link">
            Review in Autopilot →
          </Link>
        </section>

        <section className="today-block today-block--loadins">
          <h2>Today&apos;s load-ins</h2>
          <ul className="today-loadin-list">
            {LOAD_INS.map(l => (
              <li key={l.id} className={`today-loadin today-loadin--${l.stress}`}>
                <strong>{l.event}</strong>
                <span>{l.window}</span>
                <span className="today-loadin__space">{l.space}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="today-block today-block--balances">
          <h2>Today&apos;s balances due</h2>
          <ul className="today-list">
            {OWNER_BALANCES_ATTENTION.slice(0, 4).map(b => (
              <li key={b.id} className={`today-list__row today-list__row--${b.severity}`}>
                <div>
                  <strong>{b.client}</strong>
                  <span>
                    {b.event} · due {b.due}
                  </span>
                </div>
                <span className="today-list__amt">{formatCurrency(b.amount)}</span>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.revenueLeaks} className="today-block__link">
            Revenue leaks →
          </Link>
        </section>

        <section className="today-block today-block--followups">
          <h2>Today&apos;s follow-ups</h2>
          <ul className="today-list">
            {DEMO_OVERDUE_FOLLOWUPS.slice(0, 5).map(f => (
              <li key={f.id} className="today-list__row today-list__row--urgent">
                <div>
                  <strong>{f.what}</strong>
                  <span>
                    {f.who} · {f.due}
                  </span>
                </div>
                <span className="today-list__amt">{f.amt}</span>
              </li>
            ))}
          </ul>
          <Link to={opportunityDetailPath('pv-miller-harris')} className="today-block__link">
            Miller/Harris workspace →
          </Link>
        </section>

        <SystemPulseCard className="today-block today-block--pulse" />
        <ActivityTimeline limit={6} dense title="Movement log" className="today-block today-block--timeline" />
        <EmbeddedAgentPanel
          title="Agents on today"
          insights={[
            {
              agentId: 'owner-briefing',
              agentName: 'Owner Briefing Agent',
              message: '3 operational risks flagged for coordinator review',
              tone: 'warn',
            },
            {
              agentId: 'calendar-conflict',
              agentName: 'Calendar Conflict',
              message: 'Event Space double-book risk cleared for May 20',
              tone: 'info',
            },
          ]}
          className="today-block today-block--agents"
        />
      </div>

      <footer className="today-ops__staffing">
        <span>
          Staffing · {OWNER_STAFFING_PRESSURE.openTasks} open · {OWNER_STAFFING_PRESSURE.urgentToday} urgent today
        </span>
        <Link to={ROUTES.dashboard}>Dashboard →</Link>
      </footer>
    </div>
  );
}
