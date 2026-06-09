import { formatCurrency } from '@hub-crm/shared';
import { PORTAL_DEMO_EVENT } from '../demoData.js';
import { usePortalStore } from '../portalStore.js';

export default function PaymentProgress({ showActions = false }: { showActions?: boolean }) {
  const payments = usePortalStore(s => s.event.payments);
  const payDeposit = usePortalStore(s => s.payDeposit);
  const payBalance = usePortalStore(s => s.payBalance);
  const queueLink = usePortalStore(s => s.queuePaymentLink);

  const paid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pct = Math.round((paid / PORTAL_DEMO_EVENT.packageTotal) * 100);
  const remaining = PORTAL_DEMO_EVENT.packageTotal - paid;

  return (
    <div className="portal-card portal-card--flat">
      <h3>Payment progress</h3>
      <div className="portal-pay-ring" style={{ ['--paid-pct' as string]: `${pct}%` }}>
        <span>
          <strong style={{ fontSize: 18 }}>{pct}%</strong>
          paid
        </span>
      </div>
      <p style={{ textAlign: 'center', margin: '0 0 12px' }}>
        <span className="portal-stat-val" style={{ fontSize: 22 }}>{formatCurrency(remaining)}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--portal-muted)' }}>remaining</span>
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {payments.map(p => (
          <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span>
              {p.label}
              {p.dueDate ? ` · due ${p.dueDate}` : ''}
            </span>
            <span>
              {formatCurrency(p.amount)} · <strong>{p.status}</strong>
            </span>
          </li>
        ))}
      </ul>
      {showActions ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button type="button" className="portal-btn portal-btn--primary" onClick={() => payBalance()}>
            Pay remaining balance
          </button>
          <button type="button" className="portal-btn portal-btn--secondary" onClick={() => queueLink()}>
            Send payment link
          </button>
          <button type="button" className="portal-btn portal-btn--ghost" onClick={() => window.alert('Split payment schedule — coordinator will confirm (demo).')}>
            Split payment
          </button>
        </div>
      ) : null}
      {pct >= 100 ? (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--portal-success)', fontWeight: 600 }}>
          Event financially confirmed — planning milestones unlocked.
        </p>
      ) : null}
    </div>
  );
}
