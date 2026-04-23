import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Spinner } from '../components/ui/index.js';
import { useRepScorecards } from '../hooks/useLeadership.js';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function RepScorecards() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const ownerUserId = sp.get('ownerUserId') ?? '';
  const hasOverdueFollowUps = sp.get('hasOverdueFollowUps') === '1' ? 1 : undefined;
  const hasCriticalDeals = sp.get('hasCriticalDeals') === '1' ? 1 : undefined;
  const hasDealsNeedingReview = sp.get('hasDealsNeedingReview') === '1' ? 1 : undefined;
  const { data, isLoading } = useRepScorecards({
    q: q || undefined,
    ownerUserId: ownerUserId || undefined,
    hasOverdueFollowUps,
    hasCriticalDeals,
    hasDealsNeedingReview,
    activeOnly: 1,
    days: 30,
  });

  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (data ?? []).forEach(s => {
      seen.set(s.ownerUserId, s.ownerName ?? s.ownerUserId);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  if (isLoading) {
    return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> <span>Loading…</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rep Scorecards</h1>
          <div className="page-subtitle">Objective execution view by owner for weekly coaching</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1.2fr 1fr auto auto auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="form-label">Search</label>
          <input className="form-input" value={q} onChange={e => setSp(prev => { prev.set('q', e.target.value); return prev; })} placeholder="Rep name or owner ID" />
        </div>
        <div>
          <label className="form-label">Owner</label>
          <select className="form-select" value={ownerUserId} onChange={e => setSp(prev => { if (e.target.value) prev.set('ownerUserId', e.target.value); else prev.delete('ownerUserId'); return prev; })}>
            <option value="">All reps</option>
            {ownerOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasOverdueFollowUps === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasOverdueFollowUps', '1'); else prev.delete('hasOverdueFollowUps'); return prev; })} /> Overdue follow-ups</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasCriticalDeals === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasCriticalDeals', '1'); else prev.delete('hasCriticalDeals'); return prev; })} /> Critical deals</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasDealsNeedingReview === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasDealsNeedingReview', '1'); else prev.delete('hasDealsNeedingReview'); return prev; })} /> Needs review</label>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState message="No scorecards found" sub="Try clearing one or more filters." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.map(s => (
            <div key={s.ownerUserId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 800 }}>{s.ownerName ?? s.ownerUserId}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last interaction age: {s.interactionMetrics.daysSinceLastInteraction ?? '—'}d</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn btn-secondary" to={`/my-work?ownerUserId=${encodeURIComponent(s.ownerUserId)}&overdueOnly=1`}>Overdue Follow-ups</Link>
                  <Link className="btn btn-secondary" to={`/pipeline-pressure?ownerUserId=${encodeURIComponent(s.ownerUserId)}&pressureLevel=critical`}>Critical Deals</Link>
                  <Link className="btn btn-secondary" to={`/forecast-review?ownerUserId=${encodeURIComponent(s.ownerUserId)}&confidence=low`}>Low-Confidence Late Stage</Link>
                  <Link className="btn btn-secondary" to={`/forecast-review?ownerUserId=${encodeURIComponent(s.ownerUserId)}&needsManagementReview=1`}>Needs Review</Link>
                  <Link className="btn btn-secondary" to={`/account-expansion?ownerUserId=${encodeURIComponent(s.ownerUserId)}`}>Account Expansion</Link>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 8 }}>
                <div className="stat-card"><div className="stat-label">Open Deals</div><div className="stat-value">{s.dealMetrics.openDeals}</div></div>
                <div className="stat-card"><div className="stat-label">Stalled</div><div className="stat-value">{s.dealMetrics.stalledDeals}</div></div>
                <div className="stat-card"><div className="stat-label">Overdue Follow-ups</div><div className="stat-value" style={{ color: s.followUpMetrics.overdue ? 'var(--red)' : undefined }}>{s.followUpMetrics.overdue}</div></div>
                <div className="stat-card"><div className="stat-label">Critical / High</div><div className="stat-value">{s.dealMetrics.criticalDeals}/{s.dealMetrics.highPressureDeals}</div></div>
                <div className="stat-card"><div className="stat-label">Commit Amount</div><div className="stat-value">{money(s.forecastMetrics.commitAmount)}</div></div>
                <div className="stat-card"><div className="stat-label">Best Case Amount</div><div className="stat-value">{money(s.forecastMetrics.bestCaseAmount)}</div></div>
                <div className="stat-card"><div className="stat-label">Excluded Amount</div><div className="stat-value">{money(s.forecastMetrics.excludedAmount)}</div></div>
                <div className="stat-card"><div className="stat-label">Needs Review</div><div className="stat-value">{s.forecastMetrics.dealsNeedingManagementReview}</div></div>
                <div className="stat-card"><div className="stat-label">Owned Accounts</div><div className="stat-value">{s.ownerCoverageSummary?.ownedAccounts ?? 0}</div></div>
                <div className="stat-card"><div className="stat-label">Low Penetration Accounts</div><div className="stat-value">{s.ownerCoverageSummary?.lowPenetrationAccounts ?? 0}</div></div>
                <div className="stat-card"><div className="stat-label">Critical Coverage Risk</div><div className="stat-value">{s.ownerCoverageSummary?.criticalCoverageRiskAccounts ?? 0}</div></div>
                <div className="stat-card"><div className="stat-label">Single-Contact Dependency</div><div className="stat-value">{s.ownerCoverageSummary?.accountsWithSingleContactDependency ?? 0}</div></div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {(s.coachingSignals.length === 0 ? ['No immediate coaching alerts; monitor weekly cadence signals.'] : s.coachingSignals).map((signal, i) => (
                  <div key={`${s.ownerUserId}-${i}`} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>- {signal}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
