import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import { buildDashboardViewModel } from '../data/buildDashboardViewModel.js';
import AttentionQueue from '../components/command/AttentionQueue.js';
import DashboardSnapshotBand from '../components/dashboard/DashboardSnapshotBand.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import { countPendingApprovals, useDemoOpsStore } from '../state/demoOpsStore.js';
import { useMarketingBlastsStore } from '../store/marketingBlastsStore.js';

export default function Dashboard() {
  const approvals = useDemoOpsStore(s => s.approvals);
  const pending = countPendingApprovals(approvals);
  const draftCount = useMarketingBlastsStore(s => s.drafts.length);

  const model = useMemo(
    () => buildDashboardViewModel({ pendingApprovals: pending }),
    [pending],
  );

  const attentionPreview = model.attention.slice(0, 5);

  return (
    <div className="dashboard-simple command-page">
      <DemoFlowNav />

      {/* Band A — Command summary */}
      <section className="dashboard-band dashboard-band--summary" aria-label="Command summary">
        <div className="dashboard-summary">
          <div className="dashboard-summary__copy">
            <p className="dashboard-summary__eyebrow">{model.asOfLabel}</p>
            <h1 className="dashboard-summary__title">What needs attention</h1>
            <p className="dashboard-summary__hint">{model.suggestedAction}</p>
          </div>
          <div className="dashboard-summary__stats">
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Outstanding</span>
              <span className="dashboard-summary-stat__value">{model.financial.outstanding}</span>
            </div>
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Upcoming events</span>
              <span className="dashboard-summary-stat__value">{model.financial.confirmedUpcoming}</span>
            </div>
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Open proposals</span>
              <span className="dashboard-summary-stat__value">{model.financial.activeProposals}</span>
            </div>
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Collected</span>
              <span className="dashboard-summary-stat__value">{model.financial.collected}</span>
            </div>
          </div>
          <Link to={ROUTES.today} className="btn btn-primary dashboard-summary__cta">
            Open today command center
          </Link>
        </div>
      </section>

      {/* Band B — Work queues */}
      <section className="dashboard-band dashboard-band--queues" aria-label="Work queues">
        <div className="dashboard-queues-grid">
          <AttentionQueue items={attentionPreview} totalSignals={model.totalPressureSignals} />
          <div className="dashboard-queue-card card">
            <header className="section-head">
              <div>
                <h2 className="section-head__title">Events & finalization</h2>
                <p className="section-head__sub">Confirmed events needing prep or balance review.</p>
              </div>
              <Link to={ROUTES.opportunities} className="section-head__action">
                View events
              </Link>
            </header>
            {model.pressureRows.length === 0 ? (
              <p className="dashboard-queue-card__empty">No events flagged right now.</p>
            ) : (
              <ul className="dashboard-mini-list">
                {model.pressureRows.slice(0, 4).map(row => (
                  <li key={row.id}>
                    <Link to={row.href ?? ROUTES.opportunities}>
                      <strong>{row.title}</strong>
                      <span>{row.meta}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="dashboard-queue-card card">
            <header className="section-head">
              <div>
                <h2 className="section-head__title">Marketing drafts</h2>
                <p className="section-head__sub">Draft campaigns — sending not enabled yet.</p>
              </div>
              <Link to={ROUTES.marketing} className="section-head__action">
                Open marketing
              </Link>
            </header>
            <p className="dashboard-queue-card__stat">
              {draftCount === 0 ? 'No drafts yet.' : `${draftCount} draft${draftCount === 1 ? '' : 's'} ready for review`}
            </p>
          </div>
        </div>
      </section>

      {/* Band C — Snapshot */}
      <DashboardSnapshotBand />
    </div>
  );
}
