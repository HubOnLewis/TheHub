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
  const availUnits = (unitSummary as Array<{ _id: string; count: number; totalMsrp: number }>).find(s => s._id === 'Available')?.count ?? 0;

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
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
          </div>

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

