import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export default function ContactsPage() {
  const q = useQuery({
    queryKey: ['contacts'],
    queryFn: () => client.get('/contacts', { params: { limit: 100 } }).then(r => r.data),
  });

  if (q.isLoading) return <main className="page-simple"><div className="card page-section">Loading contacts…</div></main>;
  if (q.isError) return <main className="page-simple"><div className="card page-section"><h1>Contacts</h1><p>Contacts are temporarily unavailable.</p></div></main>;

  const rows = q.data?.data || [];
  const withEmail = rows.filter((x: any) => Boolean(x.email)).length;
  const companies = new Set(rows.map((x: any) => x.companyName).filter(Boolean)).size;

  return (
    <main className="page-simple premium-data-page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Customer relationships</span>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">{q.data?.total || 0} persisted contacts from the Hub workspace.</p>
        </div>
      </header>

      <div className="premium-summary-strip" aria-label="Contact summary">
        <div className="premium-summary-tile"><span>Loaded</span><strong>{rows.length}</strong></div>
        <div className="premium-summary-tile"><span>With email</span><strong>{withEmail}</strong></div>
        <div className="premium-summary-tile"><span>Companies</span><strong>{companies}</strong></div>
      </div>

      <section className="card list-card premium-data-card">
        <div className="premium-data-card__head">
          <div>
            <span className="premium-data-card__kicker">Relationship directory</span>
            <h2>People</h2>
          </div>
          <span className="hub-admin-stat-pill">{rows.length} shown</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Source</th></tr></thead>
            <tbody>{rows.map((x: any) => (
              <tr key={x.id}>
                <td><strong>{x.displayName}</strong></td>
                <td>{x.email || '—'}</td>
                <td>{x.companyName || '—'}</td>
                <td><span className="premium-source-pill">{x.source}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
