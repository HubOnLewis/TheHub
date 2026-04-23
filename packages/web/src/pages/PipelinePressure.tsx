import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePipelinePressure } from '../hooks/useDeals.js';
import { EmptyState, Spinner } from '../components/ui/index.js';
import { formatCurrency } from '@mtte-core/shared';

type Row = {
  _id: string;
  title: string;
  company: string;
  assignedTo?: string;
  status: string;
  amount: number;
  dealExecutionState?: {
    pressureLevel: 'critical' | 'high' | 'medium' | 'low';
    pressureReasons: string[];
    daysSinceLastInteraction?: number;
    openFollowUps: number;
    overdueFollowUps: number;
  };
  atRisk?: { flagged: boolean };
};

export default function PipelinePressure() {
  const [sp, setSp] = useSearchParams();
  const [filters, setFilters] = useState({
    ownerUserId: sp.get('ownerUserId') ?? '',
    stage: sp.get('stage') ?? '',
    pressureLevel: sp.get('pressureLevel') ?? '',
    q: sp.get('q') ?? '',
    companyId: sp.get('companyId') ?? '',
  });
  const { data, isLoading } = usePipelinePressure({
    ownerUserId: filters.ownerUserId || undefined,
    stage: filters.stage || undefined,
    pressureLevel: (filters.pressureLevel || undefined) as never,
    q: filters.q || undefined,
    companyId: filters.companyId || undefined,
    limit: 200,
  });
  const grouped = (data?.grouped ?? {}) as Record<string, Row[]>;

  if (isLoading) return <div style={{ padding: 60, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}><Spinner /><span>Loading…</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline Pressure</h1>
          <div className="page-subtitle">Management view of execution risk across open deals</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <input className="form-input" placeholder="Owner user ID" value={filters.ownerUserId} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, ownerUserId: v })); setSp(prev => { if (v) prev.set('ownerUserId', v); else prev.delete('ownerUserId'); return prev; }); }} />
        <input className="form-input" placeholder="Stage" value={filters.stage} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, stage: v })); setSp(prev => { if (v) prev.set('stage', v); else prev.delete('stage'); return prev; }); }} />
        <select className="form-select" value={filters.pressureLevel} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, pressureLevel: v })); setSp(prev => { if (v) prev.set('pressureLevel', v); else prev.delete('pressureLevel'); return prev; }); }}>
          <option value="">Any pressure</option><option value="critical">critical</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
        </select>
        <input className="form-input" placeholder="Search deal/company/owner" value={filters.q} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, q: v })); setSp(prev => { if (v) prev.set('q', v); else prev.delete('q'); return prev; }); }} />
      </div>

      {['critical', 'high', 'medium', 'low'].every(k => (grouped[k] ?? []).length === 0) ? (
        <EmptyState message="No deals match filters" />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {(['critical', 'high', 'medium', 'low'] as const).map(level => (
            <section key={level}>
              <div style={{ fontFamily: 'var(--font-cond)', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>{level} · {(grouped[level] ?? []).length}</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {(grouped[level] ?? []).length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: 'var(--text-secondary)' }}>None</div>
                ) : (grouped[level] ?? []).map(r => (
                  <div key={r._id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.title} {r.atRisk?.flagged ? <span className="badge" style={{ background: '#7c3aed' }}>at risk</span> : null}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.company} · {r.status} · {r.assignedTo ?? 'unassigned'}</div>
                        <div style={{ fontSize: 12 }}>{formatCurrency(r.amount ?? 0)}</div>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>
                          {(r.dealExecutionState?.pressureReasons ?? []).map((reason, i) => <li key={i}>{reason}</li>)}
                        </ul>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12 }}>Last interaction age: {r.dealExecutionState?.daysSinceLastInteraction ?? '—'}d</div>
                        <div style={{ fontSize: 12 }}>Open/Overdue: {r.dealExecutionState?.openFollowUps ?? 0}/{r.dealExecutionState?.overdueFollowUps ?? 0}</div>
                        <Link to="/deals" className="btn btn-ghost" style={{ marginTop: 6, textDecoration: 'none' }}>Open</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
