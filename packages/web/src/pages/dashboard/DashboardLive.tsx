import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import AttentionQueue from '../../components/command/AttentionQueue.js';
import DashboardSnapshotBand from '../../components/dashboard/DashboardSnapshotBand.js';
import { Spinner } from '../../components/ui/index.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
import ImportedSourceNote from '../../components/live/ImportedSourceNote.js';
import { useDashboardStats } from '../../hooks/useDashboard.js';
import { useLeads } from '../../hooks/useLeads.js';
import { useDeals } from '../../hooks/useDeals.js';
import { formatTodayLabel } from '../../config/productionData.js';
import { buildImportedDashboardViewModel } from '../../lib/buildImportedDashboardViewModel.js';
import { hasImportedVenueRecords } from '../../lib/operationalSource.js';
import {
  buildLiveAttentionItems,
  buildLiveFinancialSnapshot,
  buildLiveSuggestedAction,
  mapDealToOperationalRow,
} from '../../lib/liveDataMappers.js';

function countFromStats(rows: Array<{ count: number }> | undefined): number {
  return (rows ?? []).reduce((n, r) => n + r.count, 0);
}

export default function DashboardLive() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: leadsPage, isLoading: leadsLoading } = useLeads({
    active: true,
    limit: 25,
    sort: 'updatedAt',
    order: 'desc',
  });
  const { data: dealsPage, isLoading: dealsLoading } = useDeals({
    active: true,
    limit: 8,
    sort: 'updatedAt',
    order: 'desc',
  });

  const leadRows = (leadsPage?.data ?? []) as Array<Record<string, unknown>>;
  const dealRows = (dealsPage?.data ?? []) as Array<Record<string, unknown>>;
  const leadTotal = leadsPage?.total ?? leadRows.length;
  const dealTotal = dealsPage?.total ?? dealRows.length;

  const statsLeadCount = countFromStats(stats?.leadsByStatus);
  const statsDealCount = countFromStats(stats?.dealsByStatus);
  const hasApiRecords = leadTotal > 0 || dealTotal > 0 || statsLeadCount > 0 || statsDealCount > 0;

  const importedModel = useMemo(() => buildImportedDashboardViewModel(), []);

  const financial = useMemo(() => buildLiveFinancialSnapshot(stats), [stats]);
  const attention = useMemo(() => buildLiveAttentionItems(stats), [stats]);
  const attentionPreview = attention.slice(0, 5);
  const pressureRows = useMemo(() => dealRows.map(mapDealToOperationalRow), [dealRows]);
  const suggestedAction = useMemo(
    () => buildLiveSuggestedAction(stats, leadTotal, dealTotal),
    [stats, leadTotal, dealTotal],
  );
  const totalSignals = attention.length + (stats?.highPressureDeals ?? 0);

  const loading = statsLoading || leadsLoading || dealsLoading;

  if (loading) {
    return (
      <div className="dashboard-simple command-page">
        <div style={{ padding: 40, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Spinner /> <span className="text-muted">Loading operational data…</span>
        </div>
      </div>
    );
  }

  if (!hasApiRecords && hasImportedVenueRecords()) {
    const model = importedModel;
    const attentionImported = model.attention.slice(0, 5);

    return (
      <div className="dashboard-simple command-page">
        <section className="dashboard-band dashboard-band--summary" aria-label="Command summary">
          <div className="dashboard-summary">
            <div className="dashboard-summary__copy">
              <p className="dashboard-summary__eyebrow">{model.asOfLabel}</p>
              <ImportedSourceNote style={{ marginTop: 6, marginBottom: 4 }} />
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
            <Link to={ROUTES.opportunities} className="btn btn-primary dashboard-summary__cta">
              View events
            </Link>
          </div>
        </section>

        <section className="dashboard-band dashboard-band--queues" aria-label="Work queues">
          <div className="dashboard-queues-grid">
            <AttentionQueue items={attentionImported} totalSignals={model.totalPressureSignals} />
            <div className="dashboard-queue-card card">
              <header className="section-head">
                <div>
                  <h2 className="section-head__title">Events & finalization</h2>
                  <p className="section-head__sub">Imported operational records — not live-synced.</p>
                </div>
                <Link to={ROUTES.opportunities} className="section-head__action">
                  View events
                </Link>
              </header>
              {model.pressureRows.length === 0 ? (
                <LiveEmptyState />
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
                  <h2 className="section-head__title">Open leads</h2>
                  <p className="section-head__sub">Imported inquiry queue.</p>
                </div>
                <Link to={ROUTES.leads} className="section-head__action">
                  View leads
                </Link>
              </header>
              <p className="dashboard-queue-card__stat">
                {model.financial.activeProposals} open proposals in import
              </p>
            </div>
          </div>
        </section>

        <DashboardSnapshotBand />
      </div>
    );
  }

  if (!hasApiRecords) {
    return (
      <div className="dashboard-simple command-page">
        <section className="dashboard-band dashboard-band--summary" aria-label="Command summary">
          <div className="dashboard-summary">
            <div className="dashboard-summary__copy">
              <p className="dashboard-summary__eyebrow">{formatTodayLabel()}</p>
              <h1 className="dashboard-summary__title">What needs attention</h1>
              <LiveEmptyState />
            </div>
          </div>
        </section>
        <DashboardSnapshotBand />
      </div>
    );
  }

  return (
    <div className="dashboard-simple command-page">
      <section className="dashboard-band dashboard-band--summary" aria-label="Command summary">
        <div className="dashboard-summary">
          <div className="dashboard-summary__copy">
            <p className="dashboard-summary__eyebrow">{formatTodayLabel()}</p>
            <h1 className="dashboard-summary__title">What needs attention</h1>
            <p className="dashboard-summary__hint">{suggestedAction}</p>
          </div>
          <div className="dashboard-summary__stats">
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Outstanding</span>
              <span className="dashboard-summary-stat__value">{financial.outstanding}</span>
            </div>
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Upcoming events</span>
              <span className="dashboard-summary-stat__value">{financial.confirmedUpcoming}</span>
            </div>
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Open proposals</span>
              <span className="dashboard-summary-stat__value">{financial.activeProposals}</span>
            </div>
            <div className="dashboard-summary-stat">
              <span className="dashboard-summary-stat__label">Collected</span>
              <span className="dashboard-summary-stat__value">{financial.collected}</span>
            </div>
          </div>
          <Link to={ROUTES.leads} className="btn btn-primary dashboard-summary__cta">
            Open leads queue
          </Link>
        </div>
      </section>

      <section className="dashboard-band dashboard-band--queues" aria-label="Work queues">
        <div className="dashboard-queues-grid">
          <AttentionQueue items={attentionPreview} totalSignals={totalSignals} />
          <div className="dashboard-queue-card card">
            <header className="section-head">
              <div>
                <h2 className="section-head__title">Events & finalization</h2>
                <p className="section-head__sub">Active events from CRM records.</p>
              </div>
              <Link to={ROUTES.opportunities} className="section-head__action">
                View events
              </Link>
            </header>
            {pressureRows.length === 0 ? (
              <LiveEmptyState />
            ) : (
              <ul className="dashboard-mini-list">
                {pressureRows.slice(0, 4).map(row => (
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
                <h2 className="section-head__title">Open leads</h2>
                <p className="section-head__sub">Inquiries waiting in the queue.</p>
              </div>
              <Link to={ROUTES.leads} className="section-head__action">
                View leads
              </Link>
            </header>
            {leadTotal === 0 ? (
              <LiveEmptyState />
            ) : (
              <p className="dashboard-queue-card__stat">
                {leadTotal} open lead{leadTotal === 1 ? '' : 's'} in CRM
              </p>
            )}
          </div>
        </div>
      </section>

      <DashboardSnapshotBand />
    </div>
  );
}