import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForecastReview, useDealMutations } from '../hooks/useDeals.js';
import { EmptyState, Spinner } from '../components/ui/index.js';
import { formatCurrency } from '@mtte-core/shared';

type Row = {
  _id: string;
  title: string;
  company: string;
  assignedTo?: string;
  status: string;
  amount: number;
  atRisk?: { flagged: boolean };
  dealExecutionState?: {
    pressureLevel: 'critical' | 'high' | 'medium' | 'low';
    daysSinceLastInteraction?: number;
    openFollowUps: number;
    overdueFollowUps: number;
  };
  forecastState?: {
    confidence: 'low' | 'medium' | 'high';
    forecastCategory: 'commit' | 'best_case' | 'pipeline' | 'excluded';
    confidenceReasons: string[];
    reviewReasons: string[];
    needsManagementReview: boolean;
  };
  managementReview?: {
    status?: 'approved' | 'challenged' | 'watch';
    reviewedAt?: string;
    reviewedByName?: string;
    notes?: string;
  };
};

export default function ForecastReview() {
  const [sp, setSp] = useSearchParams();
  const [filters, setFilters] = useState({
    ownerUserId: sp.get('ownerUserId') ?? '',
    stage: sp.get('stage') ?? '',
    confidence: sp.get('confidence') ?? '',
    forecastCategory: sp.get('forecastCategory') ?? '',
    needsManagementReview: sp.get('needsManagementReview') ?? '1',
    q: sp.get('q') ?? '',
  });
  const { data, isLoading, refetch } = useForecastReview({
    ownerUserId: filters.ownerUserId || undefined,
    stage: filters.stage || undefined,
    confidence: (filters.confidence || undefined) as never,
    forecastCategory: (filters.forecastCategory || undefined) as never,
    needsManagementReview: filters.needsManagementReview === '' ? undefined : (filters.needsManagementReview === '1' ? 1 : 0),
    q: filters.q || undefined,
    limit: 200,
  });
  const grouped = (data?.grouped ?? {}) as Record<string, Row[]>;
  const { update } = useDealMutations();

  if (isLoading) return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /><span>Loading…</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Forecast Review</h1>
          <div className="page-subtitle">Management challenge queue for forecast confidence discipline</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <input className="form-input" placeholder="Owner user ID" value={filters.ownerUserId} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, ownerUserId: v })); setSp(prev => { if (v) prev.set('ownerUserId', v); else prev.delete('ownerUserId'); return prev; }); }} />
        <input className="form-input" placeholder="Stage" value={filters.stage} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, stage: v })); setSp(prev => { if (v) prev.set('stage', v); else prev.delete('stage'); return prev; }); }} />
        <select className="form-select" value={filters.confidence} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, confidence: v })); setSp(prev => { if (v) prev.set('confidence', v); else prev.delete('confidence'); return prev; }); }}>
          <option value="">Any confidence</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
        </select>
        <select className="form-select" value={filters.forecastCategory} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, forecastCategory: v })); setSp(prev => { if (v) prev.set('forecastCategory', v); else prev.delete('forecastCategory'); return prev; }); }}>
          <option value="">Any category</option><option value="commit">commit</option><option value="best_case">best_case</option><option value="pipeline">pipeline</option><option value="excluded">excluded</option>
        </select>
        <select className="form-select" value={filters.needsManagementReview} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, needsManagementReview: v })); setSp(prev => { if (v) prev.set('needsManagementReview', v); else prev.delete('needsManagementReview'); return prev; }); }}>
          <option value="">Review any</option><option value="1">Needs review</option><option value="0">Reviewed/Not needed</option>
        </select>
        <input className="form-input" placeholder="Search deal/company/owner" value={filters.q} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, q: v })); setSp(prev => { if (v) prev.set('q', v); else prev.delete('q'); return prev; }); }} />
      </div>

      {['needsReview', 'lowConfidence', 'commit', 'bestCase'].every(k => (grouped[k] ?? []).length === 0) ? (
        <EmptyState message="No forecast review rows" />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            { key: 'needsReview', title: 'Needs Review' },
            { key: 'lowConfidence', title: 'Low Confidence' },
            { key: 'commit', title: 'Commit' },
            { key: 'bestCase', title: 'Best Case' },
          ].map(section => (
            <section key={section.key}>
              <div style={{ fontFamily: 'var(--font-cond)', fontWeight: 800, marginBottom: 6 }}>{section.title} · {(grouped[section.key] ?? []).length}</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {(grouped[section.key] ?? []).length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: 'var(--text-secondary)' }}>None</div>
                ) : (grouped[section.key] ?? []).map(r => (
                  <div key={r._id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.company} · {r.assignedTo ?? 'unassigned'} · {r.status}</div>
                        <div style={{ fontSize: 12 }}>{formatCurrency(r.amount ?? 0)} · confidence {r.forecastState?.confidence} · {r.forecastState?.forecastCategory}</div>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>
                          {(r.forecastState?.confidenceReasons ?? []).map((x, i) => <li key={`c-${i}`}>{x}</li>)}
                        </ul>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>
                          {(r.forecastState?.reviewReasons ?? []).map((x, i) => <li key={`r-${i}`}>{x}</li>)}
                        </ul>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12 }}>Pressure: {r.dealExecutionState?.pressureLevel ?? '—'}</div>
                        <div style={{ fontSize: 12 }}>Last interaction: {r.dealExecutionState?.daysSinceLastInteraction ?? '—'}d</div>
                        <div style={{ fontSize: 12 }}>Open/Overdue: {r.dealExecutionState?.openFollowUps ?? 0}/{r.dealExecutionState?.overdueFollowUps ?? 0}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => update.mutate({ id: r._id, data: { managementReview: { status: 'approved' } } as never }, { onSuccess: () => void refetch() })}>Approve Forecast</button>
                          <button className="btn btn-secondary" onClick={() => update.mutate({ id: r._id, data: { managementReview: { status: 'watch' } } as never }, { onSuccess: () => void refetch() })}>Mark Watch</button>
                          <button className="btn btn-ghost" onClick={() => update.mutate({ id: r._id, data: { managementReview: { status: 'challenged' } } as never }, { onSuccess: () => void refetch() })}>Challenge Deal</button>
                        </div>
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
