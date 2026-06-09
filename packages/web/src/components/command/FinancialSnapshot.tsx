import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import type { FinancialSnapshotView } from '../../data/buildDashboardViewModel.js';

type Props = {
  financial: FinancialSnapshotView;
};

export default function FinancialSnapshot({ financial }: Props) {
  return (
    <section className="financial-snapshot" aria-label="Financial snapshot">
      <header className="section-head">
        <div>
          <h2 className="section-head__title">Revenue position</h2>
          <p className="section-head__sub">Payment ledger and open pipeline</p>
        </div>
        <Link to={ROUTES.insights} className="section-head__action">
          Insights
        </Link>
      </header>
      <dl className="financial-snapshot__grid">
        <div className="financial-snapshot__row">
          <dt>Collected</dt>
          <dd>{financial.collected}</dd>
        </div>
        <div className="financial-snapshot__row financial-snapshot__row--emphasis">
          <dt>Outstanding</dt>
          <dd>{financial.outstanding}</dd>
        </div>
        <div className="financial-snapshot__row">
          <dt>MTD payments</dt>
          <dd>{financial.mtdCollected}</dd>
        </div>
        <div className="financial-snapshot__row">
          <dt>Proposal exposure</dt>
          <dd>{financial.proposalExposure}</dd>
        </div>
        <div className="financial-snapshot__row">
          <dt>Proposals open</dt>
          <dd>{financial.activeProposals}</dd>
        </div>
        <div className="financial-snapshot__row">
          <dt>Confirmed events</dt>
          <dd>{financial.confirmedUpcoming}</dd>
        </div>
        <div className="financial-snapshot__row">
          <dt>Revenue at risk</dt>
          <dd>{financial.atRiskRevenue}</dd>
        </div>
      </dl>
    </section>
  );
}
