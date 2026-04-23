import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBuilds, useBuildMutations, useBuildVersions, useBuildChangeOrders, useBuildDiff } from '../hooks/useBuilds.js';
import { useProductionMutations } from '../hooks/useProduction.js';
import { EmptyState, Modal, Spinner } from '../components/ui/index.js';

export default function Builds() {
  const [sp, setSp] = useSearchParams();
  const unitId = sp.get('unitId') ?? '';
  const dealId = sp.get('dealId') ?? '';
  const q = sp.get('q') ?? '';
  const status = sp.get('status') ?? '';
  const marginRiskLevel = sp.get('marginRiskLevel') ?? '';
  const incompleteCosting = sp.get('incompleteCosting') === '1' ? 1 : undefined;
  const incompletePricing = sp.get('incompletePricing') === '1' ? 1 : undefined;
  const hasSubstitutions = sp.get('hasSubstitutions') === '1' ? 1 : undefined;
  const [creating, setCreating] = useState(false);
  const [newSpec, setNewSpec] = useState('');
  const [newName, setNewName] = useState('');
  const [historyBuildId, setHistoryBuildId] = useState<string | null>(null);
  const [fromVersionId, setFromVersionId] = useState<string | null>(null);
  const [toVersionId, setToVersionId] = useState<string | null>(null);
  const { data, isLoading } = useBuilds({
    unitId: unitId || undefined,
    dealId: dealId || undefined,
    q: q || undefined,
    status: status || undefined,
    marginRiskLevel: marginRiskLevel as any,
    incompleteCosting,
    incompletePricing,
    hasSubstitutions,
    limit: 200,
  });
  const mutations = useBuildMutations();
  const { data: versions } = useBuildVersions(historyBuildId);
  const { data: changeOrders } = useBuildChangeOrders(historyBuildId);
  const { data: diff } = useBuildDiff(historyBuildId, fromVersionId, toVersionId);
  const production = useProductionMutations();
  const rows = data?.data ?? [];

  const grouped = useMemo(() => ({
    draft: rows.filter((r: any) => r.status === 'draft'),
    quoted: rows.filter((r: any) => r.status === 'quoted'),
    approved: rows.filter((r: any) => r.status === 'approved'),
    in_production: rows.filter((r: any) => r.status === 'in_production'),
    completed: rows.filter((r: any) => r.status === 'completed'),
  }), [rows]);

  if (isLoading) return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /><span>Loading…</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Builds</h1>
          <div className="page-subtitle">Structured build configurations tied to units and deals</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Create Build</button>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto auto auto', gap: 8, alignItems: 'center' }}>
        <input className="form-input" placeholder="Unit ID" value={unitId} onChange={e => setSp(prev => { if (e.target.value) prev.set('unitId', e.target.value); else prev.delete('unitId'); return prev; })} />
        <input className="form-input" placeholder="Deal ID" value={dealId} onChange={e => setSp(prev => { if (e.target.value) prev.set('dealId', e.target.value); else prev.delete('dealId'); return prev; })} />
        <select className="form-select" value={status} onChange={e => setSp(prev => { if (e.target.value) prev.set('status', e.target.value); else prev.delete('status'); return prev; })}>
          <option value="">Any status</option>
          <option value="draft">draft</option>
          <option value="quoted">quoted</option>
          <option value="approved">approved</option>
          <option value="in_production">in_production</option>
          <option value="completed">completed</option>
        </select>
        <input className="form-input" placeholder="Search name/spec" value={q} onChange={e => setSp(prev => { if (e.target.value) prev.set('q', e.target.value); else prev.delete('q'); return prev; })} />
        <select className="form-select" value={marginRiskLevel} onChange={e => setSp(prev => { if (e.target.value) prev.set('marginRiskLevel', e.target.value); else prev.delete('marginRiskLevel'); return prev; })}>
          <option value="">Any risk</option>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={incompleteCosting === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('incompleteCosting', '1'); else prev.delete('incompleteCosting'); return prev; })} /> Incomplete costing</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={incompletePricing === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('incompletePricing', '1'); else prev.delete('incompletePricing'); return prev; })} /> Incomplete pricing</label>
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={hasSubstitutions === 1} onChange={e => setSp(prev => { if (e.target.checked) prev.set('hasSubstitutions', '1'); else prev.delete('hasSubstitutions'); return prev; })} /> Substitutions</label>
      </div>

      {rows.length === 0 ? <EmptyState message="No builds found" sub="Create a build from a deal, company, or unit." /> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {Object.entries(grouped).map(([k, list]) => (
            <section key={k}>
              <div style={{ fontFamily: 'var(--font-cond)', fontWeight: 800, marginBottom: 6 }}>{k} · {(list as any[]).length}</div>
              <div className="card" style={{ padding: 0 }}>
                {(list as any[]).length === 0 ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text-secondary)' }}>None</div> : (list as any[]).map(b => (
                  <div key={b._id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{b.name ?? 'Unnamed build'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          unit {b.unitId} · {b.dealId ? `deal ${b.dealId}` : 'no linked deal'}
                        </div>
                        <div style={{ fontSize: 12 }}>Spec items: {(b.specItems ?? []).length} · substitutions {(b.buildBomSummary?.substitutionCount ?? 0)}</div>
                        <div style={{ fontSize: 12 }}>
                          Cost {Math.round(b.buildBomSummary?.estimatedCostTotal ?? 0).toLocaleString()} · Sell {Math.round(b.buildBomSummary?.estimatedSellTotal ?? 0).toLocaleString()} · Margin {Math.round(b.buildBomSummary?.estimatedGrossMargin ?? 0).toLocaleString()} ({(b.buildBomSummary?.estimatedGrossMarginPct ?? 0).toFixed(1)}%)
                        </div>
                        <div style={{ fontSize: 12, color: b.buildBomSummary?.marginRiskLevel === 'critical' ? 'var(--red)' : 'var(--text-secondary)' }}>
                          Risk: {b.buildBomSummary?.marginRiskLevel} · missing cost/sell {b.buildBomSummary?.missingCostLines ?? 0}/{b.buildBomSummary?.missingSellLines ?? 0}
                        </div>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>
                          {(b.buildBomSummary?.marginRiskReasons ?? []).slice(0, 2).map((r: string, i: number) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" onClick={() => mutations.update.mutate({ id: b._id, payload: { status: 'in_production' } })}>Move to Production</button>
                        <button className="btn btn-secondary" onClick={() => production.create.mutate({ buildId: b._id, unitId: b.unitId, dealId: b.dealId, assignedTeam: 'Shop Team A' })}>Handoff to Shop</button>
                        <button className="btn btn-secondary" onClick={() => { setHistoryBuildId(b._id); setFromVersionId(null); setToVersionId(null); }}>History</button>
                        <Link className="btn btn-ghost" to={`/units?search=${encodeURIComponent(b.unitId)}`}>Open Unit</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="Create Build" onClose={() => setCreating(false)} width={680}>
          <form onSubmit={async e => {
            e.preventDefault();
            await mutations.create.mutateAsync({
              unitId,
              dealId: dealId || undefined,
              name: newName || undefined,
              status: 'draft',
              specItems: newSpec
                .split('\n')
                .map(x => x.trim())
                .filter(Boolean)
                .map(line => {
                  const [category, description, qty, unitCost, unitSell, partNumber, vendorName] = line.split('|');
                  return {
                    category: category || 'misc',
                    description: description || line,
                    quantity: Math.max(1, Number(qty || '1')),
                    unitCostEstimate: unitCost ? Number(unitCost) : undefined,
                    unitSellPrice: unitSell ? Number(unitSell) : undefined,
                    partNumber: partNumber || undefined,
                    vendorName: vendorName || undefined,
                    costSource: 'manual',
                    pricingSource: 'manual',
                    isStandard: false,
                  };
                }),
            } as any);
            setCreating(false);
            setNewName('');
            setNewSpec('');
          }}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Unit ID *</label>
                <input className="form-input" required value={unitId} onChange={e => setSp(prev => { prev.set('unitId', e.target.value); return prev; })} />
              </div>
              <div className="form-group">
                <label className="form-label">Deal ID</label>
                <input className="form-input" value={dealId} onChange={e => setSp(prev => { if (e.target.value) prev.set('dealId', e.target.value); else prev.delete('dealId'); return prev; })} />
              </div>
              <div className="form-group full">
                <label className="form-label">Build Name</label>
                <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Service Body Build" />
              </div>
              <div className="form-group full">
                <label className="form-label">Spec Items (category|description|qty|unitCost|unitSell|partNumber|vendor)</label>
                <textarea className="form-textarea" rows={7} value={newSpec} onChange={e => setNewSpec(e.target.value)} placeholder="body|48 in service body|1|8000|12000|SB-48|Knapheide&#10;labor|Install & wiring|12|95|165||" />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
              <button type="submit" className="btn btn-primary">Create Build</button>
            </div>
          </form>
        </Modal>
      )}
      {historyBuildId && (
        <Modal title="Build History + Change Orders" onClose={() => setHistoryBuildId(null)} width={920}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Versions</div>
              {(versions?.data ?? []).map((v: any) => (
                <div key={v._id} style={{ borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>v{v.versionNumber} · {v.reason || 'Spec update'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(v.createdAt).toLocaleString()} · {v.createdByName}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button className="btn btn-ghost" onClick={() => setFromVersionId(v._id)}>From</button>
                    <button className="btn btn-ghost" onClick={() => setToVersionId(v._id)}>To</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Version Diff</div>
              {!diff ? <div className="text-muted">Select From/To versions</div> : (
                <>
                  <div style={{ fontSize: 12 }}>Added {diff.addedItems?.length ?? 0} · Removed {diff.removedItems?.length ?? 0} · Modified {diff.modifiedItems?.length ?? 0}</div>
                  <div style={{ fontSize: 12 }}>Cost delta {Math.round(diff.costDelta ?? 0)} · Sell delta {Math.round(diff.sellDelta ?? 0)} · Margin delta {Math.round(diff.marginDelta ?? 0)}</div>
                  <ul style={{ margin: '6px 0 0 16px', fontSize: 12 }}>
                    {(diff.changeSummary ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                  {fromVersionId && toVersionId && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 8 }}
                      onClick={() => mutations.createChangeOrder.mutate({ id: historyBuildId, payload: { fromVersionId, toVersionId, reason: 'Version change request' } })}
                    >
                      Create Change Order
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="card" style={{ gridColumn: '1 / span 2', padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Change Orders</div>
              {(changeOrders?.data ?? []).length === 0 ? <div className="text-muted">No change orders</div> : (changeOrders.data as any[]).map(co => (
                <div key={co._id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{co.reason} · {co.status}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cost {Math.round(co.costDelta ?? 0)} · Sell {Math.round(co.sellDelta ?? 0)} · Margin {Math.round(co.marginDelta ?? 0)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {co.status === 'draft' && <button className="btn btn-secondary" onClick={() => mutations.updateChangeOrder.mutate({ id: co._id, status: 'pending_approval' })}>Submit</button>}
                    {co.status === 'pending_approval' && <button className="btn btn-secondary" onClick={() => mutations.updateChangeOrder.mutate({ id: co._id, status: 'approved' })}>Approve</button>}
                    {co.status === 'pending_approval' && <button className="btn btn-ghost" onClick={() => mutations.updateChangeOrder.mutate({ id: co._id, status: 'rejected' })}>Reject</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
