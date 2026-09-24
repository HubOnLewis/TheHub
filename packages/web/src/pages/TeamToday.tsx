import { Link } from 'react-router-dom';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import { useVenueOpsQueue, useVenueOpsTaskAction, useVenueOpsTaskAssignment } from '../hooks/useVenueOps.js';
import LoadingState from '../components/crm/LoadingState.js';

export default function TeamToday() {
  const ops = useVenueOpsQueue();
  const action = useVenueOpsTaskAction();
  const assignment = useVenueOpsTaskAssignment();
  const tasks = ops.data?.tasks ?? [];
  if (ops.isLoading) return <LoadingState message="Loading team work…" />;
  const groups = [
    { id: 'hannah', name: 'Hannah', type: 'user' },
    { id: 'lewis', name: 'Lewis', type: 'agent' },
    { id: 'jason', name: 'Jason', type: 'user' },
    { id: 'unassigned', name: 'Unassigned', type: 'unassigned' },
  ] as const;
  return (
    <main className="today-desk team-today">
      <header className="today-desk__header">
        <div>
          <p className="today-desk__kicker">Active work · {tasks.length} tasks</p>
          <h1 className="today-desk__title">Team Today</h1>
          <p className="today-desk__sub">Everything the HuB team and its AI agents are responsible for right now.</p>
        </div>
        <div className="today-desk__actions">
          <Link to={ROUTES.today} className="btn btn-secondary btn-sm">My Today</Link>
          <Link to={ROUTES.tasks} className="btn btn-secondary btn-sm">Task Center</Link>
        </div>
      </header>
      {groups.map(group => {
        const rows = tasks.filter(t => t.assignee?.id === group.id && t.assignee?.type === group.type);
        return (
          <section key={group.id} className="today-desk__work" aria-label={group.name}>
            <header className="today-desk__section-head">
              <h2>{group.name}{group.type === 'agent' ? ' · AI' : ''}</h2><span>{rows.length}</span>
            </header>
            {rows.length === 0 ? <p className="today-desk__empty">No active work assigned.</p> : (
              <ul className="today-desk__list">{rows.map(t => (
                <li key={t.id} className="today-desk__row">
                  <Link to={opportunityDetailPath(t.dealId)} className="today-desk__row-main">
                    <strong>{t.title}</strong><span>{t.dueLabel} · {t.contact} · {t.assignee.reason}</span>
                  </Link>
                  <div className="today-desk__row-actions">
                    <span className="today-desk__chip">{t.workStatus.replace('_', ' ')}</span>
                    <span className="today-desk__chip">{t.priority}</span>
                    <select
                      className="input"
                      aria-label={`Assign ${t.title}`}
                      value={t.assignee.id}
                      disabled={assignment.isPending}
                      onChange={e => {
                        const id = e.target.value;
                        const target = id === 'lewis'
                          ? { type: 'agent' as const, id: 'lewis', name: 'Lewis' }
                          : id === 'jason'
                            ? { type: 'user' as const, id: 'jason', name: 'Jason' }
                            : id === 'hannah'
                              ? { type: 'user' as const, id: 'hannah', name: 'Hannah' }
                              : { type: 'unassigned' as const, id: 'unassigned', name: 'Unassigned' };
                        assignment.mutate({ taskId: t.id, dealId: t.dealId, assignee: target, reason: 'Reassigned from Team Today' });
                      }}
                    >
                      <option value="hannah">Hannah</option>
                      <option value="lewis">Lewis · AI</option>
                      <option value="jason">Jason</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                    {t.workStatus === 'open' ? <button type="button" className="btn btn-secondary btn-sm" disabled={action.isPending}
                      onClick={() => action.mutate({ taskId: t.id, dealId: t.dealId, action: 'start' })}>Start</button> : null}
                    {t.workStatus !== 'waiting_approval' && group.type === 'agent' ? <button type="button" className="btn btn-secondary btn-sm" disabled={action.isPending}
                      onClick={() => action.mutate({ taskId: t.id, dealId: t.dealId, action: 'request_approval' })}>Ready for approval</button> : null}
                    {t.workStatus !== 'blocked' ? <button type="button" className="btn btn-ghost btn-sm" disabled={action.isPending}
                      onClick={() => action.mutate({ taskId: t.id, dealId: t.dealId, action: 'block' })}>Block</button> : null}
                    {group.type === 'user' || t.workStatus === 'waiting_approval' ? <button type="button" className="btn btn-primary btn-sm" disabled={action.isPending}
                      onClick={() => action.mutate({ taskId: t.id, dealId: t.dealId, action: 'complete' })}>Done</button> : null}
                  </div>
                </li>
              ))}</ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
