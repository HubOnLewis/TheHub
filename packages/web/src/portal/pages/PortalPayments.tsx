import PaymentProgress from '../components/PaymentProgress.js';
import { PORTAL_DEMO_EVENT, PORTAL_PAYMENT_HISTORY } from '../demoData.js';
import { formatCurrency } from '@hub-crm/shared';
import { computeReadiness } from '../readiness.js';
import { usePortalStore } from '../portalStore.js';

export default function PortalPayments() {
  const event = usePortalStore(s => s.event);
  const payBalance = usePortalStore(s => s.payBalance);
  const payDeposit = usePortalStore(s => s.payDeposit);
  const { score } = computeReadiness(event);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 8px' }}>Payments</h1>
      <p style={{ color: 'var(--portal-muted)', margin: '0 0 20px' }}>
        Progress toward your event — not accounting software.
      </p>

      <PaymentProgress showActions />

      {score >= 50 && event.payments.some(p => p.status === 'paid') ? (
        <div className="portal-peace" style={{ marginTop: 20 }}>
          <h2>Milestone unlocked</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            Deposit received — your coordinator is preparing day-of logistics and Kisi access.
          </p>
        </div>
      ) : null}

      <div className="portal-card portal-card--flat" style={{ marginTop: 20 }}>
        <h3>Payment schedule</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13 }}>
          {event.payments.map(p => (
            <li key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              {p.label} — {p.status}
              {p.dueDate ? ` · due ${p.dueDate}` : ''}
              {p.paidAt ? ` · paid ${p.paidAt}` : ''}
              <span style={{ float: 'right' }}>{formatCurrency(p.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {PORTAL_PAYMENT_HISTORY.length > 0 ? (
        <div className="portal-card portal-card--flat" style={{ marginTop: 16 }}>
          <h3>Ledger · Perfect Venue</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13 }}>
            {PORTAL_PAYMENT_HISTORY.map(p => (
              <li key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                {p.label} · {formatCurrency(p.amount)}
                <span style={{ display: 'block', fontSize: 11, color: 'var(--portal-muted)' }}>
                  {p.paidOn} · {p.method}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 16 }}>
        Package total {PORTAL_DEMO_EVENT.packageTotal} · reminders sent before due dates (demo — no live processor).
      </p>

      {event.payments.some(p => p.label.toLowerCase().includes('deposit') && p.status !== 'paid') ? (
        <button type="button" className="portal-btn portal-btn--secondary" style={{ marginTop: 12 }} onClick={() => payDeposit()}>
          Pay deposit (demo)
        </button>
      ) : null}
    </>
  );
}
