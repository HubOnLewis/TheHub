import PageIntro from '../components/layout/PageIntro.js';
import MonthlyScorecard from '../components/admin/MonthlyScorecard.js';

export default function MonthlyScorecardPage() {
  return (
    <div className="page-simple">
      <PageIntro
        title="Monthly Scorecard"
        subtitle="Key venue metrics from your CRM data. Unavailable metrics stay blank until data exists."
      />
      <MonthlyScorecard />
    </div>
  );
}
