import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Spinner } from '../components/ui/index.js';
import { useAccountExpansion, useAccountPlanMutations } from '../hooks/useAccountExpansion.js';

export default function AccountExpansion() {
  const [sp, setSp] = useSearchParams();
  const ownerUserId = sp.get('ownerUserId') ?? '';
  const expansionReadiness = sp.get('expansionReadiness') ?? '';
  const planningPriority = sp.get('planningPriority') ?? '';
  const hasPlan = sp.get('hasPlan') === '1' ? 1 : undefined;
  const hasOpenPipeline = sp.get('hasOpenPipeline') === '1' ? 1 : undefined;
  const hasBlockers = sp.get('hasBlockers') === '1' ? 1 : undefined;
  const q = sp.get('q') ?? '';
  const { data, isLoading } = useAccountExpansion({
    ownerUserId: ownerUserId || undefined,
    expansionReadiness: (expansionReadiness || undefined) as any,
    planningPriority: (planningPriority || undefined) as any,
    hasPlan,
    hasOpenPipeline,
    hasBlockers,
    q: q || undefined,
  });
  const planMutations = useAccountPlanMutations();

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach(r => {
      const id = r.accountPenetrationState.assignedOwnerUserId;
      if (!id) return;
      map.set(id, r.accountPenetrationState.assignedOwnerName ?? id);
    });
    return Array.from(map.entries());
  }, [data]);

  if (isLoading) {
    return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> <span>Loading…</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Expansion</h1>
          <div className="page-subtitle">Expansion readiness and lightweight account planning workflow</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 200px 180px 180px auto auto auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="form-label">Search</label>
          <input className="form-input" value={q} onChange={e => setSp(prev => { if (e.target.value) prev.set('q', e.target.value); else prev.delete('q'); return prev; })} placeholder="Company or owner" />
        </div>
        <div>
          <label className="form-label">Owner</label>
          <select className="form-select" value={ownerUserId} onChange={e => setSp(prev => { if (e.target.value) prev.set('ownerUserId', e.target.value); else prev.delete('ownerUserId'); return prev; })}>
            <option value="">All owners</option>
            {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Readiness</label>
          <select className="form-select" value={expansionReadiness} onChange={e => setSp(prev => { if (e.target.value) prev.set('expansionReadiness', e.target.value); else prev.delete('expansionReadiness'); return prev; })}>
            <option value="">Any</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
        </div>
        <div>
          <label className="form-label">Planning Priority</label>
          <select className="form-select" value={planningPriority} onChange={e => setSp(prev => { if (e.target.value) prev.set('planningPriority', e.target.value); else prev.delete('planningPriority'); return prev; })}>
            <option value="">Any</option><option value="urgent">urgent</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
        </div>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasPlan === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasPlan', '1'); else prev.delete('hasPlan'); return prev; })} /> Has plan</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasOpenPipeline === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasOpenPipeline', '1'); else prev.delete('hasOpenPipeline'); return prev; })} /> Has open pipeline</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasBlockers === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasBlockers', '1'); else prev.delete('hasBlockers'); return prev; })} /> Has blockers</label>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState message="No account expansion rows" sub="Try adjusting filters." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.map(r => (
            <div key={r.companyId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{r.companyName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Owner: {r.accountPenetrationState.assignedOwnerName ?? 'unassigned'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Link className="btn btn-secondary" to={`/companies/${r.companyId}`}>Open</Link>
                  <Link className="btn btn-secondary" to={`/account-coverage?ownerUserId=${encodeURIComponent(r.accountPenetrationState.assignedOwnerUserId ?? '')}`}>Coverage</Link>
                  <Link className="btn btn-secondary" to={`/deals?search=${encodeURIComponent(r.companyName)}`}>Deals</Link>
                  <Link className="btn btn-secondary" to={`/forecast-review?q=${encodeURIComponent(r.companyName)}`}>Forecast</Link>
                  <Link className="btn btn-secondary" to={`/weekly-cadence?ownerUserId=${encodeURIComponent(r.accountPenetrationState.assignedOwnerUserId ?? '')}`}>Weekly Cadence</Link>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 8 }}>
                <div className="stat-card"><div className="stat-label">Readiness</div><div className="stat-value">{r.accountExpansionState.expansionReadiness}</div></div>
                <div className="stat-card"><div className="stat-label">Priority</div><div className="stat-value">{r.accountExpansionState.planningPriority}</div></div>
                <div className="stat-card"><div className="stat-label">Penetration</div><div className="stat-value">{r.accountPenetrationState.penetrationLevel}</div></div>
                <div className="stat-card"><div className="stat-label">Coverage Risk</div><div className="stat-value">{r.accountPenetrationState.coverageRiskLevel}</div></div>
                <div className="stat-card"><div className="stat-label">Last Activity</div><div className="stat-value">{r.accountPenetrationState.daysSinceLastInteraction ?? '—'}d</div></div>
                <div className="stat-card"><div className="stat-label">Contacts 30/90</div><div className="stat-value">{r.accountPenetrationState.uniqueContacts30d}/{r.accountPenetrationState.uniqueContacts90d}</div></div>
                <div className="stat-card"><div className="stat-label">Open/Active Pipeline</div><div className="stat-value">{r.accountPenetrationState.openDeals}/{r.accountPenetrationState.activeDeals}</div></div>
                <div className="stat-card"><div className="stat-label">Plan</div><div className="stat-value">{r.hasPlan ? (r.accountPlanStatus ?? 'yes') : 'none'}</div></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {(r.accountExpansionState.opportunitySignals ?? []).slice(0, 3).map((x, i) => <div key={`o-${i}`}>- {x}</div>)}
                {(r.accountExpansionState.blockers ?? []).slice(0, 3).map((x, i) => <div key={`b-${i}`} style={{ color: 'var(--red)' }}>- {x}</div>)}
              </div>
              {r.accountPlanId && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Link className="btn btn-secondary" to={`/companies/${r.companyId}?plan=1`}>Edit Plan</Link>
                  <button className="btn btn-secondary" onClick={() => planMutations.update.mutate({ id: r.accountPlanId!, payload: { status: 'active' } })}>Mark Active</button>
                  <button className="btn btn-secondary" onClick={() => planMutations.update.mutate({ id: r.accountPlanId!, payload: { status: 'paused' } })}>Mark Paused</button>
                  <button className="btn btn-ghost" onClick={() => planMutations.update.mutate({ id: r.accountPlanId!, payload: { status: 'completed' } })}>Mark Completed</button>
                </div>
              )}
              {!r.accountPlanId && (
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      planMutations.create.mutate({
                        companyId: r.companyId,
                        companyName: r.companyName,
                        ownerUserId: r.accountPenetrationState.assignedOwnerUserId,
                        ownerName: r.accountPenetrationState.assignedOwnerName,
                        status: 'draft',
                        objectives: [],
                        opportunities: [],
                        risks: [],
                        nextSteps: [],
                      })
                    }
                  >
                    Create Plan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
