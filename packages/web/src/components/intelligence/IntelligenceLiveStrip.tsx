import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import type { VenueCommandState } from '../../data/venueCommandState.js';
import { isAiEnabled } from '../../intelligence/ai/config.js';

type Props = {
  commandState: VenueCommandState;
};

export default function IntelligenceLiveStrip({ commandState: cmd }: Props) {
  const ai = isAiEnabled();

  return (
    <section className="intel-live-strip" aria-label="Operational signal stream">
      <header className="intel-live-strip__head">
        <div>
          <h2 className="intel-live-strip__title">
            <span className="ops-pulse" aria-hidden />
            Live intelligence
          </h2>
          <p className="intel-live-strip__sub">
            Venue command state · {cmd.pressure.totalSignals} pressure-eligible · AI{' '}
            {ai ? 'assist on' : 'off'}
          </p>
        </div>
        <Link to={ROUTES.autopilot} className="btn btn-secondary btn-sm">
          Autopilot ({cmd.approvals.pending})
        </Link>
      </header>
      <div className="intel-live-strip__scores">
        <span title="Average top pressure scores (0–100)">Pressure {cmd.pressure.displayScore}</span>
        <span title={cmd.operationalReadiness.factors.join(' · ')}>
          Readiness {cmd.operationalReadiness.score}
        </span>
        <span title={`${cmd.pressure.critical} critical · ${cmd.pressure.revenueAtRisk} revenue at risk`}>
          At risk {cmd.pressure.revenueAtRisk}
        </span>
        <span title={`${cmd.pressure.staleProposals} stale proposals`}>
          Stale {cmd.pressure.staleProposals}
        </span>
      </div>
      <ul className="intel-live-strip__list">
        {cmd.attentionItems.map(a => (
          <li
            key={a.id}
            className={`intel-live-strip__item intel-live-strip__item--${a.severity}`}
          >
            <span className="intel-live-strip__agent">venue command</span>
            <strong>{a.text.split(':')[0]}</strong>
            <span className="intel-live-strip__meta">{a.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
