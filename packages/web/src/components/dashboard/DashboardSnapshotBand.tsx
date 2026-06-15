import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../config/paths.js';
import { isAnalyticsConfigured } from '../../analytics/index.js';
import { isProductionCRM } from '../../config/productionData.js';
import client from '../../api/client.js';

const DashboardSnapshotBandDemo = lazy(() => import('./DashboardSnapshotBandDemo.js'));

export default function DashboardSnapshotBand() {
  const { data: mailchimp } = useQuery({
    queryKey: ['integrations', 'mailchimp', 'status'],
    queryFn: () =>
      client.get<{ configured: boolean }>('/integrations/mailchimp/status').then(r => r.data),
    retry: false,
    staleTime: 60_000,
  });

  const mailchimpLabel = mailchimp?.configured ? 'Connected' : 'Not configured yet';
  const analyticsLabel = isAnalyticsConfigured() ? 'Connected' : 'Not configured yet';

  if (isProductionCRM()) {
    return (
      <section className="dashboard-band dashboard-band--snapshot" aria-label="Integrations">
        <h2 className="dashboard-band__title">Integrations</h2>
        <div className="dashboard-snapshot-grid">
          <div className="dashboard-snapshot-card dashboard-snapshot-card--static">
            <span className="dashboard-snapshot-card__label">Connected services</span>
            <span className="dashboard-snapshot-card__meta">Mailchimp · {mailchimpLabel}</span>
            <span className="dashboard-snapshot-card__meta">Analytics · {analyticsLabel}</span>
            <Link to={`${ROUTES.settings}/integrations`} className="section-head__action" style={{ marginTop: 8 }}>
              Settings →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Suspense fallback={null}>
      <DashboardSnapshotBandDemo mailchimpLabel={mailchimpLabel} analyticsLabel={analyticsLabel} />
    </Suspense>
  );
}