import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { isAnalyticsConfigured } from '../../analytics/index.js';

export default function AnalyticsSettingsPanel() {
  const configured = isAnalyticsConfigured();

  return (
    <div className="settings-deep">
      <div className="settings-provider-card card">
        <h4>Google Analytics</h4>
        <p>
          Status: <strong>{configured ? 'Connected' : 'Not configured yet'}</strong>
        </p>
        <p className="settings-muted">
          {configured
            ? 'Page views and key events are tracked when the measurement ID is set at deploy time.'
            : 'Add the measurement ID in your deployment environment to enable analytics.'}
        </p>
      </div>
      <p className="settings-muted">
        <Link to={ROUTES.monthlyScorecard}>Open Monthly Scorecard →</Link>
      </p>
    </div>
  );
}
