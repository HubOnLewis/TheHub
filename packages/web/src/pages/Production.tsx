import { useMemo, useState } from 'react';
import { useProductionJobs, useProductionJob, useProductionMutations } from '../hooks/useProduction.js';
import { EmptyState, Modal, Spinner } from '../components/ui/index.js';

export default function Production() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useProductionJobs({ status: (status || undefined) as any, q: q || undefined, limit: 200 });
  const { data: selected } = useProductionJob(selectedId);
  const mutations = useProductionMutations();
  const rows = data?.data ?? [];
  const grouped = useMemo(() => ({
    ready: rows.filter((r: any) => r.status === 'ready'),
    in_progress: rows.filter((r: any) => r.status === 'in_progress'),
    paused: rows.filter((r: any) => r.status === 'paused'),
    completed: rows.filter((r: any) => r.status === 'completed'),
  }), [rows]);

  if (isLoading) return <div style={{ padding: 50, display: 'flex', justifyContent: 'center', gap: 8 }}><Spinner /><span>Loading…</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Production</h1>
          <div className="page-subtitle">Frozen shop jobs from approved build versions</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="queued">queued</option><option value="ready">ready</option><option value="in_progress">in_progress</option><option value="paused">paused</option><option value="completed">completed</option>
        </select>
        <input className="form-input" placeholder="Search team/notes/job#" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {rows.length === 0 ? <EmptyState message="No production jobs" sub="Create jobs from approved builds." /> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {Object.entries(grouped).map(([k, list]) => (
            <section key={k}>
              <div style={{ fontWeight: 800, marginBottom: 6, fontFamily: 'var(--font-cond)' }}>{k} · {(list as any[]).length}</div>
              <div className="card" style={{ padding: 0 }}>
                {(list as any[]).length === 0 ? <div style={{ padding: 10, fontSize: 12 }}>None</div> : (list as any[]).map(j => (
                  <div key={j._id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{j.build?.name ?? 'Build'} · {j.unit?.year ?? ''} {j.unit?.make ?? ''} {j.unit?.model ?? ''}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>job {j.jobNumber ?? j._id.slice(0, 8)} · team {j.assignedTeam ?? 'unassigned'}</div>
                        <div style={{ fontSize: 12 }}>status {j.status} · frozen version {j.buildVersionId}</div>
                        {j.productionImpact?.hasImpact && <div style={{ fontSize: 12, color: 'var(--red)' }}>{j.productionImpact.reasons.join(' · ')}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" onClick={() => setSelectedId(j._id)}>Shop View</button>
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
        <Modal title="Shop Floor Build View" onClose={() => setSelectedId(null)} width={900}>
          {!selected ? <Spinner /> : (
            <div>
              <div className="card" style={{ padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>Unit</div>
                <div style={{ fontSize: 12 }}>{selected.unit?.year ?? ''} {selected.unit?.make ?? ''} {selected.unit?.model ?? ''}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>VIN {selected.unit?.vin || 'pending'} · Stock {selected.unit?.stockNumber || 'n/a'}</div>
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
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
