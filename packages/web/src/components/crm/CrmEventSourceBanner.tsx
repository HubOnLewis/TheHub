import { Link } from 'react-router-dom';
import type { CrmEventSourceManifest } from '../../lib/crmEventSource.js';
import { ROUTES } from '../../config/paths.js';

type Props = {
  manifest: CrmEventSourceManifest;
  apiError?: boolean;
};

type BannerTone = 'live' | 'import' | 'empty' | 'error';

function resolveBanner(
  manifest: CrmEventSourceManifest,
  apiError?: boolean,
): { tone: BannerTone; primary: string; secondary?: string } {
  if (manifest.sourceId === 'live-api') {
    return {
      tone: 'live',
      primary: `Live workspace data · ${manifest.rowCount} event${manifest.rowCount === 1 ? '' : 's'} from your CRM`,
    };
  }

  if (manifest.sourceId === 'none') {
    if (apiError) {
      return {
        tone: 'error',
        primary: 'Could not load live events',
        secondary: manifest.warningMessage ?? 'Check your connection and try refreshing the page.',
      };
    }
    return {
      tone: 'empty',
      primary: 'No events in your workspace yet',
      secondary: 'Add an event or import data in Settings when you are ready.',
    };
  }

  return {
    tone: 'import',
    primary: `Imported reference data · ${manifest.rowCount} event${manifest.rowCount === 1 ? '' : 's'} · not live Mongo`,
    secondary:
      manifest.warningMessage ??
      (apiError
        ? 'Live data is temporarily unavailable — these events are from a bundled Perfect Venue import.'
        : 'These events come from a bundled Perfect Venue import, not your live database.'),
  };
}

function toneClass(tone: BannerTone): string {
  switch (tone) {
    case 'live':
      return 'crm-source-banner--info';
    case 'error':
      return 'crm-source-banner--error';
    case 'empty':
      return 'crm-source-banner--warn';
    default:
      return 'crm-source-banner--warn';
  }
}

/** Always-visible data source indicator for client demos. */
export default function CrmEventSourceBanner({ manifest, apiError }: Props) {
  const banner = resolveBanner(manifest, apiError);

  return (
    <div
      className={`crm-source-banner ${toneClass(banner.tone)}`}
      role="status"
      aria-live="polite"
    >
      <span className={`crm-source-banner__dot crm-source-banner__dot--${banner.tone}`} aria-hidden />
      <div className="crm-source-banner__content">
        <p className="crm-source-banner__primary">{banner.primary}</p>
        {banner.secondary ? (
          <p className="crm-source-banner__secondary">{banner.secondary}</p>
        ) : null}
        {banner.tone === 'import' || banner.tone === 'empty' ? (
          <p className="crm-source-banner__meta">
            <Link to={`${ROUTES.settings}/data-import`} className="crm-source-banner__link">
              Data import settings
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
