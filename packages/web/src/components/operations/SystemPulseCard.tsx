import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { countPendingApprovals, useDemoOpsStore } from '../../state/demoOpsStore.js';

interface SystemPulseCardProps {
  compact?: boolean;
  className?: string;
}

/** Compact operational pulse — approvals, tasks, last movement */
export default function SystemPulseCard({ compact, className = '' }: SystemPulseCardProps) {
  const approvals = useDemoOpsStore(s => s.approvals);
  const tasks = useDemoOpsStore(s => s.tasks);
  const lastPulseAt = useDemoOpsStore(s => s.lastPulseAt);
  const feed = useDemoOpsStore(s => s.activityFeed);

  const pending = countPendingApprovals(approvals);
  const openTasks = tasks.filter(t => t.status === 'open').length;
  const urgent = tasks.filter(t => t.status === 'open' && (t.overdue || t.priority === 'high')).length;
  const latest = feed[0];

  const pulseLabel = useMemo(() => {
    const age = Date.now() - new Date(lastPulseAt).getTime();
    if (age < 120_000) return 'Active now';
    if (age < 900_000) return 'Recent movement';
    return 'Monitoring';
  }, [lastPulseAt]);

  return (
    <div className={`system-pulse-card${compact ? ' system-pulse-card--compact' : ''} ${className}`.trim()}>
      <div className="system-pulse-card__header">
        <span className="system-pulse-card__orb" aria-hidden />
        <div>
          <span className="system-pulse-card__title">System pulse</span>
          <span className="system-pulse-card__state">{pulseLabel}</span>
        </div>
      </div>
      <div className="system-pulse-card__metrics">
        <Link to={ROUTES.autopilot} className="system-pulse-metric system-pulse-metric--warn">
          <span className="system-pulse-metric__val">{pending}</span>
          <span className="system-pulse-metric__lbl">Approvals</span>
        </Link>
        <Link to={ROUTES.tasks} className="system-pulse-metric">
          <span className="system-pulse-metric__val">{openTasks}</span>
          <span className="system-pulse-metric__lbl">Open tasks</span>
        </Link>
        <span className="system-pulse-metric">
          <span className="system-pulse-metric__val">{urgent}</span>
          <span className="system-pulse-metric__lbl">Urgent</span>
        </span>
      </div>
      {latest && !compact && (
        <p className="system-pulse-card__latest">
          Latest · {latest.summary}
        </p>
      )}
    </div>
  );
}
