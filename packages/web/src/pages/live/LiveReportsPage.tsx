import { useMemo } from 'react';
import { formatCurrency } from '@hub-crm/shared';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell, StatusCell } from '../../components/live/LiveModuleTable.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { buildLiveReportSummary } from '../../lib/liveEventHelpers.js';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="monthly-scorecard__cell">
      <div className="monthly-scorecard__label">{label}</div>
      <div className="monthly-scorecard__value">{value}</div>
    </div>
  );
}

export default function LiveReportsPage() {
  const { rows, isLoading, isError } = useLiveCrmEvents();
  const report = useMemo(() => buildLiveReportSummary(rows), [rows]);

  if (isLoading) return <LoadingState message="Loading reports…" />;

  return (
    <div className="hub-reports-page hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Reports</h1>
          <p className="hub-admin-page__subtitle">
            Pipeline and financial summaries from your live event data.
          </p>
        </div>
        <span className="hub-admin-stat-pill">{rows.length} events</span>
      </header>

      {isError ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load reports</p>
        </div>
      ) : (
        <>
          <section className="hub-reports-section">
            <h2>Pipeline overview</h2>
            <div className="card monthly-scorecard">
              <div className="monthly-scorecard__grid">
                <StatCard label="Active events" value={String(report.activeCount)} />
                <StatCard label="Active pipeline value" value={formatCurrency(report.activePipelineValue)} />
                <StatCard label="Balance due total" value={formatCurrency(report.balanceDueTotal)} />
                <StatCard
                  label="Payments collected"
                  value={formatCurrency(report.paymentsCollected)}
                />
                <StatCard
                  label="Proposal sent"
                  value={String(report.metrics.find(m => m.id === 'proposal_sent')?.count ?? 0)}
                />
                <StatCard
                  label="Confirmed"
                  value={String(report.metrics.find(m => m.id === 'confirmed')?.count ?? 0)}
                />
                <StatCard
                  label="Completed YTD"
                  value={String(report.metrics.find(m => m.id === 'completed_ytd')?.count ?? 0)}
                />
              </div>
            </div>
          </section>

          <section className="hub-reports-section">
            <h2>Events by status</h2>
            <LiveModuleTable
              rows={report.byStatus}
              rowKey={r => r.label}
              emptyTitle="No status data"
              columns={[
                { key: 'status', header: 'Status', render: r => r.label },
                {
                  key: 'count',
                  header: 'Count',
                  className: 'crm-events-table__col--num',
                  render: r => r.count,
                },
                {
                  key: 'value',
                  header: 'Value',
                  className: 'crm-events-table__col--num',
                  render: r => <MoneyCell amount={r.value} />,
                },
              ]}
            />
          </section>

          <section className="hub-reports-section">
            <h2>Upcoming events by month</h2>
            <LiveModuleTable
              rows={report.upcomingByMonth}
              rowKey={r => r.month}
              emptyTitle="No upcoming dated events"
              columns={[
                { key: 'month', header: 'Month', render: r => r.month },
                {
                  key: 'count',
                  header: 'Events',
                  className: 'crm-events-table__col--num',
                  render: r => r.count,
                },
                {
                  key: 'value',
                  header: 'Value',
                  className: 'crm-events-table__col--num',
                  render: r => <MoneyCell amount={r.value} />,
                },
              ]}
            />
          </section>

          <section className="hub-reports-section">
            <h2>Balance due</h2>
            <LiveModuleTable
              rows={report.balanceDueRows}
              rowKey={r => r.id}
              emptyTitle="No balance-due events"
              columns={[
                {
                  key: 'event',
                  header: 'Event',
                  render: r => <EventLink href={r.href} title={r.title} subtitle={r.contact} />,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: r => <StatusCell label={r.statusLabel} status={r.status} />,
                },
                {
                  key: 'value',
                  header: 'Value',
                  className: 'crm-events-table__col--num',
                  render: r => <MoneyCell amount={r.value} />,
                },
                {
                  key: 'balance',
                  header: 'Balance due',
                  className: 'crm-events-table__col--num',
                  render: r => <MoneyCell amount={r.balanceDue ?? 0} />,
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
