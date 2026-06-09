import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import type { EmbeddedInsight } from '../../data/embeddedAgentInsights.js';
import AgentInsightChip from './AgentInsightChip.js';

interface EmbeddedAgentPanelProps {
  title?: string;
  insights: EmbeddedInsight[];
  compact?: boolean;
  className?: string;
}

export default function EmbeddedAgentPanel({
  title = 'Agent intelligence',
  insights,
  compact,
  className = '',
}: EmbeddedAgentPanelProps) {
  if (insights.length === 0) return null;
  return (
    <aside className={`embedded-agent-panel${compact ? ' embedded-agent-panel--compact' : ''} ${className}`.trim()}>
      <header className="embedded-agent-panel__head">
        <span className="embedded-agent-panel__badge">Woven agents</span>
        <h3>{title}</h3>
        <Link to={ROUTES.autopilot} className="embedded-agent-panel__link">
          Command center →
        </Link>
      </header>
      <div className="embedded-agent-panel__chips">
        {insights.map((ins, i) => (
          <AgentInsightChip
            key={`${ins.agentId}-${i}`}
            agentId={ins.agentId}
            agentName={ins.agentName}
            message={ins.message}
            tone={ins.tone}
          />
        ))}
      </div>
    </aside>
  );
}
