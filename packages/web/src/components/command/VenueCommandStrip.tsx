import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { BRAND } from '../../branding/tokens.js';
import type { DashboardViewModel } from '../../data/buildDashboardViewModel.js';
import MetricChip from './MetricChip.js';

type Props = {
  model: DashboardViewModel;
};

const GROUP_LABELS: Record<string, string> = {
  money: 'Revenue',
  capacity: 'Capacity',
  workflow: 'Workflow',
  outlook: 'Health',
};

export default function VenueCommandStrip({ model }: Props) {
  const groups = ['money', 'capacity', 'workflow', 'outlook'] as const;

  return (
    <section className="venue-command-strip" aria-label="Venue command">
      <div className="venue-command-strip__main">
        <div className="venue-command-strip__top">
          <div className="venue-command-strip__identity">
            <span className="venue-command-strip__live" aria-hidden />
            <div>
              <p className="venue-command-strip__eyebrow">{model.asOfLabel}</p>
              <h1 className="venue-command-strip__title">Command center</h1>
              <p className="venue-command-strip__venue-line">
                {BRAND.venueName} · {BRAND.venueLocation}
              </p>
            </div>
          </div>
          <div className="venue-command-strip__actions">
            <Link to={ROUTES.today} className="btn btn-secondary btn-sm">
              Today
            </Link>
            <Link to={ROUTES.autopilot} className="btn btn-ghost btn-sm">
              Review queue
            </Link>
          </div>
        </div>
        <p className="venue-command-strip__suggestion">{model.suggestedAction}</p>
        <div className="venue-command-strip__metric-groups">
          {groups.map(group => {
            const chips = model.metrics.filter(m => m.group === group);
            if (!chips.length) return null;
            return (
              <div key={group} className="venue-command-strip__group" aria-label={GROUP_LABELS[group]}>
                <span className="venue-command-strip__group-label">{GROUP_LABELS[group]}</span>
                <div className="venue-command-strip__chips">
                  {chips.map(m => (
                    <MetricChip key={m.id} metric={m} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
