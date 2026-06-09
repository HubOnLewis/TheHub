import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import {
  CONTEXT_AGENT_DOCK,
  type AgentDockContext,
  type AgentDockRisk,
} from '../../data/contextAgentDock.js';

const RISK_CLASS: Record<AgentDockRisk, string> = {
  low: 'agent-dock__risk agent-dock__risk--low',
  medium: 'agent-dock__risk agent-dock__risk--medium',
  high: 'agent-dock__risk agent-dock__risk--high',
};

interface ContextAgentDockProps {
  context: AgentDockContext;
  compact?: boolean;
  className?: string;
}

/** Embedded agent intelligence — ambient operational staff, not chat. */
export default function ContextAgentDock({ context, compact, className = '' }: ContextAgentDockProps) {
  const model = CONTEXT_AGENT_DOCK[context];

  return (
    <aside
      className={`agent-dock surface-3${compact ? ' agent-dock--compact' : ''} ${className}`.trim()}
      aria-label="Agent operational context"
    >
      <header className="agent-dock__head">
        <span className="agent-dock__orb" aria-hidden />
        <div>
          <span className="agent-dock__eyebrow">Agents on this surface</span>
          <h3 className="agent-dock__title">Operational intelligence</h3>
        </div>
        <Link to={ROUTES.autopilot} className="agent-dock__link">
          Workforce →
        </Link>
      </header>

      <div className="agent-dock__watching">
        <span className="agent-dock__lbl">Watching</span>
        <div className="agent-dock__chips">
          {model.watching.map(w => (
            <span key={w.agentId} className="agent-dock__chip" data-agent={w.agentId}>
              {w.label}
            </span>
          ))}
        </div>
      </div>

      <div className="agent-dock__grid">
        <div className="agent-dock__block agent-dock__block--move">
          <span className="agent-dock__lbl">Suggested next move</span>
          <p>{model.suggestedMove}</p>
        </div>
        <div className="agent-dock__block">
          <span className="agent-dock__lbl">Why this matters</span>
          <p>{model.whyItMatters}</p>
        </div>
        <div className="agent-dock__block">
          <span className="agent-dock__lbl">What changed recently</span>
          <p>{model.whatChanged}</p>
        </div>
        <div className="agent-dock__block agent-dock__block--action">
          <span className="agent-dock__lbl">Recommended owner action</span>
          <p>{model.ownerAction}</p>
        </div>
      </div>

      <footer className="agent-dock__foot">
        <span className={RISK_CLASS[model.risk]}>{model.risk} operational risk</span>
        <span className="agent-dock__hint">Woven agents · approval-gated outbound</span>
      </footer>
    </aside>
  );
}
