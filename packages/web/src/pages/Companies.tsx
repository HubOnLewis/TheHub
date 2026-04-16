// packages/web/src/pages/Companies.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanies } from '../hooks/useCompanies.js';
import { EmptyState, Spinner, Pagination } from '../components/ui/index.js';
import { timeAgo } from '@mtte-core/shared';

export default function Companies() {
  const navigate   = useNavigate();
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  const params = {
    search: search || undefined,
    page,
    limit:  25,
    sort:   'name',
    order:  'asc' as const,
  };

  const { data, isLoading } = useCompanies(params);

  const companies = (data as any)?.data  ?? [];
  const total     = (data as any)?.total ?? 0;
  const pages     = (data as any)?.pages ?? 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Companies</h1>
          <div className="page-subtitle">{total} companies</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M6.5 1a5.5 5.5 0 014.227 9.02l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search name or city…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
            <Spinner /><span className="text-muted">Loading…</span>
          </div>
        ) : companies.length === 0 ? (
          <EmptyState message="No companies found" sub="Try clearing the search or run the VOZE import script" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Last Contact</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c: any) => (
                <tr
                  key={c._id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/companies/${c._id}`)}
                >
                  <td className="table-company">
                    {c.name}
                    {c.isStub && (
                      <span className="badge" style={{ marginLeft: 6, fontSize: 10, background: 'var(--border)', color: 'var(--text-secondary)' }}>
                        stub
                      </span>
                    )}
                  </td>
                  <td className="text-sm">{c.phone ?? '—'}</td>
                  <td className="text-sm">
                    {[c.address?.city, c.address?.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="text-sm text-muted">
                    {c.daysSinceLastContact != null
                      ? `${c.daysSinceLastContact}d ago`
                      : c.updatedAt ? timeAgo(c.updatedAt) : '—'}
                  </td>
                  <td className="text-sm text-muted">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pages} total={total} onPage={setPage} />
      </div>
    </div>
  );
}
