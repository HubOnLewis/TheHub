import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeliveryRecords, useDeliveryMutations, useDeliveryRecord } from '../hooks/useDelivery.js';
import { EmptyState, Spinner, StatusBadge, TableSkeleton } from '../components/ui/index.js';

export default function Delivery() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useDeliveryRecords({ status: status || undefined, q: q || undefined, limit: 200 });
  const { data: detail, isLoading: detailLoading } = useDeliveryRecord(selectedId);
  const mutations = useDeliveryMutations();
  const rows = data?.data ?? [];
  const groups = ['pending', 'ready_for_delivery', 'scheduled', 'delivered', 'closed'] as const;

  const packet = detail?.deliveryPacket as Record<string, unknown> | null | undefined;
  const followUps = (detail?.postDeliveryFollowUps ?? []) as Array<Record<string, unknown>>;
  const handoff = detail?.deliveryHandoffState as { readinessLevel?: string; reasons?: string[] } | undefined;
  const summary = detail?.customerHandoffSummary as Record<string, unknown> | undefined;

  if (isLoading) return <div className="card" style={{ padding: 24 }}><TableSkeleton rows={5} /></div>;
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery</h1>
          <div className="page-subtitle">Closeout, customer packet, and post-delivery follow-up</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <input className="form-input" placeholder="Search contact/notes" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? 'minmax(0,1fr) 380px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div>
          {rows.length === 0 ? <EmptyState message="No delivery records" sub="Create a delivery record from production context." /> : (
            <div style={{ display: 'grid', gap: 18 }}>
              {groups.map(g => {
                const list = rows.filter((r: { status: string }) => r.status === g);
                return (
                  <section key={g}>
                    <div className="list-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <StatusBadge domain="delivery" value={g}>{g.replace(/_/g, ' ')}</StatusBadge>
                      <span style={{ color: 'var(--text-light)', fontWeight: 700 }}>· {list.length}</span>
                    </div>
                    <div className="card list-card">
                      {list.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: 'var(--text-secondary)' }}>None</div> : list.map((r: Record<string, unknown>) => {
                        const id = String(r._id);
                        const active = selectedId === id;
                        const pkt = r.deliveryPacket as { status?: string } | undefined;
                        const hs = r.deliveryHandoffState as { readinessLevel?: string } | undefined;
                        const fu = (r.postDeliveryFollowUps ?? []) as Array<{ status?: string; dueAt?: string; followUpType?: string }>;
                        const nextDue = fu.find(x => x.status === 'pending' || x.status === 'scheduled');
                        const dueStr = typeof nextDue?.dueAt === 'string' && nextDue.dueAt
                          ? new Date(nextDue.dueAt).toLocaleDateString()
                          : null;
                        return (
                          <div
                            role="button"
                            tabIndex={0}
                            key={id}
                            className={`list-row${active ? ' list-row--active' : ''}`}
                            onClick={() => setSelectedId(id)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(id); } }}
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                          >
                            <div>
                              <div className="list-row__title">
                                {(r.build as { name?: string })?.name ?? 'Build'} ·{' '}
                                {(r.unit as { year?: number; make?: string; model?: string })?.year ?? ''}{' '}
                                {(r.unit as { make?: string })?.make ?? ''} {(r.unit as { model?: string })?.model ?? ''}
                              </div>
                              <div className="list-row__meta">
                                packet {pkt?.status ?? '—'} · handoff {hs?.readinessLevel ?? '—'}
                                {dueStr && (
                                  <span> · follow-up {dueStr}</span>
                                )}
                              </div>
                              {!!(r.deliveryReadiness as { reasons?: string[] })?.reasons?.length && (
                                <div style={{ fontSize: 12, color: 'var(--red)' }}>
                                  {(r.deliveryReadiness as { reasons: string[] }).reasons.slice(0, 2).join(' · ')}
                                </div>
                              )}
                            </div>
                            <div className="list-row__actions" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                              {r.status === 'pending' && (
                                <button type="button" className="btn btn-secondary" onClick={() => mutations.update.mutate({ id, payload: { status: 'ready_for_delivery' } })}>Mark Ready</button>
                              )}
                              {r.status === 'ready_for_delivery' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => mutations.update.mutate({
                                    id,
                                    payload: { status: 'scheduled', scheduledDeliveryDate: new Date(Date.now() + 86400000).toISOString() },
                                  })}
                                >Schedule</button>
                              )}
                              {r.status === 'scheduled' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => mutations.update.mutate({ id, payload: { status: 'delivered', actualDeliveryDate: new Date().toISOString() } })}
                                >Mark Delivered</button>
                              )}
                              {r.status === 'delivered' && (
                                <button type="button" className="btn btn-ghost" onClick={() => mutations.update.mutate({ id, payload: { status: 'closed' } })}>Close</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {selectedId && (
          <div className="card" style={{ position: 'sticky', top: 12, padding: 12, maxHeight: 'calc(100vh - 100px)', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontFamily: 'var(--font-cond)' }}>Handoff</div>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>Close</button>
            </div>
            {detailLoading || !detail ? <Spinner /> : (
              <>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <div><strong>Unit / build</strong>: {String(summary?.unitLabel ?? '')}</div>
                  <div><strong>Build</strong>: {String(summary?.buildName ?? '')}</div>
                  <div><strong>Frozen version</strong>: {String(summary?.deliveredVersionId ?? '')}</div>
                  <div><strong>Packet</strong>: {String(summary?.packetStatus ?? '—')}</div>
                  <div><strong>Customer readiness</strong>: {handoff?.readinessLevel ?? '—'}</div>
                </div>
                {!!handoff?.reasons?.length && (
                  <ul style={{ fontSize: 12, margin: '0 0 10px 16px', color: 'var(--text-secondary)' }}>
                    {handoff.reasons.slice(0, 6).map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {!packet && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => mutations.createPacket.mutate({
                        deliveryId: selectedId,
                        payload: {
                          includesPhotos: false,
                          includesFinalSpecSummary: false,
                          includesCustomerDocs: false,
                          includesKeyContacts: false,
                        },
                      })}
                    >Create packet</button>
                  )}
                  {!!packet && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => mutations.updatePacket.mutate({
                          deliveryId: selectedId,
                          payload: {
                            includesPhotos: true,
                            includesFinalSpecSummary: true,
                            includesCustomerDocs: true,
                            includesKeyContacts: true,
                            status: 'ready',
                          },
                        })}
                      >Mark packet ready</button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => mutations.updatePacket.mutate({ deliveryId: selectedId, payload: { status: 'issued' } })}
                      >Issue packet</button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Post-delivery follow-ups</div>
                <ul style={{ fontSize: 12, margin: '0 0 10px 16px' }}>
                  {followUps.length === 0 ? <li>None</li> : followUps.map(f => (
                    <li key={String(f._id)} style={{ marginBottom: 6 }}>
                      {String(f.followUpType)} · {String(f.status)}
                      {typeof f.dueAt === 'string' && f.dueAt ? (
                        <span> · due {new Date(f.dueAt).toLocaleString()}</span>
                      ) : null}
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => mutations.updateFollowUp.mutate({
                            followUpId: String(f._id),
                            payload: { status: 'scheduled', dueAt: new Date(Date.now() + 3 * 86400000).toISOString() },
                          })}
                        >Schedule +3d</button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => mutations.updateFollowUp.mutate({
                            followUpId: String(f._id),
                            payload: { status: 'completed', completedAt: new Date().toISOString() },
                          })}
                        >Complete</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => mutations.createFollowUp.mutate({
                    deliveryId: selectedId,
                    payload: { followUpType: 'service_intro', status: 'pending', dueAt: new Date(Date.now() + 14 * 86400000).toISOString() },
                  })}
                >Add service intro</button>
                <div style={{ marginTop: 12 }}>
                  <Link className="btn btn-ghost" to="/production">Open production</Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
