import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal, EmptyState, Spinner } from '../components/ui/index.js';
import InteractionComposer from '../components/InteractionComposer.js';
import {
  useMyWork, type InteractionRow, useUpdateInteraction, useCreateInteraction,
} from '../hooks/useInteractions.js';

const fmt = (d?: string) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

export default function MyWork() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [ownerUserId, setOwnerUserId] = useState(sp.get('ownerUserId') ?? '');
  const [actionTarget, setActionTarget] = useState<{
    row: InteractionRow;
    mode: 'log_call' | 'reschedule' | 'add_note';
  } | null>(null);
  const { data, isLoading, refetch } = useMyWork({ q: q || undefined, ownerUserId: ownerUserId || undefined, limit: 150 });
  const updateInteraction = useUpdateInteraction(actionTarget?.row.companyId ?? '');
  const createInteraction = useCreateInteraction(actionTarget?.row.companyId ?? '');

  const sections = useMemo(() => ([
    { title: 'Overdue', color: 'var(--red)', rows: data?.overdue ?? [] },
    { title: 'Due Today', color: '#f59e0b', rows: data?.dueToday ?? [] },
    { title: 'Upcoming', color: '#3b82f6', rows: data?.upcoming ?? [] },
    { title: 'Suggested', color: '#9ca3af', rows: data?.suggested ?? [] },
  ]), [data]);

  if (isLoading) {
    return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> <span>Loading…</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Work</h1>
          <div className="page-subtitle">Prioritized interaction actions that drive daily momentum</div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Search summary/body"
            value={q}
            onChange={e => {
              const v = e.target.value;
              setQ(v);
              setSp(prev => { if (v) prev.set('q', v); else prev.delete('q'); return prev; });
            }}
          />
          <input
            className="form-input"
            placeholder="Owner user ID"
            value={ownerUserId}
            onChange={e => {
              const v = e.target.value;
              setOwnerUserId(v);
              setSp(prev => { if (v) prev.set('ownerUserId', v); else prev.delete('ownerUserId'); return prev; });
            }}
          />
        </div>
      </div>

      {sections.every(s => s.rows.length === 0) ? (
        <EmptyState message="No work items" sub="No overdue, due, upcoming, or suggested actions right now." />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {sections.map(section => (
            <section key={section.title}>
              <div style={{ fontFamily: 'var(--font-cond)', marginBottom: 6, fontSize: 14, color: section.color, fontWeight: 800 }}>
                {section.title} · {section.rows.length}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {section.rows.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>None</div>
                ) : section.rows.map(r => (
                  <div key={`${section.title}-${r._id}`} style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/companies/${r.companyId}?interactionId=${encodeURIComponent(r._id)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <div style={{ fontWeight: 700 }}>{r.companyName ?? r.companyId} — {r.summary}</div>
                        </Link>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {r.nextAction ? `${r.nextAction.type}: ${r.nextAction.reason}` : r.outcome.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Owner: {r.ownerName}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: r.isOverdue ? 'var(--red)' : 'var(--text-primary)' }}>
                          {fmt(r.nextAction?.dueAt ?? r.followUpAt)}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => setActionTarget({ row: r, mode: 'log_call' })}>Log Call</button>
                      <button
                        className="btn btn-primary"
                        onClick={async () => {
                          await updateInteraction.mutateAsync({ id: r._id, body: { status: 'completed' } });
                          void refetch();
                        }}
                      >
                        Mark Complete
                      </button>
                      <button className="btn btn-secondary" onClick={() => setActionTarget({ row: r, mode: 'reschedule' })}>Reschedule</button>
                      <button className="btn btn-secondary" onClick={() => setActionTarget({ row: r, mode: 'add_note' })}>Add Note</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {actionTarget && (
        <Modal title="Quick Action" onClose={() => setActionTarget(null)} width={780}>
          <InteractionComposer
            companyId={actionTarget.row.companyId}
            initialValues={{
              type: actionTarget.mode === 'log_call' ? 'call' : actionTarget.mode === 'add_note' ? 'note' : 'task',
              direction: 'outbound',
              summary:
                actionTarget.mode === 'log_call'
                  ? `Follow-up call: ${actionTarget.row.summary}`
                  : actionTarget.mode === 'reschedule'
                    ? `Reschedule follow-up: ${actionTarget.row.summary}`
                    : `Note: ${actionTarget.row.summary}`,
              body: '',
              parentInteractionId: actionTarget.row._id,
              relatedDealId: actionTarget.row.relatedDealId,
              followUpAt: actionTarget.mode === 'reschedule'
                ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                : undefined,
            }}
            onSubmit={async (payload) => {
              const data = await createInteraction.mutateAsync(payload);
              return { _id: data._id };
            }}
            onSaved={() => {
              setActionTarget(null);
              void refetch();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
