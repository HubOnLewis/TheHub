import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../config/paths.js';
import { isAnalyticsConfigured } from '../../analytics/index.js';
import client from '../../api/client.js';
import { useReferralsStore } from '../../store/referralsStore.js';
import { useMarketingBlastsStore } from '../../store/marketingBlastsStore.js';

export default function DashboardSnapshotBand() {
  const referralClicks = useReferralsStore(s => s.getTotalClicks());
  const draftCount = useMarketingBlastsStore(s => s.drafts.length);

  const { data: mailchimp } = useQuery({
    queryKey: ['integrations', 'mailchimp', 'status'],
    queryFn: () =>
      client.get<{ configured: boolean }>('/integrations/mailchimp/status').then(r => r.data),
    retry: false,
    staleTime: 60_000,
  });

  const mailchimpLabel = mailchimp?.configured ? 'Connected' : 'Not configured yet';
  const analyticsLabel = isAnalyticsConfigured() ? 'Connected' : 'Not configured yet';

  return (
    <section className="dashboard-band dashboard-band--snapshot" aria-label="Snapshot">
      <h2 className="dashboard-band__title">Snapshot</h2>
      <div className="dashboard-snapshot-grid">
        <Link to={ROUTES.monthlyScorecard} className="dashboard-snapshot-card">
          <span className="dashboard-snapshot-card__label">Monthly scorecard</span>
          <span className="dashboard-snapshot-card__value">View metrics →</span>
        </Link>
        <Link to={ROUTES.referrals} className="dashboard-snapshot-card">
          <span className="dashboard-snapshot-card__label">Referral clicks</span>
          <span className="dashboard-snapshot-card__value">{referralClicks}</span>
        </Link>
        <Link to={ROUTES.marketing} className="dashboard-snapshot-card">
          <span className="dashboard-snapshot-card__label">Marketing drafts</span>
          <span className="dashboard-snapshot-card__value">{draftCount}</span>
        </Link>
        <div className="dashboard-snapshot-card dashboard-snapshot-card--static">
          <span className="dashboard-snapshot-card__label">Integrations</span>
          <span className="dashboard-snapshot-card__meta">Mailchimp · {mailchimpLabel}</span>
          <span className="dashboard-snapshot-card__meta">Analytics · {analyticsLabel}</span>
        </div>
      </div>
    </section>
  );
}
