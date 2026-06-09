import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import ActivityTimeline from '../components/operations/ActivityTimeline.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import { getAgentEngineSnapshot, getAgentSignalsFor } from '../agents/mockAgentEngine.js';
import {
  AUTOPILOT_IMPACT_METRICS,
  AUTOPILOT_RECOMMENDATIONS,
  AUTOPILOT_SIGNAL_FEED,
  type AgentRunStatus,
} from '../data/autopilotDemo.js';
import { useDemoOpsStore, type DemoApprovalRecord } from '../state/demoOpsStore.js';
import { useAuditStore } from '../audit/auditStore.js';

function statusLabel(s: AgentRunStatus): string {
  switch (s) {
    case 'active':
      return 'Running';
    case 'idle':
      return 'Idle';
    case 'attention':
      return 'Needs attention';
    case 'paused':
      return 'Paused';
    default:
      return s;
  }
}

function approvalStatusLabel(s: DemoApprovalRecord['status']): string {
  switch (s) {
    case 'approved':
      return 'Approved';
    case 'dismissed':
      return 'Dismissed';
    case 'queued_later':
      return 'Queued';
    case 'edited':
      return 'Edit queued';
    default:
      return 'Pending';
  }
}

export default function AutopilotPage() {
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const approvals = useDemoOpsStore(s => s.approvals);
  const signalStatus = useDemoOpsStore(s => s.signalStatus);
  const recommendationStatus = useDemoOpsStore(s => s.recommendationStatus);
  const activityFeed = useDemoOpsStore(s => s.activityFeed);
  const auditEvents = useAuditStore(s => s.events);
  const expandedAgents = useDemoOpsStore(s => s.expandedAgents);
  const approveApproval = useDemoOpsStore(s => s.approveApproval);
  const dismissApproval = useDemoOpsStore(s => s.dismissApproval);
  const queueApprovalLater = useDemoOpsStore(s => s.queueApprovalLater);
  const editApproval = useDemoOpsStore(s => s.editApproval);
  const reviewSignal = useDemoOpsStore(s => s.reviewSignal);
  const dismissSignal = useDemoOpsStore(s => s.dismissSignal);
  const planRecommendation = useDemoOpsStore(s => s.planRecommendation);
  const dismissRecommendation = useDemoOpsStore(s => s.dismissRecommendation);
  const createTaskFromRecommendation = useDemoOpsStore(s => s.createTaskFromRecommendation);
  const toggleAgentExpanded = useDemoOpsStore(s => s.toggleAgentExpanded);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const engine = getAgentEngineSnapshot();
  const agentCards = useMemo(() => {
    return engine.agentStates.map(a => {
      const queue = Object.values(approvals).filter(
        x => x.agentId === a.id && x.status === 'pending',
      ).length;
      return { ...a, queueDepth: queue };
    });
  }, [approvals, engine.agentStates]);

  const visibleSignals = AUTOPILOT_SIGNAL_FEED.filter(
    s => (signalStatus[s.id] ?? 'open') !== 'dismissed',
  );

  const pendingApprovals = Object.values(approvals).filter(
    a => a.status === 'pending' || a.status === 'edited',
  );
  const resolvedApprovals = Object.values(approvals).filter(
    a => a.status !== 'pending' && a.status !== 'edited',
  );

  const liveAgents = agentCards.filter(a => a.status !== 'idle').length;
  const [tab, setTab] = useState<'approvals' | 'signals' | 'agents' | 'activity'>('approvals');

  return (
    <div className="autopilot-page command-page">
      <DemoFlowNav />
      <div className="autopilot-hero command-hero">
        <div className="autopilot-hero__glow" aria-hidden />
        <div className="page-header command-hero__inner" style={{ marginBottom: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="autopilot-badge">Agent workforce</span>
              <span className="topbar-pill topbar-pill--auto" style={{ fontSize: 10 }}>
                <span className="topbar-pill__heartbeat" aria-hidden />
                <span className="topbar-pill__value">{liveAgents} agents live</span>
              </span>
              <span className="autopilot-engine-tag">
                {pendingApprovals.length} pending approval
              </span>
            </div>
            <h1 className="page-title" style={{ fontSize: 'clamp(26px, 3.5vw, 34px)' }}>
              Venue operations on autopilot — with humans in command
            </h1>
            <div className="page-subtitle" style={{ maxWidth: 760 }}>
              Approve, queue, and plan — every action updates the live operations feed instantly.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to={ROUTES.ownerBriefing} className="btn btn-secondary">
              Owner briefing
            </Link>
            <Link to={`${ROUTES.settings}/demo-controls`} className="btn btn-ghost" style={{ fontSize: 12 }}>
              Demo controls
            </Link>
          </div>
        </div>
      </div>

      <div className="autopilot-tabs" role="tablist">
        {(
          [
            ['approvals', `Approvals (${pendingApprovals.length})`],
            ['signals', `Signals (${visibleSignals.length})`],
            ['agents', `Agents (${liveAgents})`],
            ['activity', 'Activity'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'approvals' ? (
      <section className="card autopilot-panel command-panel autopilot-panel--approvals">
        <div className="autopilot-panel__head">
          <h3>Pending approvals</h3>
          <span className="autopilot-mini-hint">{pendingApprovals.length} need human decision</span>
        </div>
        <ul className="autopilot-approval-list autopilot-approval-list--rich">
          {pendingApprovals.map(p => (
            <li key={p.id} className="autopilot-approval autopilot-approval--rich">
              <div className="autopilot-approval__title">{p.title}</div>
              <p className="autopilot-approval__proposed">{p.description}</p>
              <div className="autopilot-approval__grid">
                <div>
                  <span className="autopilot-approval__lbl">Agent</span>
                  <span>{p.agent}</span>
                </div>
                <div>
                  <span className="autopilot-approval__lbl">Confidence</span>
                  <span>{p.confidence}%</span>
                </div>
                <div>
                  <span className="autopilot-approval__lbl">Risk</span>
                  <span className={`autopilot-risk autopilot-risk--${p.risk}`}>{p.risk}</span>
                </div>
              </div>
              <div className="autopilot-approval__why">
                <strong>Approval required because</strong> {p.approvalRequiredBecause}
              </div>
              <div className="autopilot-approval__actions">
                <button type="button" className="btn btn-primary" onClick={() => approveApproval(p.id)}>
                  Approve
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => editApproval(p.id)}>
                  Edit
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => queueApprovalLater(p.id)}>
                  Queue later
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => dismissApproval(p.id)}>
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
        {resolvedApprovals.length > 0 ? (
          <div className="command-resolved-approvals">
            <h4 className="command-resolved-approvals__h">Recently resolved</h4>
            {resolvedApprovals.slice(0, 4).map(p => {
              const auditRow = auditEvents.find(
                e => e.entityType === 'agent_approval' && e.entityId === p.id,
              );
              return (
                <div key={p.id} className={`command-resolved-row command-resolved-row--${p.status}`}>
                  <span>{p.title}</span>
                  <span className="command-resolved-row__st">
                    {approvalStatusLabel(p.status)}
                    {auditRow ? ` · ${auditRow.actorName}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      ) : null}

      {tab === 'signals' ? (
      <div className="command-dual-rail">
        <section className="card autopilot-panel command-panel">
          <div className="autopilot-panel__head">
            <h3>Signal feed</h3>
            <span className="autopilot-mini-hint">{visibleSignals.length} active</span>
          </div>
          <ul className="autopilot-signal-list">
            {visibleSignals.map(s => {
              const st = signalStatus[s.id] ?? 'open';
              return (
                <li key={s.id} className={`autopilot-signal autopilot-signal--${s.severity}${st === 'reviewed' ? ' autopilot-signal--reviewed' : ''}`}>
                  <div className="autopilot-signal__head">
                    <span className="autopilot-signal__agent">{s.agent}</span>
                    <span className="autopilot-signal__conf">{s.confidence}%</span>
                  </div>
                  <div className="autopilot-signal__title">{s.title}</div>
                  <div className="autopilot-signal__summary">{s.summary}</div>
                  <div className="autopilot-signal__actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => reviewSignal(s.id)}>
                      Mark reviewed
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismissSignal(s.id)}>
                      Dismiss
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card autopilot-panel command-panel">
          <div className="autopilot-panel__head">
            <h3>Recommendations</h3>
          </div>
          <ul className="autopilot-rec-list">
            {AUTOPILOT_RECOMMENDATIONS.map(r => {
              const st = recommendationStatus[r.id] ?? 'open';
              return (
                <li key={r.id} className={`autopilot-rec autopilot-rec--${r.priority}${st !== 'open' ? ` autopilot-rec--${st}` : ''}`}>
                  <div className="autopilot-rec__head">
                    <span className="autopilot-rec__agent">{r.agent}</span>
                    <span className="autopilot-rec__conf">{r.confidence}%</span>
                  </div>
                  <div className="autopilot-rec__headline">{r.headline}</div>
                  <div className="autopilot-rec__because">
                    <strong>Because</strong> {r.because}
                  </div>
                  <div className="autopilot-signal__actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => planRecommendation(r.id)}>
                      Mark planned
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => createTaskFromRecommendation(r.id, r.headline, r.headline)}
                    >
                      Create task
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismissRecommendation(r.id)}>
                      Dismiss
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      ) : null}

      {tab === 'agents' ? (
      <>
      <div className="autopilot-impact-row command-metrics-row" style={{ marginBottom: 12 }}>
        {AUTOPILOT_IMPACT_METRICS.slice(0, 4).map(m => (
          <div key={m.id} className="autopilot-impact-card command-metric-tile">
            <div className="autopilot-impact-card__label">{m.label}</div>
            <div className="autopilot-impact-card__value">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="autopilot-agent-grid command-agent-grid">
        {agentCards.map(agent => {
          const expanded = expandedAgents[agent.id];
          const signals = getAgentSignalsFor(agent.id).slice(0, 3);
          return (
            <article key={agent.id} className={`autopilot-agent-card autopilot-agent-card--${agent.status} command-agent-tile`}>
              <div className="autopilot-agent-card__head">
                <span className={`autopilot-status autopilot-status--${agent.status}`}>{statusLabel(agent.status)}</span>
                <span className="autopilot-agent-card__beat">{agent.lastRunAt}</span>
              </div>
              <h3 className="autopilot-agent-card__name">{agent.name}</h3>
              <p className="autopilot-agent-card__tag">{agent.tagline}</p>
              {agent.lastSignal ? (
                <p className="autopilot-agent-card__signal">
                  <span className="autopilot-agent-card__signal-label">Last signal</span>
                  {agent.lastSignal}
                </p>
              ) : null}
              <div className="autopilot-agent-card__meta-row">
                <span className="autopilot-agent-card__mode">{agent.runMode.replace(/_/g, ' ')}</span>
                <span className="autopilot-agent-card__conf">{agent.confidence}% conf.</span>
              </div>
              <div className="autopilot-agent-card__stats">
                <span>
                  Queue · <strong>{agent.queueDepth}</strong>
                </span>
                <span>
                  Signals · <strong>{signals.length}</strong>
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost command-agent-tile__expand"
                onClick={() => toggleAgentExpanded(agent.id)}
              >
                {expanded ? 'Hide signals' : 'View signals'}
              </button>
              {expanded && signals.length > 0 ? (
                <ul className="command-agent-tile__signals">
                  {signals.map(sig => (
                    <li key={sig.id}>{sig.title}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
      </>
      ) : null}

      {tab === 'activity' ? (
        <section className="card autopilot-panel command-panel">
          <div className="autopilot-panel__head">
            <h3>Live agent activity</h3>
            <Link to={ROUTES.tasks} style={{ fontSize: 12, fontWeight: 700 }}>
              Tasks
            </Link>
          </div>
          <ActivityTimeline limit={12} title="Recent operational actions" />
          <ul className="autopilot-feed">
            {activityFeed.slice(0, 12).map(f => (
              <li key={f.id} className="autopilot-feed__item">
                <span className="autopilot-feed__time">{f.at}</span>
                <span className="autopilot-feed__agent">{f.agent ?? f.category}</span>
                <span className="autopilot-feed__text">{f.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
