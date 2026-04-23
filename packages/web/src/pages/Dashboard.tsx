// packages/web/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';
import { KPICard, Spinner, EmptyState } from '../components/ui/index.js';
import { formatCurrency } from '@mtte-core/shared';
import { useAppStore } from '../store/index.js';

/** Roles that can access the dashboard */
const DASHBOARD_ROLES = ['super_admin', 'admin', 'management'] as const;

interface DashboardStats {
  leadsByStatus: Array<{ _id: string; count: number }>;
  dealsByStatus: Array<{ _id: string; count: number; totalAmount: number }>;
  staleLeads:    { total: number; newUntouched: number };
  staleDeals:    { total: number; pendingApproval: number };
  unassignedLeads: number;
  unassignedDeals: number;
  /** Open interactions with followUpAt in the past */
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

/** Ordered deal stages for pipeline display */
const DEAL_STAGE_ORDER = ['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build', 'Delivered', 'Lost'];

function SignalCard({
  label,
  value,
  urgent,
  sub,
}: {
  label:   string;
  value:   number;
  urgent?: boolean;
  sub?:    string;
}) {
  const color = urgent && value > 0 ? 'var(--red)' : value > 0 ? '#d97706' : 'var(--text-light)';
  return (
    <div className="card" style={{ padding: '12px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-cond)', fontSize: 28, fontWeight: 800, color }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAppStore();

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
  });

  const activePipeline = (stats?.dealsByStatus ?? [])
    .filter(s => !['Lost', 'Delivered'].includes(s._id))
    .reduce((n, s) => n + s.totalAmount, 0);

  const totalLeads = (stats?.leadsByStatus ?? []).reduce((n, s) => n + s.count, 0);
  const totalDeals = (stats?.dealsByStatus ?? []).reduce((n, s) => n + s.count, 0);
  const totalUnits = (unitSummary as Array<{ _id: string; count: number; totalMsrp: number }>).reduce((n, s) => n + s.count, 0);
  const availUnits = (unitSummary as Array<{ _id: string; count: number; totalMsrp: number }>).find(s => s._id === 'prospect')?.count ?? 0;

  const orderedDeals = DEAL_STAGE_ORDER
    .map(stage => stats?.dealsByStatus.find(s => s._id === stage))
    .filter((s): s is NonNullable<typeof s> => !!s);

  if (!canAccess) {
    return (
      <div style={{ padding: 60 }}>
        <EmptyState message="Access restricted" sub="Dashboard is available to management and admin roles." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
        <Spinner /> <span className="text-muted">Loading…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">Welcome back, {user?.name}</div>
        </div>
      </div>

      {/* ── Top KPIs ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard label="Active Leads"    value={totalLeads}                    colorVar="--status-new" />
        <KPICard label="Open Deals"      value={totalDeals}                    colorVar="--red" />
        <KPICard label="Pipeline"        value={formatCurrency(activePipeline)} colorVar="--status-approved" />
        <KPICard label="Units Available" value={availUnits}                    colorVar="--status-inbuild" sub={`${totalUnits} total`} />
      </div>

      {/* ── Needs Attention ───────────────────────────────────────── */}
      {stats && (
        <>
          <div style={{ marginBottom: 8, fontFamily: 'var(--font-cond)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)' }}>
            Needs Attention
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24, maxWidth: 900 }}>
            <SignalCard
              label="New — Untouched"
              value={stats.staleLeads.newUntouched}
              urgent
              sub="> 1 day, no touch"
            />
            <SignalCard
              label="Stale Leads"
              value={stats.staleLeads.total}
              sub="past threshold"
            />
            <SignalCard
              label="Pending Approval"
              value={stats.staleDeals.pendingApproval}
              urgent
              sub="> 2 days waiting"
            />
            <SignalCard
              label="Stalled Deals"
              value={stats.staleDeals.total}
              sub="past threshold"
            />
            <SignalCard
              label="Unassigned"
              value={stats.unassignedLeads + stats.unassignedDeals}
              urgent
              sub={`${stats.unassignedLeads}L / ${stats.unassignedDeals}D`}
            />
            {typeof stats.followUpOverdueOpen === 'number' && (
              <SignalCard
                label="Overdue follow-ups"
                value={stats.followUpOverdueOpen}
                urgent
                sub="open + past due"
              />
            )}
            {typeof stats.dueTodayActions === 'number' && (
              <SignalCard label="Due Today Actions" value={stats.dueTodayActions} urgent sub="follow-up workload" />
            )}
            {typeof stats.staleCompanies === 'number' && (
              <SignalCard label="Stale Companies" value={stats.staleCompanies} urgent sub=">14 days no interaction" />
            )}
            {typeof stats.noActivityCompanies === 'number' && (
              <SignalCard label="No Activity Companies" value={stats.noActivityCompanies} sub="never engaged" />
            )}
            {typeof stats.criticalDeals === 'number' && (
              <SignalCard label="Critical Deals" value={stats.criticalDeals} urgent sub="execution critical" />
            )}
            {typeof stats.highPressureDeals === 'number' && (
              <SignalCard label="High Pressure Deals" value={stats.highPressureDeals} urgent sub="management attention" />
            )}
            {typeof stats.stalledDeals === 'number' && (
              <SignalCard label="Stalled Deals" value={stats.stalledDeals} urgent sub="stage/interaction stall" />
            )}
            {typeof stats.dealsWithOverdueFollowUps === 'number' && (
              <SignalCard label="Deals w/ Overdue Follow-ups" value={stats.dealsWithOverdueFollowUps} urgent />
            )}
            {typeof stats.dealsNeedingManagementReview === 'number' && (
              <SignalCard label="Needs Mgmt Review" value={stats.dealsNeedingManagementReview} urgent />
            )}
            {typeof stats.lowConfidenceLateStageDeals === 'number' && (
              <SignalCard label="Low-Conf Late Stage" value={stats.lowConfidenceLateStageDeals} urgent />
            )}
            {typeof stats.accountCoverageCounts?.criticalCoverageRisk === 'number' && (
              <SignalCard label="Critical Coverage Risk Accounts" value={stats.accountCoverageCounts.criticalCoverageRisk} urgent />
            )}
            {typeof stats.accountCoverageCounts?.accountsWithWhitespaceSignals === 'number' && (
              <SignalCard label="Whitespace Accounts" value={stats.accountCoverageCounts.accountsWithWhitespaceSignals} />
            )}
            {typeof stats.accountCoverageCounts?.singleContactDependencyAccounts === 'number' && (
              <SignalCard label="Single-Contact Dependency" value={stats.accountCoverageCounts.singleContactDependencyAccounts} urgent />
            )}
            {typeof stats.accountCoverageCounts?.activeAccountsWithoutOwner === 'number' && (
              <SignalCard label="Active Accounts No Owner" value={stats.accountCoverageCounts.activeAccountsWithoutOwner} urgent />
            )}
            {typeof stats.accountExpansionCounts?.urgentPlanningPriority === 'number' && (
              <SignalCard label="Urgent Expansion Planning" value={stats.accountExpansionCounts.urgentPlanningPriority} urgent />
            )}
            {typeof stats.accountExpansionCounts?.highReadinessWithoutPlan === 'number' && (
              <SignalCard label="High-Readiness No Plan" value={stats.accountExpansionCounts.highReadinessWithoutPlan} urgent />
            )}
            {typeof stats.buildEconomicsCounts?.criticalMarginRiskBuilds === 'number' && (
              <SignalCard label="Critical Margin Risk Builds" value={stats.buildEconomicsCounts.criticalMarginRiskBuilds} urgent />
            )}
            {typeof stats.buildEconomicsCounts?.highMarginRiskBuilds === 'number' && (
              <SignalCard label="High Margin Risk Builds" value={stats.buildEconomicsCounts.highMarginRiskBuilds} urgent />
            )}
            {typeof stats.buildEconomicsCounts?.buildsWithIncompleteCosting === 'number' && (
              <SignalCard label="Builds Incomplete Costing" value={stats.buildEconomicsCounts.buildsWithIncompleteCosting} urgent />
            )}
            {typeof stats.buildEconomicsCounts?.buildsWithSubstitutions === 'number' && (
              <SignalCard label="Builds With Substitutions" value={stats.buildEconomicsCounts.buildsWithSubstitutions} />
            )}
            {typeof stats.changeOrderCounts?.pendingApproval === 'number' && (
              <SignalCard label="Change Orders Pending Approval" value={stats.changeOrderCounts.pendingApproval} urgent />
            )}
            {typeof stats.changeOrderCounts?.buildsWithUnapprovedChanges === 'number' && (
              <SignalCard label="Builds With Unapproved Changes" value={stats.changeOrderCounts.buildsWithUnapprovedChanges} urgent />
            )}
            {typeof stats.productionCounts?.ready === 'number' && (
              <SignalCard label="Production Ready" value={stats.productionCounts.ready} />
            )}
            {typeof stats.productionCounts?.inProgress === 'number' && (
              <SignalCard label="Production In Progress" value={stats.productionCounts.inProgress} />
            )}
            {typeof stats.productionCounts?.paused === 'number' && (
              <SignalCard label="Production Paused" value={stats.productionCounts.paused} urgent />
            )}
            {typeof stats.productionCounts?.jobsWithChangeConflicts === 'number' && (
              <SignalCard label="Production Change Conflicts" value={stats.productionCounts.jobsWithChangeConflicts} urgent />
            )}
            {typeof stats.shopExecutionCounts?.activeJobs === 'number' && (
              <SignalCard label="Shop Active Jobs" value={stats.shopExecutionCounts.activeJobs} />
            )}
            {typeof stats.shopExecutionCounts?.blockedJobs === 'number' && (
              <SignalCard label="Shop Blocked Jobs" value={stats.shopExecutionCounts.blockedJobs} urgent />
            )}
            {typeof stats.shopExecutionCounts?.jobsWithNoStartedTasks === 'number' && (
              <SignalCard label="Jobs With No Started Tasks" value={stats.shopExecutionCounts.jobsWithNoStartedTasks} urgent />
            )}
            {typeof stats.shopExecutionCounts?.jobsNearCompletion === 'number' && (
              <SignalCard label="Jobs Near Completion" value={stats.shopExecutionCounts.jobsNearCompletion} />
            )}
            {typeof stats.deliveryCounts?.readyForDelivery === 'number' && (
              <SignalCard label="Ready For Delivery" value={stats.deliveryCounts.readyForDelivery} />
            )}
            {typeof stats.deliveryCounts?.scheduled === 'number' && (
              <SignalCard label="Delivery Scheduled" value={stats.deliveryCounts.scheduled} />
            )}
            {typeof stats.deliveryCounts?.notReadyWithCompletedProduction === 'number' && (
              <SignalCard label="Completed But Not Delivery-Ready" value={stats.deliveryCounts.notReadyWithCompletedProduction} urgent />
            )}
            {typeof stats.deliveryHandoffCounts?.deliveredWithoutIssuedPacket === 'number' && (
              <SignalCard label="Delivered — Packet Not Issued" value={stats.deliveryHandoffCounts.deliveredWithoutIssuedPacket} urgent />
            )}
            {typeof stats.deliveryHandoffCounts?.overduePostDeliveryFollowUps === 'number' && (
              <SignalCard label="Overdue Post-Delivery Follow-ups" value={stats.deliveryHandoffCounts.overduePostDeliveryFollowUps} urgent />
            )}
            {typeof stats.deliveryHandoffCounts?.pendingPostDeliveryFollowUps === 'number' && (
              <SignalCard label="Pending Post-Delivery Follow-ups" value={stats.deliveryHandoffCounts.pendingPostDeliveryFollowUps} />
            )}
            {typeof stats.deliveryHandoffCounts?.packetsIssued === 'number' && (
              <SignalCard label="Packets Issued" value={stats.deliveryHandoffCounts.packetsIssued} />
            )}
          </div>
          {stats.forecastAmounts && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 20, maxWidth: 780 }}>
              <KPICard label="Commit Amount" value={formatCurrency(stats.forecastAmounts.commit ?? 0)} colorVar="--status-won" />
              <KPICard label="Best Case Amount" value={formatCurrency(stats.forecastAmounts.best_case ?? 0)} colorVar="--status-approved" />
              <KPICard label="Excluded Amount" value={formatCurrency(stats.forecastAmounts.excluded ?? 0)} colorVar="--status-lost" />
            </div>
          )}
          {!!stats.ownerBreakdown?.length && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>
                Owner Breakdown
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Open Deals</th>
                    <th>Critical</th>
                    <th>Overdue Follow-ups</th>
                    <th>Commit</th>
                    <th>Best Case</th>
                    <th>Excluded</th>
                    <th>Needs Review</th>
                    <th>Low Penetration</th>
                    <th>Critical Coverage Risk</th>
                    <th>Urgent Planning</th>
                    <th>No Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ownerBreakdown.map(r => (
                    <tr key={r.ownerUserId}>
                      <td>{r.ownerName ?? r.ownerUserId}</td>
                      <td>{r.openDeals}</td>
                      <td>{r.criticalDeals}</td>
                      <td>{r.overdueFollowUps}</td>
                      <td>{formatCurrency(r.commitAmount)}</td>
                      <td>{formatCurrency(r.bestCaseAmount)}</td>
                      <td>{formatCurrency(r.excludedAmount)}</td>
                      <td>{r.dealsNeedingManagementReview}</td>
                      <td>{r.ownerCoverageSummary?.lowPenetrationAccounts ?? 0}</td>
                      <td>{r.ownerCoverageSummary?.criticalCoverageRiskAccounts ?? 0}</td>
                      <td>{r.ownerExpansionSummary?.urgentPlanningAccounts ?? 0}</td>
                      <td>{r.ownerExpansionSummary?.accountsWithoutPlan ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Lead Funnel + Deal Pipeline ───────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>
                Lead Funnel
              </div>
              <table className="data-table">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {stats.leadsByStatus.sort((a, b) => b.count - a.count).map(row => (
                    <tr key={row._id}>
                      <td><span className={`badge badge-${row._id.toLowerCase().replace(/\s+/g, '')}`}>{row._id}</span></td>
                      <td style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, fontSize: 18 }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>
                Deal Pipeline
              </div>
              <table className="data-table">
                <thead><tr><th>Stage</th><th>Deals</th><th>Value</th></tr></thead>
                <tbody>
                  {orderedDeals.map(row => (
                    <tr key={row._id}>
                      <td><span className={`badge badge-${row._id.toLowerCase().replace(/\s+/g, '')}`}>{row._id}</span></td>
                      <td style={{ fontFamily: 'var(--font-cond)', fontWeight: 700 }}>{row.count}</td>
                      <td style={{ fontFamily: 'var(--font-cond)', fontWeight: 600, color: 'var(--red)' }}>{formatCurrency(row.totalAmount)}</td>
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

