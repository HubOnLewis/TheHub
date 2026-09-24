import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@hub-crm/shared';
import client from '../api/client.js';

export default function FinancialPaymentsPage() {
  const q = useQuery({
    queryKey: ['financial', 'payments'],
    queryFn: () => client.get('/financial/payments').then(r => r.data),
  });

  if (q.isLoading) return <main className="page-simple"><div className="card page-section">Loading imported payments…</div></main>;
  if (q.isError) return <main className="page-simple"><div className="card page-section"><h1>Imported payments</h1><p>Financial records are temporarily unavailable.</p></div></main>;

  const rows = q.data?.data || [];
  const total = rows.reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
  const dated = rows.filter((x: any) => Boolean(x.paymentDate)).length;

  return (
    <main className="page-simple premium-data-page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Perfect Venue financial truth</span>
          <h1 className="page-title">Imported payments</h1>
          <p className="page-subtitle">{rows.length} imported transactions. Hub payment links remain a separate workflow.</p>
        </div>
      </header>

      <div className="premium-summary-strip" aria-label="Payment summary">
        <div className="premium-summary-tile premium-summary-tile--money"><span>Imported value</span><strong>{formatCurrency(total)}</strong></div>
        <div className="premium-summary-tile"><span>Transactions</span><strong>{rows.length}</strong></div>
        <div className="premium-summary-tile"><span>With paid date</span><strong>{dated}</strong></div>
      </div>

      <section className="card list-card premium-data-card">
        <div className="premium-data-card__head">
          <div>
            <span className="premium-data-card__kicker">Imported ledger</span>
            <h2>Payment history</h2>
          </div>
          <span className="hub-admin-stat-pill">{rows.length} records</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Event</th><th>Amount</th><th>Type</th><th>Status</th><th>Paid</th></tr></thead>
            <tbody>{rows.map((x: any) => (
              <tr key={x.id}>
                <td><strong>{x.eventTitle || '—'}</strong></td>
                <td className="premium-money-cell">{formatCurrency(x.amount)}</td>
                <td>{x.paymentType}</td>
                <td><span className="premium-source-pill">{x.status}</span></td>
                <td>{x.paymentDate ? new Date(x.paymentDate).toLocaleDateString() : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
