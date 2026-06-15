import PageIntro from '../components/layout/PageIntro.js';
import MarketingBlastsPage from './MarketingBlastsPage.js';

/** Marketing hub — draft blasts (prospects live under Leads & Prospects). */
export default function MarketingPage() {
  return (
    <div className="page-simple">
      <PageIntro
        title="Marketing"
        subtitle="Draft campaigns for review. Sending is not enabled yet."
      />
      <MarketingBlastsPage embedded />
    </div>
  );
}
