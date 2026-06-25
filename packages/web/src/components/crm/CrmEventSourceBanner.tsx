import { Link } from 'react-router-dom';
import type { CrmEventSourceManifest } from '../../lib/crmEventSource.js';
import { ROUTES } from '../../config/paths.js';

type Props = {
  manifest: CrmEventSourceManifest;
};

function needsReview(manifest: CrmEventSourceManifest): boolean {
  if (manifest.sourceId === 'live-api') return false;
  if (!manifest.warningMessage && manifest.matchesPvExpectedSummary) return false;
  return true;
}

/** Subtle one-line notice — technical detail lives in Settings → Data import. */
export default function CrmEventSourceBanner({ manifest }: Props) {
  if (!needsReview(manifest)) return null;

  return (
    <div className="crm-source-banner crm-source-banner--info" role="status">
      <p className="crm-source-banner__primary">
        Imported data review
        {' · '}
        <Link to={`${ROUTES.settings}/data-import`} className="crm-source-banner__link">
          View in Settings
        </Link>
      </p>
    </div>
  );
}
