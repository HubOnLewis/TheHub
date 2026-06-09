import PageIntro from '../components/layout/PageIntro.js';
import ReferralProgramPanel from '../components/admin/ReferralProgramPanel.js';

export default function ReferralsPage() {
  return (
    <div className="page-simple">
      <PageIntro
        title="Referrals"
        subtitle="Track referral links and attribution. Payout terms are configurable — sending and payouts are not automatic."
      />
      <ReferralProgramPanel />
    </div>
  );
}
