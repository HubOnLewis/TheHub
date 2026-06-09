import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';

interface AgentWatchBadgeProps {
  activeCount: number;
  headline: string;
  sub?: string;
  className?: string;
}

export default function AgentWatchBadge({ activeCount, headline, sub, className = '' }: AgentWatchBadgeProps) {
  return (
    <Link to={ROUTES.autopilot} className={`agent-watch-badge ${className}`.trim()}>
      <span className="agent-watch-badge__ring" aria-hidden>
        <span className="agent-watch-badge__count">{activeCount}</span>
      </span>
      <span className="agent-watch-badge__copy">
        <strong>{headline}</strong>
        {sub && <span className="agent-watch-badge__sub">{sub}</span>}
      </span>
      <span className="agent-watch-badge__cta">Autopilot →</span>
    </Link>
  );
}
