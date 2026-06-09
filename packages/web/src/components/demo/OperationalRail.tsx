import { Link } from 'react-router-dom';
import { isScreenshotMode } from '../../config/screenshotMode.js';
import { DEMO_VENUE_NAME } from '../../data/demoVenue.js';
import { useVenueCommandState } from '../../hooks/useVenueCommandState.js';
import { formatRelativeTime } from '../../lib/relativeTime.js';
import { ROUTES } from '../../config/paths.js';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';
import LiveOpsTicker from '../operations/LiveOpsTicker.js';

/** Single compact operational rail — session, status, trust, live feed */
export default function OperationalRail() {
  const meta = useDemoOpsStore(s => s.sessionMeta) ?? {
    continuityLabel: 'Operational session',
    lastModifiedBy: 'System',
    lastModifiedAt: new Date().toISOString(),
  };
  const cmd = useVenueCommandState();
  const occupancy = cmd.occupancy.operational;
  const pending = cmd.approvals.pending;
  const clientReview = isScreenshotMode();

  return (
    <div className="ops-rail" role="region" aria-label="Operational status">
      <div className="ops-rail__identity">
        <span className="ops-rail__live" aria-hidden />
        <span className="ops-rail__venue">{DEMO_VENUE_NAME}</span>
        <span className="ops-rail__session">
          {meta.continuityLabel} · <strong>{meta.lastModifiedBy}</strong> ·{' '}
          {formatRelativeTime(meta.lastModifiedAt)}
        </span>
      </div>

      <LiveOpsTicker limit={5} className="ops-rail__ticker" compact />

      <div className="ops-rail__status">
        <span className="ops-rail__pill">
          <span className="ops-rail__pill-label">Occupancy</span>
          <span className="ops-rail__pill-value">{occupancy}%</span>
        </span>
        <Link to={ROUTES.autopilot} className="ops-rail__pill ops-rail__pill--link">
          <span className="ops-rail__pill-label">Approvals</span>
          <span className="ops-rail__pill-value">{pending}</span>
        </Link>
        {clientReview ? (
          <span className="ops-rail__pill ops-rail__pill--review">Client review</span>
        ) : null}
        <span
          className="ops-rail__trust"
          title="Actions queue locally — no live emails, payments, or external automations are sent."
        >
          Queued for approval
        </span>
      </div>
    </div>
  );
}
