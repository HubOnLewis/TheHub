import MonthlyScorecard from '../components/admin/MonthlyScorecard.js';

export default function MonthlyScorecardPage() {
  return (
    <div className="hub-reports-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Monthly Scorecard</h1>
          <p className="hub-admin-page__subtitle">
            Key venue metrics from your CRM data. Unavailable metrics are labeled until live data is connected.
          </p>
        </div>
        <span className="hub-admin-stat-pill">Monthly report</span>
      </header>

      <section className="hub-reports-section">
        <h2>Pipeline &amp; revenue</h2>
        <p>Counts and totals update from live CRM data when available.</p>
        <MonthlyScorecard />
      </section>

      <section className="hub-reports-section">
        <h2>Trends &amp; comparisons</h2>
        <p>Historical charts require additional reporting data — not configured yet.</p>
        <div className="hub-reports-placeholder">
          <div className="hub-reports-placeholder__card">Booking trend chart — Not available yet</div>
          <div className="hub-reports-placeholder__card">Revenue vs. target — Not available yet</div>
          <div className="hub-reports-placeholder__card">Lead conversion funnel — Not available yet</div>
        </div>
      </section>
    </div>
  );
}
