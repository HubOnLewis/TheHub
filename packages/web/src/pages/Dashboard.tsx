// packages/web/src/pages/Dashboard.tsx
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';
import { KPICard, EmptyState } from '../components/ui/index.js';
import { MetricHeroCard } from '../components/ui/MetricHeroCard.js';
import { DashboardSkeleton } from '../components/ui/Skeleton.js';
import { formatCurrency } from '@mtte-core/shared';
import { useAppStore } from '../store/index.js';

const DASHBOARD_ROLES = ['super_admin', 'admin', 'management'] as const;

interface DashboardStats {
  leadsByStatus: Array<{ _id: string; count: number }>;
  dealsByStatus: Array<{ _id: string; count: number; totalAmount: number }>;
  staleLeads:    { total: number; newUntouched: number };
  staleDeals:    { total: number; pendingApproval: number };
  unassignedLeads: number;
  unassignedDeals: number;
  followUpOverdueOpen?: number;
  overdueActions?: number;
  dueTodayActions?: number;
  staleCompanies?: number;
  noActivityCompanies?: number;
  criticalDeals?: number;
  highPressureDeals?: number;
  stalledDeals?: number;
  dealsWithoutRecentActivity?: number;
  dealsWithOverdueFollowUps?: number;
  dealPressureCounts?: { critical: number; high: number; medium: number; low: number };
  forecastCounts?: { commit: number; best_case: number; pipeline: number; excluded: number };
  forecastAmounts?: { commit: number; best_case: number; pipeline: number; excluded: number };
  dealsNeedingManagementReview?: number;
  lowConfidenceLateStageDeals?: number;
  commitAmount?: number;
  bestCaseAmount?: number;
  excludedAmount?: number;
  ownerBreakdown?: Array<{
    ownerUserId: string;
    ownerName?: string;
    openDeals: number;
    criticalDeals: number;
    overdueFollowUps: number;
    commitAmount: number;
    bestCaseAmount: number;
    excludedAmount: number;
    dealsNeedingManagementReview: number;
    ownerCoverageSummary?: {
      ownedAccounts: number;
      activeAccounts30d: number;
      inactiveAccounts90d: number;
      lowPenetrationAccounts: number;
      criticalCoverageRiskAccounts: number;
      accountsWithSingleContactDependency: number;
    };
    ownerExpansionSummary?: {
      highReadinessAccounts: number;
      urgentPlanningAccounts: number;
      accountsWithoutPlan: number;
    };
  }>;
  accountCoverageCounts?: {
    lowPenetration: number;
    mediumPenetration: number;
    highPenetration: number;
    criticalCoverageRisk: number;
    highCoverageRisk: number;
    accountsWithWhitespaceSignals: number;
    singleContactDependencyAccounts: number;
    activeAccountsWithoutOwner: number;
  };
  accountExpansionCounts?: {
    highReadiness: number;
    mediumReadiness: number;
    lowReadiness: number;
    urgentPlanningPriority: number;
    highPlanningPriority: number;
    accountsWithoutPlan: number;
    highReadinessWithoutPlan: number;
  };
  buildEconomicsCounts?: {
    quotedBuilds: number;
    approvedBuilds: number;
    buildsWithIncompleteCosting: number;
    buildsWithIncompletePricing: number;
    highMarginRiskBuilds: number;
    criticalMarginRiskBuilds: number;
    buildsWithSubstitutions: number;
  };
  changeOrderCounts?: {
    pendingApproval: number;
    approvedRecently: number;
    rejected: number;
    buildsWithUnapprovedChanges: number;
  };
  productionCounts?: {
    queued: number;
    ready: number;
    inProgress: number;
    paused: number;
    completed: number;
    jobsWithChangeConflicts: number;
  };
  shopExecutionCounts?: {
    activeJobs: number;
    blockedJobs: number;
    jobsWithNoStartedTasks: number;
    jobsNearCompletion: number;
  };
  deliveryCounts?: {
    pending: number;
    readyForDelivery: number;
    scheduled: number;
    delivered: number;
    closed: number;
    notReadyWithCompletedProduction: number;
  };
  deliveryHandoffCounts?: {
    packetsDraft: number;
    packetsReady: number;
    packetsIssued: number;
    deliveredWithoutIssuedPacket: number;
    pendingPostDeliveryFollowUps: number;
    overduePostDeliveryFollowUps: number;
  };
}

const DEAL_STAGE_ORDER = ['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build', 'Delivered', 'Lost'];

type BoardItem = { key: string; label: string; value: number; sub?: string };

function pushIfPositive(arr: BoardItem[], key: string, label: string, value: number | undefined, sub?: string) {
  if (typeof value !== 'number' || value <= 0) return;
  arr.push({ key, label, value, sub });
}

function buildAttentionBoard(s: DashboardStats): {
  critical: BoardItem[];
  warning: BoardItem[];
  operational: BoardItem[];
  secondary: BoardItem[];
} {
  const critical: BoardItem[] = [];
  const warning: BoardItem[] = [];
  const operational: BoardItem[] = [];
  const secondary: BoardItem[] = [];

  pushIfPositive(critical, 'nu', 'New leads untouched', s.staleLeads?.newUntouched, '>1d no touch');
  pushIfPositive(critical, 'pa', 'Deals pending approval', s.staleDeals?.pendingApproval, '>2d waiting');
  const unassigned = (s.unassignedLeads ?? 0) + (s.unassignedDeals ?? 0);
  pushIfPositive(critical, 'un', 'Unassigned leads + deals', unassigned, `${s.unassignedLeads ?? 0}L / ${s.unassignedDeals ?? 0}D`);
  pushIfPositive(critical, 'fo', 'Overdue open follow-ups', s.followUpOverdueOpen, 'open + past due');
  pushIfPositive(critical, 'dt', 'Actions due today', s.dueTodayActions, 'follow-up workload');
  pushIfPositive(critical, 'sc', 'Stale companies', s.staleCompanies, '>14d no interaction');
  pushIfPositive(critical, 'cd', 'Critical deals', s.criticalDeals, 'execution');
  pushIfPositive(critical, 'df', 'Deals w/ overdue follow-ups', s.dealsWithOverdueFollowUps);
  pushIfPositive(critical, 'mr', 'Deals needing mgmt review', s.dealsNeedingManagementReview);
  pushIfPositive(critical, 'lc', 'Low-confidence late stage', s.lowConfidenceLateStageDeals);
  pushIfPositive(critical, 'cc', 'Critical coverage risk accounts', s.accountCoverageCounts?.criticalCoverageRisk);
  pushIfPositive(critical, 'sd', 'Single-contact dependency', s.accountCoverageCounts?.singleContactDependencyAccounts);
  pushIfPositive(critical, 'ao', 'Active accounts without owner', s.accountCoverageCounts?.activeAccountsWithoutOwner);
  pushIfPositive(critical, 'up', 'Urgent expansion planning', s.accountExpansionCounts?.urgentPlanningPriority);
  pushIfPositive(critical, 'hr', 'High-readiness, no plan', s.accountExpansionCounts?.highReadinessWithoutPlan);
  pushIfPositive(critical, 'cm', 'Critical margin risk builds', s.buildEconomicsCounts?.criticalMarginRiskBuilds);
  pushIfPositive(critical, 'ic', 'Builds incomplete costing', s.buildEconomicsCounts?.buildsWithIncompleteCosting);
  pushIfPositive(critical, 'co', 'Change orders pending approval', s.changeOrderCounts?.pendingApproval);
  pushIfPositive(critical, 'bu', 'Builds w/ unapproved changes', s.changeOrderCounts?.buildsWithUnapprovedChanges);
  pushIfPositive(critical, 'pp', 'Production paused', s.productionCounts?.paused);
  pushIfPositive(critical, 'jc', 'Production change conflicts', s.productionCounts?.jobsWithChangeConflicts);
  pushIfPositive(critical, 'bj', 'Shop blocked jobs', s.shopExecutionCounts?.blockedJobs);
  pushIfPositive(critical, 'ns', 'Jobs with no started tasks', s.shopExecutionCounts?.jobsWithNoStartedTasks);
  pushIfPositive(critical, 'nr', 'Completed prod, not delivery-ready', s.deliveryCounts?.notReadyWithCompletedProduction);
  pushIfPositive(critical, 'dp', 'Delivered — packet not issued', s.deliveryHandoffCounts?.deliveredWithoutIssuedPacket);
  pushIfPositive(critical, 'op', 'Overdue post-delivery follow-ups', s.deliveryHandoffCounts?.overduePostDeliveryFollowUps);

  pushIfPositive(warning, 'sl', 'Stale leads (total)', s.staleLeads?.total, 'past threshold');
  pushIfPositive(warning, 'st', 'Stalled deals', s.stalledDeals, 'stage / interaction');
  pushIfPositive(warning, 'sd2', 'Stale deals (total)', s.staleDeals?.total, 'past threshold');
  pushIfPositive(warning, 'hp', 'High-pressure deals', s.highPressureDeals);
  pushIfPositive(warning, 'na', 'No-activity companies', s.noActivityCompanies);
  pushIfPositive(warning, 'ws', 'Whitespace signal accounts', s.accountCoverageCounts?.accountsWithWhitespaceSignals);
  pushIfPositive(warning, 'hm', 'High margin risk builds', s.buildEconomicsCounts?.highMarginRiskBuilds);
  pushIfPositive(warning, 'ip', 'Builds incomplete pricing', s.buildEconomicsCounts?.buildsWithIncompletePricing);
  pushIfPositive(warning, 'sub', 'Builds with substitutions', s.buildEconomicsCounts?.buildsWithSubstitutions);
  pushIfPositive(warning, 'oa', 'Overdue actions (all)', s.overdueActions);
  pushIfPositive(warning, 'hcr', 'High coverage risk accounts', s.accountCoverageCounts?.highCoverageRisk);
  pushIfPositive(warning, 'hpp', 'High expansion planning priority', s.accountExpansionCounts?.highPlanningPriority);

  pushIfPositive(operational, 'pq', 'Production queued', s.productionCounts?.queued);
  pushIfPositive(operational, 'pr', 'Production ready', s.productionCounts?.ready);
  pushIfPositive(operational, 'pi', 'Production in progress', s.productionCounts?.inProgress);
  pushIfPositive(operational, 'pc', 'Production completed', s.productionCounts?.completed);
  pushIfPositive(operational, 'aj', 'Shop active jobs', s.shopExecutionCounts?.activeJobs);
  pushIfPositive(operational, 'jn', 'Jobs near completion', s.shopExecutionCounts?.jobsNearCompletion);
  pushIfPositive(operational, 'dpn', 'Delivery pending', s.deliveryCounts?.pending);
  pushIfPositive(operational, 'dr', 'Ready for delivery', s.deliveryCounts?.readyForDelivery);
  pushIfPositive(operational, 'ds', 'Delivery scheduled', s.deliveryCounts?.scheduled);
  pushIfPositive(operational, 'dd', 'Delivered', s.deliveryCounts?.delivered);
  pushIfPositive(operational, 'dc', 'Delivery closed', s.deliveryCounts?.closed);
  pushIfPositive(operational, 'pkd', 'Packets — draft', s.deliveryHandoffCounts?.packetsDraft);
  pushIfPositive(operational, 'pkr', 'Packets — ready', s.deliveryHandoffCounts?.packetsReady);
  pushIfPositive(operational, 'pki', 'Packets — issued', s.deliveryHandoffCounts?.packetsIssued);
  pushIfPositive(operational, 'pf', 'Pending post-delivery follow-ups', s.deliveryHandoffCounts?.pendingPostDeliveryFollowUps);

  if (s.forecastCounts) {
    pushIfPositive(secondary, 'fc', 'Forecast — commit deals', s.forecastCounts.commit);
    pushIfPositive(secondary, 'fb', 'Forecast — best case', s.forecastCounts.best_case);
    pushIfPositive(secondary, 'fp', 'Forecast — pipeline', s.forecastCounts.pipeline);
    pushIfPositive(secondary, 'fx', 'Forecast — excluded', s.forecastCounts.excluded);
  }
  if (s.dealPressureCounts) {
    pushIfPositive(secondary, 'dpm', 'Pressure — medium', s.dealPressureCounts.medium);
    pushIfPositive(secondary, 'dpl', 'Pressure — low', s.dealPressureCounts.low);
  }
  pushIfPositive(secondary, 'lp', 'Low penetration accounts', s.accountCoverageCounts?.lowPenetration);
  pushIfPositive(secondary, 'mp', 'Medium penetration accounts', s.accountCoverageCounts?.mediumPenetration);
  pushIfPositive(secondary, 'hq', 'High penetration accounts', s.accountCoverageCounts?.highPenetration);
  pushIfPositive(secondary, 'qb', 'Quoted builds', s.buildEconomicsCounts?.quotedBuilds);
  pushIfPositive(secondary, 'ab', 'Approved builds', s.buildEconomicsCounts?.approvedBuilds);

  return { critical, warning, operational, secondary };
}

function AttentionBand({
  variant,
  title,
  items,
}: {
  variant: 'critical' | 'warning' | 'info';
  title: string;
  items: BoardItem[];
}) {
  const band = variant === 'critical' ? 'attention-band--critical' : variant === 'warning' ? 'attention-band--warning' : 'attention-band--info';
  const metric = variant === 'critical' ? 'attention-metric--critical' : variant === 'warning' ? 'attention-metric--warning' : 'attention-metric--info';
  return (
    <section className={`attention-band ${band}`}>
      <div className="attention-band__header">{title}</div>
      <div className="attention-band__body">
        {items.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '8px 4px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
            Nothing flagged here — good momentum.
          </div>
        ) : (
          items.map(it => (
            <div key={it.key} className={`attention-metric ${metric}`}>
              <div className="attention-metric__label">{it.label}</div>
              <div className="attention-metric__value">{it.value}</div>
              {it.sub && <div className="attention-metric__sub">{it.sub}</div>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

const Ico = {
  pipeline: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  deals: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>,
  units: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4.93 4.93h.01M19.07 19.07h.01M2 12h2m16 0h2M4.93 19.07h.01M19.07 4.93h.01" /></svg>,
  risk: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 9v4M12 17h.01M10.3 3h3.4L22 18H2L10.3 3z" /></svg>,
};

export default function Dashboard() {
  const { user } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const canAccess = DASHBOARD_ROLES.includes(user?.role as never);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn:  () => client.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    staleTime: 60_000,
    enabled:   canAccess,
  });

  const { data: unitSummary = [] } = useQuery({
    queryKey: ['units', 'summary'],
    queryFn:  () => client.get<Array<{ _id: string; count: number; totalMsrp: number }>>('/units/summary').then(r => r.data),
    staleTime: 30_000,
    enabled:   canAccess,
  });

  const activePipeline = (stats?.dealsByStatus ?? [])
    .filter(x => !['Lost', 'Delivered'].includes(x._id))
    .reduce((n, x) => n + x.totalAmount, 0);

  const openDealsCount = useMemo(
    () => (stats?.dealsByStatus ?? [])
      .filter(x => !['Lost', 'Delivered'].includes(x._id))
      .reduce((n, x) => n + x.count, 0),
    [stats?.dealsByStatus],
  );

  const unitsInShop = useMemo(() => {
    if (!stats) return 0;
    const shop = stats.shopExecutionCounts?.activeJobs;
    if (typeof shop === 'number' && shop > 0) return shop;
    return (stats.productionCounts?.inProgress ?? 0) + (stats.productionCounts?.ready ?? 0);
  }, [stats]);

  const revenueAtRisk = stats?.excludedAmount ?? stats?.forecastAmounts?.excluded ?? 0;

  const availUnits = (unitSummary as Array<{ _id: string; count: number }>).find(x => x._id === 'prospect')?.count ?? 0;
  const totalUnits = (unitSummary as Array<{ _id: string; count: number }>).reduce((n, x) => n + x.count, 0);

  const orderedDeals = DEAL_STAGE_ORDER
    .map(stage => stats?.dealsByStatus.find(x => x._id === stage))
    .filter((x): x is NonNullable<typeof x> => !!x);

  const board = useMemo(() => (stats ? buildAttentionBoard(stats) : null), [stats]);

  if (!canAccess) {
    return (
      <div style={{ padding: 60 }}>
        <EmptyState message="Access restricted" sub="Dashboard is available to management and admin roles." />
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Command center</h1>
          <div className="page-subtitle">
            What matters right now — pipeline health, execution risk, and operational flow. Welcome back, {user?.name}.
          </div>
        </div>
      </div>

      <div className="metric-hero-grid">
        <MetricHeroCard
          label="Pipeline value"
          value={formatCurrency(activePipeline)}
          sub="Open deal stages (excl. won/delivered/lost)"
          icon={Ico.pipeline}
          accent="success"
        />
        <MetricHeroCard
          label="Open deals"
          value={openDealsCount}
          sub="Active opportunities in pipeline"
          icon={Ico.deals}
          accent="info"
        />
        <MetricHeroCard
          label="Units in motion"
          value={unitsInShop}
          sub="Shop active jobs, or in-progress + ready"
          icon={Ico.units}
          accent="info"
        />
        <MetricHeroCard
          label="Revenue at risk"
          value={formatCurrency(revenueAtRisk)}
          sub="Excluded from forecast"
          icon={Ico.risk}
          accent={revenueAtRisk > 0 ? 'danger' : 'success'}
        />
      </div>
      {canAccess && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -10, marginBottom: 26, maxWidth: 720 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{availUnits}</strong> prospect units available ·{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{totalUnits}</strong> units on file
        </p>
      )}

      {stats && board && (
        <>
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-cond)', fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Needs attention
            </h2>
          </div>
          <div className="attention-stack">
            <AttentionBand variant="critical" title="Critical — act today" items={board.critical} />
            <AttentionBand variant="warning" title="Warning — review this week" items={board.warning} />
            <AttentionBand variant="info" title="Operational signals" items={board.operational} />
          </div>

          {board.secondary.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <button type="button" className="expand-toggle" onClick={() => setMoreOpen(o => !o)}>
                {moreOpen ? '▼ Hide secondary metrics' : '▸ Show secondary metrics'} ({board.secondary.length})
              </button>
              {moreOpen && (
                <div className="attention-band attention-band--info" style={{ marginTop: 12 }}>
                  <div className="attention-band__body">
                    {board.secondary.map(it => (
                      <div key={it.key} className="attention-metric attention-metric--info">
                        <div className="attention-metric__label">{it.label}</div>
                        <div className="attention-metric__value">{it.value}</div>
                        {it.sub && <div className="attention-metric__sub">{it.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {stats.forecastAmounts && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              <KPICard label="Commit amount" value={formatCurrency(stats.forecastAmounts.commit ?? 0)} colorVar="--green" />
              <KPICard label="Best case" value={formatCurrency(stats.forecastAmounts.best_case ?? 0)} colorVar="--blue" />
              <KPICard label="Excluded" value={formatCurrency(stats.forecastAmounts.excluded ?? 0)} colorVar="--amber" />
            </div>
          )}

          {!!stats.ownerBreakdown?.length && (
            <div className="card" style={{ marginBottom: 28, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 17, fontWeight: 800 }}>
                Owner breakdown
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Open</th>
                      <th>Critical</th>
                      <th>Overdue F/U</th>
                      <th>Commit</th>
                      <th>Best case</th>
                      <th>Excluded</th>
                      <th>Review</th>
                      <th>Low pen.</th>
                      <th>Crit. cov.</th>
                      <th>Urgent plan</th>
                      <th>No plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.ownerBreakdown.map(r => (
                      <tr key={r.ownerUserId}>
                        <td className="table-company">{r.ownerName ?? r.ownerUserId}</td>
                        <td className="table-num">{r.openDeals}</td>
                        <td className="table-num">{r.criticalDeals}</td>
                        <td className="table-num">{r.overdueFollowUps}</td>
                        <td className="table-num">{formatCurrency(r.commitAmount)}</td>
                        <td className="table-num">{formatCurrency(r.bestCaseAmount)}</td>
                        <td className="table-num">{formatCurrency(r.excludedAmount)}</td>
                        <td className="table-num">{r.dealsNeedingManagementReview}</td>
                        <td className="table-num">{r.ownerCoverageSummary?.lowPenetrationAccounts ?? 0}</td>
                        <td className="table-num">{r.ownerCoverageSummary?.criticalCoverageRiskAccounts ?? 0}</td>
                        <td className="table-num">{r.ownerExpansionSummary?.urgentPlanningAccounts ?? 0}</td>
                        <td className="table-num">{r.ownerExpansionSummary?.accountsWithoutPlan ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22 }}>
            <div className="card">
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 17, fontWeight: 800 }}>
                Lead funnel
              </div>
              <table className="data-table">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {stats.leadsByStatus.slice().sort((a, b) => b.count - a.count).map(row => (
                    <tr key={row._id}>
                      <td><span className={`badge badge-${row._id.toLowerCase().replace(/\s+/g, '')}`}>{row._id}</span></td>
                      <td className="table-num" style={{ fontSize: 20 }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 17, fontWeight: 800 }}>
                Deal pipeline
              </div>
              <table className="data-table">
                <thead><tr><th>Stage</th><th>Deals</th><th>Value</th></tr></thead>
                <tbody>
                  {orderedDeals.map(row => (
                    <tr key={row._id}>
                      <td><span className={`badge badge-${row._id.toLowerCase().replace(/\s+/g, '')}`}>{row._id}</span></td>
                      <td className="table-num">{row.count}</td>
                      <td className="table-num" style={{ color: 'var(--red)' }}>{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
