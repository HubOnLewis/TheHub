import { useMemo, useState } from 'react';
import { HUB_LABELS } from '@hub-crm/shared';
import { useProductionJobs, useProductionJob, useProductionMutations } from '../hooks/useProduction.js';
import { useCloseoutChecklist, useDeliveryMutations } from '../hooks/useDelivery.js';
import { EmptyState, Modal, Spinner, StatusBadge, TableSkeleton } from '../components/ui/index.js';

export default function Production() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useProductionJobs({ status: (status || undefined) as any, q: q || undefined, limit: 200 });
  const { data: selected } = useProductionJob(selectedId);
  const { data: closeout } = useCloseoutChecklist(selectedId);
  const mutations = useProductionMutations();
  const delivery = useDeliveryMutations();
  const rows = data?.data ?? [];
  const grouped = useMemo(() => ({
    ready: rows.filter((r: any) => r.status === 'ready'),
    in_progress: rows.filter((r: any) => r.status === 'in_progress'),
    paused: rows.filter((r: any) => r.status === 'paused'),
    completed: rows.filter((r: any) => r.status === 'completed'),
  }), [rows]);

  if (isLoading) return <div className="card" style={{ padding: 24 }}><TableSkeleton rows={6} /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{HUB_LABELS.fulfillment}</h1>
          <div className="page-subtitle">Workflow jobs from approved proposal versions</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="queued">queued</option><option value="ready">ready</option><option value="in_progress">in_progress</option><option value="paused">paused</option><option value="completed">completed</option>
        </select>
        <input className="form-input" placeholder="Search team/notes/job#" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {rows.length === 0 ? <EmptyState message={`No ${HUB_LABELS.fulfillment.toLowerCase()} jobs`} sub="Create jobs from approved proposals when this path is enabled." /> : (
        <div style={{ display: 'grid', gap: 18 }}>
          {Object.entries(grouped).map(([k, list]) => (
            <section key={k}>
              <div className="list-section-title">{k.replace(/_/g, ' ')} · {(list as any[]).length}</div>
              <div className="card list-card">
                {(list as any[]).length === 0 ? <div style={{ padding: 16, fontSize: 13, color: 'var(--text-secondary)' }}>None</div> : (list as any[]).map(j => (
                  <div key={j._id} className="list-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div style={{ flex: '1 1 260px' }}>
                        <div className="list-row__title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {j.build?.name ?? HUB_LABELS.proposal} · {j.unit?.year ?? ''} {j.unit?.make ?? ''} {j.unit?.model ?? ''}
                          <StatusBadge domain="production" value={String(j.status ?? '')}>{String(j.status ?? '').replace(/_/g, ' ')}</StatusBadge>
                        </div>
                        <div className="list-row__meta">job {j.jobNumber ?? j._id.slice(0, 8)} · team {j.assignedTeam ?? 'unassigned'}</div>
                        <div className="list-row__meta">frozen version {j.buildVersionId}</div>
                        <div className="list-row__meta">
                          progress {(j.productionProgressSummary?.percentComplete ?? 0)}% · blocked {j.productionProgressSummary?.blockedTasks ?? 0} · in-progress {j.productionProgressSummary?.inProgressTasks ?? 0}
                        </div>
                        {j.delivery && (
                          <div className="list-row__meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            <span>{HUB_LABELS.closeout}</span>
                            <StatusBadge domain="delivery" value={String(j.delivery.status ?? '')}>{String(j.delivery.status ?? '').replace(/_/g, ' ')}</StatusBadge>
                            <span style={{ color: 'var(--text-light)', fontSize: 11 }}>readiness {j.delivery.deliveryReadiness?.readinessLevel ?? '—'}</span>
                          </div>
                        )}
                        {j.productionImpact?.hasImpact && <div className="list-row__meta" style={{ color: 'var(--red)', marginTop: 6 }}>{j.productionImpact.reasons.join(' · ')}</div>}
                      </div>
                      <div className="list-row__actions">
                        <button className="btn btn-secondary" onClick={() => setSelectedId(j._id)}>Open job</button>
                        {j.status !== 'completed' && <button className="btn btn-secondary" onClick={() => mutations.update.mutate({ id: j._id, payload: { status: j.status === 'queued' ? 'ready' : j.status === 'ready' ? 'in_progress' : j.status === 'in_progress' ? 'completed' : 'in_progress' } })}>Advance</button>}
                        {j.status !== 'paused' && j.status !== 'completed' && <button className="btn btn-ghost" onClick={() => mutations.update.mutate({ id: j._id, payload: { status: 'paused' } })}>Pause</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {selectedId && (
        <Modal title={`${HUB_LABELS.fulfillment} job`} onClose={() => setSelectedId(null)} width={900}>
          {!selected ? <Spinner /> : (
            <div>
              <div className="card" style={{ padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{HUB_LABELS.booking}</div>
                <div style={{ fontSize: 12 }}>{selected.unit?.year ?? ''} {selected.unit?.make ?? ''} {selected.unit?.model ?? ''}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Reference {selected.unit?.vin || '—'} · Stock {selected.unit?.stockNumber || 'n/a'}</div>
                <div style={{ fontSize: 12 }}>Team {selected.assignedTeam ?? 'unassigned'} · Status {selected.status}</div>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Frozen Spec Snapshot</div>
                {(selected.frozenVersion?.specItems ?? []).length === 0 ? <div className="text-muted">No frozen spec lines</div> : (
                  <table className="data-table">
                    <thead><tr><th>Category</th><th>Description</th><th>Qty</th><th>Part</th><th>Notes</th></tr></thead>
                    <tbody>
                      {(selected.frozenVersion?.specItems ?? []).map((s: any, i: number) => (
                        <tr key={s.id ?? i}><td>{s.category}</td><td>{s.description}</td><td>{s.quantity}</td><td>{s.partNumber ?? '—'}</td><td>{s.notes ?? '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="card" style={{ padding: 12, marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Task Board</div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  Progress {(selected.productionProgressSummary?.percentComplete ?? 0)}% · risk {selected.productionProgressSummary?.progressRiskLevel} · blocked {selected.productionProgressSummary?.blockedTasks ?? 0}
                </div>
                {!!selected.productionProgressSummary?.progressRiskReasons?.length && (
                  <ul style={{ margin: '0 0 8px 16px', fontSize: 12 }}>
                    {(selected.productionProgressSummary.progressRiskReasons ?? []).slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                {(selected.tasks ?? []).length === 0 ? <div className="text-muted">No tasks</div> : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {(selected.tasks as any[]).map(t => (
                      <div key={t._id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{t.sequence ? `${t.sequence}. ` : ''}{t.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.category} · {t.status}</div>
                          {t.blockedReason && <div style={{ fontSize: 12, color: 'var(--red)' }}>Blocked: {t.blockedReason}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {t.status !== 'in_progress' && t.status !== 'completed' && (
                            <button className="btn btn-secondary" onClick={() => mutations.updateTask.mutate({ id: t._id, payload: { status: 'in_progress' } })}>Start</button>
                          )}
                          {t.status !== 'completed' && (
                            <button className="btn btn-secondary" onClick={() => mutations.updateTask.mutate({ id: t._id, payload: { status: 'completed' } })}>Complete</button>
                          )}
                          {t.status !== 'blocked' && (
                            <button className="btn btn-ghost" onClick={() => {
                              const reason = prompt('Blocked reason');
                              if (!reason) return;
                              mutations.updateTask.mutate({ id: t._id, payload: { status: 'blocked', blockedReason: reason } });
                            }}>Block</button>
                          )}
                          {t.status === 'blocked' && (
                            <button className="btn btn-ghost" onClick={() => mutations.updateTask.mutate({ id: t._id, payload: { status: 'ready', blockedReason: null } })}>Unblock</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card" style={{ padding: 12, marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{HUB_LABELS.closeout} readiness</div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  readiness {selected.delivery?.deliveryReadiness?.readinessLevel ?? 'not_ready'} · {selected.delivery?.deliveryReadiness?.isReady ? 'ready' : 'not ready'}
                </div>
                {!!selected.delivery?.deliveryReadiness?.reasons?.length && (
                  <ul style={{ margin: '0 0 8px 16px', fontSize: 12 }}>
                    {selected.delivery.deliveryReadiness.reasons.slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {!selected.delivery && <button className="btn btn-secondary" onClick={() => delivery.create.mutate({ productionJobId: selected._id, buildId: selected.buildId, unitId: selected.unitId, dealId: selected.dealId, status: 'pending' })}>Create {HUB_LABELS.closeout} record</button>}
                  {selected.delivery?.status === 'pending' && <button className="btn btn-secondary" onClick={() => delivery.update.mutate({ id: selected.delivery._id, payload: { status: 'ready_for_delivery' } })}>Mark ready for client</button>}
                  {selected.delivery?.status === 'ready_for_delivery' && <button className="btn btn-secondary" onClick={() => delivery.update.mutate({ id: selected.delivery._id, payload: { status: 'scheduled', scheduledDeliveryDate: new Date(Date.now() + 86400000).toISOString() } })}>Schedule handoff</button>}
                  {selected.delivery?.status === 'scheduled' && <button className="btn btn-secondary" onClick={() => delivery.update.mutate({ id: selected.delivery._id, payload: { status: 'delivered', actualDeliveryDate: new Date().toISOString() } })}>Mark completed</button>}
                  {selected.delivery?.status === 'delivered' && <button className="btn btn-ghost" onClick={() => delivery.update.mutate({ id: selected.delivery._id, payload: { status: 'closed' } })}>Close Out</button>}
                </div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  checklist: inspection {closeout?.finalInspectionComplete ? 'yes' : 'no'} · docs {closeout?.customerFacingDocsComplete ? 'yes' : 'no'} · photos {closeout?.photosComplete ? 'yes' : 'no'} · punch resolved {closeout?.punchItemsResolved ? 'yes' : 'no'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => delivery.updateCloseout.mutate({ productionJobId: selected._id, payload: { finalInspectionComplete: !(closeout?.finalInspectionComplete ?? false) } })}>Toggle Inspection</button>
                  <button className="btn btn-secondary" onClick={() => delivery.updateCloseout.mutate({ productionJobId: selected._id, payload: { customerFacingDocsComplete: !(closeout?.customerFacingDocsComplete ?? false) } })}>Toggle Docs</button>
                  <button className="btn btn-secondary" onClick={() => delivery.updateCloseout.mutate({ productionJobId: selected._id, payload: { photosComplete: !(closeout?.photosComplete ?? false) } })}>Toggle Photos</button>
                  <button className="btn btn-ghost" onClick={() => {
                    const title = prompt('Punch item title');
                    if (!title) return;
                    const items = [...(closeout?.punchItems ?? []), { id: `p_${Date.now()}`, title, status: 'open' }];
                    delivery.updateCloseout.mutate({ productionJobId: selected._id, payload: { punchItems: items } });
                  }}>Add Punch Item</button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
