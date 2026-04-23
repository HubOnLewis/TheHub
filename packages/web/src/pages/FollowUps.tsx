// packages/web/src/pages/FollowUps.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFollowUps } from '../hooks/useInteractions.js';
import { EmptyState, Spinner } from '../components/ui/index.js';

const fmt = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function FollowUps() {
  const [filters, setFilters] = useState({
    q: '',
    ownerUserId: '',
    status: 'open' as 'open' | 'completed',
    overdueOnly: '0',
  });
  const { data, isLoading } = useFollowUps({
    mine: 1,
    q: filters.q || undefined,
    ownerUserId: filters.ownerUserId || undefined,
    status: filters.status,
    overdueOnly: filters.overdueOnly === '1' ? 1 : 0,
    limit: 100,
  });
  const rows = data?.data ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <Spinner /><span className="text-muted">Loading…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My follow-ups</h1>
          <div className="page-subtitle">Open interactions with a follow-up date, soonest first</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <input className="form-input" placeholder="Search summary/body" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
        <input className="form-input" placeholder="Owner user ID" value={filters.ownerUserId} onChange={e => setFilters(f => ({ ...f, ownerUserId: e.target.value }))} />
        <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as 'open' | 'completed' }))}>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
        </select>
        <select className="form-select" value={filters.overdueOnly} onChange={e => setFilters(f => ({ ...f, overdueOnly: e.target.value }))}>
          <option value="0">All follow-ups</option>
          <option value="1">Overdue only</option>
        </select>
      </div>

      {!rows.length ? (
        <EmptyState message="No follow-ups queued" sub="Set a follow-up on an interaction to see it here." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map(r => (
            <Link
              key={r._id}
              to={`/companies/${r.companyId}?interactionId=${encodeURIComponent(r._id)}`}
              style={{ display: 'block', padding: '12px 16px', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{r.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {r.companyName ?? r.companyId} · {r.outcome.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Owner: {r.ownerName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.isOverdue ? 'var(--red)' : 'var(--text-primary)' }}>
                    {r.followUpAt ? fmt(r.followUpAt) : '—'}
                  </div>
                  {r.isOverdue && <div style={{ fontSize: 10, color: 'var(--red)' }}>Overdue</div>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
