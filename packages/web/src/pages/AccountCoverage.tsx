import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Spinner } from '../components/ui/index.js';
import { HUB_LABELS } from '@hub-crm/shared';
import { accountDetailPath } from '../config/paths.js';
import { useAccountCoverage } from '../hooks/useAccountCoverage.js';

export default function AccountCoverage() {
  const [sp, setSp] = useSearchParams();
  const ownerUserId = sp.get('ownerUserId') ?? '';
  const penetrationLevel = sp.get('penetrationLevel') ?? '';
  const coverageRiskLevel = sp.get('coverageRiskLevel') ?? '';
  const hasOpenDeals = sp.get('hasOpenDeals') === '1' ? 1 : undefined;
  const hasOverdueFollowUps = sp.get('hasOverdueFollowUps') === '1' ? 1 : undefined;
  const hasWhitespace = sp.get('hasWhitespace') === '1' ? 1 : undefined;
  const q = sp.get('q') ?? '';

  const { data, isLoading } = useAccountCoverage({
    ownerUserId: ownerUserId || undefined,
    penetrationLevel: (penetrationLevel || undefined) as any,
    coverageRiskLevel: (coverageRiskLevel || undefined) as any,
    hasOpenDeals,
    hasOverdueFollowUps,
    hasWhitespace,
    q: q || undefined,
  });

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach(r => {
      const id = r.accountPenetrationState.assignedOwnerUserId;
      if (!id) return;
      m.set(id, r.accountPenetrationState.assignedOwnerName ?? id);
    });
    return Array.from(m.entries());
  }, [data]);

  if (isLoading) {
    return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> <span>Loading…</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Coverage</h1>
          <div className="page-subtitle">Relationship depth, coverage risk, and whitespace visibility by account</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 200px 180px 180px auto auto auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="form-label">Search</label>
          <input className="form-input" value={q} onChange={e => setSp(prev => { if (e.target.value) prev.set('q', e.target.value); else prev.delete('q'); return prev; })} placeholder="Account or owner" />
        </div>
        <div>
          <label className="form-label">Owner</label>
          <select className="form-select" value={ownerUserId} onChange={e => setSp(prev => { if (e.target.value) prev.set('ownerUserId', e.target.value); else prev.delete('ownerUserId'); return prev; })}>
            <option value="">All owners</option>
            {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Penetration</label>
          <select className="form-select" value={penetrationLevel} onChange={e => setSp(prev => { if (e.target.value) prev.set('penetrationLevel', e.target.value); else prev.delete('penetrationLevel'); return prev; })}>
            <option value="">Any</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
          </select>
        </div>
        <div>
          <label className="form-label">Coverage risk</label>
          <select className="form-select" value={coverageRiskLevel} onChange={e => setSp(prev => { if (e.target.value) prev.set('coverageRiskLevel', e.target.value); else prev.delete('coverageRiskLevel'); return prev; })}>
            <option value="">Any</option><option value="critical">critical</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
        </div>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasOpenDeals === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasOpenDeals', '1'); else prev.delete('hasOpenDeals'); return prev; })} /> Open {HUB_LABELS.opportunities.toLowerCase()}</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasOverdueFollowUps === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasOverdueFollowUps', '1'); else prev.delete('hasOverdueFollowUps'); return prev; })} /> Overdue follow-ups</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasWhitespace === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasWhitespace', '1'); else prev.delete('hasWhitespace'); return prev; })} /> Whitespace</label>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState message="No account coverage rows" sub="Adjust filters to see more accounts." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.map(r => (
            <div key={r.companyId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{r.companyName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Owner: {r.accountPenetrationState.assignedOwnerName ?? 'unassigned'}
                  </div>
                </div>
                <Link className="btn btn-secondary" to={accountDetailPath(r.companyId)}>Open {HUB_LABELS.account}</Link>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 8 }}>
                <div className="stat-card"><div className="stat-label">Penetration</div><div className="stat-value">{r.accountPenetrationState.penetrationLevel}</div></div>
                <div className="stat-card"><div className="stat-label">Coverage Risk</div><div className="stat-value">{r.accountPenetrationState.coverageRiskLevel}</div></div>
                <div className="stat-card"><div className="stat-label">Last Interaction</div><div className="stat-value">{r.accountPenetrationState.daysSinceLastInteraction ?? '—'}d</div></div>
                <div className="stat-card"><div className="stat-label">Contacts 30/90</div><div className="stat-value">{r.accountPenetrationState.uniqueContacts30d}/{r.accountPenetrationState.uniqueContacts90d}</div></div>
                <div className="stat-card"><div className="stat-label">Open / active opportunities</div><div className="stat-value">{r.accountPenetrationState.openDeals}/{r.accountPenetrationState.activeDeals}</div></div>
                <div className="stat-card"><div className="stat-label">Stalled/Critical</div><div className="stat-value">{r.accountPenetrationState.stalledDeals}/{r.accountPenetrationState.criticalDeals}</div></div>
                <div className="stat-card"><div className="stat-label">Follow-ups O/OD</div><div className="stat-value">{r.accountPenetrationState.openFollowUps}/{r.accountPenetrationState.overdueFollowUps}</div></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                {(r.accountPenetrationState.whitespaceSignals ?? []).slice(0, 3).map((s, i) => <div key={i}>- {s}</div>)}
                {(r.accountCoverageWarnings ?? []).slice(0, 2).map((s, i) => <div key={`w-${i}`} style={{ color: 'var(--red)' }}>- {s}</div>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
