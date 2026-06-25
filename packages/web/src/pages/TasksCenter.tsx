import { useEffect, useMemo, useState } from 'react';
import { isProductionCRM } from '../config/productionData.js';
import LiveTasksPage from './live/LiveTasksPage.js';
import { type TaskAutomationBadge } from '../data/demoVenue.js';
import EmbeddedAgentPanel from '../components/agents/EmbeddedAgentPanel.js';
import { TASKS_INSIGHTS } from '../data/embeddedAgentInsights.js';
import { useDemoOpsStore } from '../state/demoOpsStore.js';
import { useAuditStore } from '../audit/auditStore.js';
import { getEntityAttribution } from '../audit/entityAttribution.js';

function automationBadgeLabel(b: TaskAutomationBadge): string {
  switch (b) {
    case 'auto-generated':
      return 'Auto-generated';
    case 'ai-suggested':
      return 'AI suggested';
    case 'approval-required':
      return 'Approval required';
    case 'scheduled-sequence':
      return 'Scheduled sequence';
    default:
      return b;
  }
}

function formatDue(iso: string, overdue: boolean, days: number): string {
  if (overdue) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days}d`;
}

const OWNERS = [
  { initials: 'JL', name: 'Jordan Lee' },
  { initials: 'MK', name: 'Morgan Keesling' },
  { initials: 'HB', name: 'Hannah Bayless' },
  { initials: 'AR', name: 'Alex Rivera' },
  { initials: 'SO', name: 'Sam Okonkwo' },
];

export default function TasksCenter() {
  if (isProductionCRM()) return <LiveTasksPage />;
  return <TasksCenterDemo />;
}

function TasksCenterDemo() {
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const tasks = useDemoOpsStore(s => s.tasks);
  const completeTask = useDemoOpsStore(s => s.completeTask);
  const reopenTask = useDemoOpsStore(s => s.reopenTask);
  const assignTask = useDemoOpsStore(s => s.assignTask);
  const setTaskPriority = useDemoOpsStore(s => s.setTaskPriority);
  const addTask = useDemoOpsStore(s => s.addTask);
  const auditEvents = useAuditStore(s => s.events);

  const [filter, setFilter] = useState<'open' | 'completed' | 'autopilot' | 'all'>('open');

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const rows = useMemo(() => {
    let r = tasks;
    if (filter === 'open') r = r.filter(t => t.status === 'open');
    if (filter === 'completed') r = r.filter(t => t.status === 'completed');
    if (filter === 'autopilot') r = r.filter(t => t.automationBadge !== 'ai-suggested' || t.automationSource.includes('Autopilot') || t.title.includes('Kisi'));
    return r;
  }, [tasks, filter]);

  const openCount = tasks.filter(t => t.status === 'open').length;
  const overdueCount = tasks.filter(t => t.overdue && t.status === 'open').length;
  const autoCount = tasks.filter(t => t.title.includes('Kisi') || t.automationBadge === 'scheduled-sequence').length;

  return (
    <div className="command-page hub-tasks-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Tasks</h1>
          <p className="hub-admin-page__subtitle">
            Workflow queue — assign owners, set priority, and complete follow-ups.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            addTask({
              title: 'Event prep checklist',
              priority: 'medium',
              linkedEvent: 'Manual add',
              client: 'HuB on Lewis',
              owner: OWNERS[2],
              dueAt: new Date(Date.now() + 86400000).toISOString(),
              overdue: false,
              daysUntil: 1,
              automationSource: 'Ops · quick add',
              automationBadge: 'ai-suggested',
            })
          }
        >
          + Add task
        </button>
      </header>
      <div className="tasks-stat-strip command-stat-strip">
        <div className="tasks-stat-pill">
          <span className="tasks-stat-pill__label">Open</span>
          <strong>{openCount}</strong>
        </div>
        <div className="tasks-stat-pill tasks-stat-pill--urgent">
          <span className="tasks-stat-pill__label">Overdue</span>
          <strong>{overdueCount}</strong>
        </div>
        <div className="tasks-stat-pill">
          <span className="tasks-stat-pill__label">Autopilot</span>
          <strong>{autoCount}</strong>
        </div>
      </div>

      <div className="tasks-shell command-tasks-shell">
        <div className="command-tasks-main">
          <div className="tasks-filter-bar">
            {(['open', 'completed', 'autopilot', 'all'] as const).map(f => (
              <button
                key={f}
                type="button"
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'autopilot' ? 'Autopilot generated' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="tasks-table-wrap command-table">
            <div className="tasks-row tasks-row--head">
              <span />
              <span>Priority</span>
              <span>Autopilot</span>
              <span>Task / context</span>
              <span>Owner</span>
              <span>Due</span>
              <span>Actions</span>
            </div>
            {rows.map(t => (
              <div
                key={t.id}
                className={`tasks-row${t.overdue ? ' tasks-row--overdue' : ''}${t.status === 'completed' ? ' tasks-row--done' : ''}`}
              >
                <span>
                  <input
                    type="checkbox"
                    checked={t.status === 'completed'}
                    onChange={() => (t.status === 'completed' ? reopenTask(t.id) : completeTask(t.id))}
                    aria-label={`Mark ${t.title} complete`}
                  />
                </span>
                <span>
                  <select
                    className="form-select form-select--dense"
                    value={t.priority}
                    onChange={e => setTaskPriority(t.id, e.target.value as typeof t.priority)}
                  >
                    <option value="urgent">urgent</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </span>
                <span>
                  <span className={`task-automation-badge task-automation-badge--${t.automationBadge}`}>
                    {automationBadgeLabel(t.automationBadge)}
                  </span>
                </span>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {t.linkedEvent} · {t.client}
                  </div>
                  {(() => {
                    const attr = getEntityAttribution(auditEvents, 'task', t.id);
                    if (!attr) return null;
                    return (
                      <div className="task-audit-line">
                        {t.status === 'completed'
                          ? `Completed by ${attr.lastEditedBy}`
                          : `Last updated by ${attr.lastEditedBy}`}{' '}
                        · {attr.lastEditedAtRel}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <select
                    className="form-select form-select--dense"
                    value={t.owner.name}
                    onChange={e => {
                      const o = OWNERS.find(x => x.name === e.target.value) ?? t.owner;
                      assignTask(t.id, o);
                    }}
                  >
                    {OWNERS.map(o => (
                      <option key={o.name} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{ fontWeight: 700, color: t.overdue ? 'var(--red)' : 'var(--text-primary)' }}>
                  {formatDue(t.dueAt, t.overdue, t.daysUntil)}
                </span>
                <span>
                  {t.status === 'open' ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => completeTask(t.id)}>
                      Complete
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => reopenTask(t.id)}>
                      Reopen
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="command-side-rail hub-tasks-rail">
          <EmbeddedAgentPanel title="Assistant insights" insights={TASKS_INSIGHTS} compact />
          <div className="ai-side-panel command-panel hub-tasks-suggestions">
            <h3>Suggested next actions</h3>
            <ul className="command-bullet-list">
              <li>Send follow-up email — Dufferfest rehearsal dinner</li>
              <li>Miller/Harris proposal — deposit reminder</li>
              <li>Final balance reminder · Villarreal grad party</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
