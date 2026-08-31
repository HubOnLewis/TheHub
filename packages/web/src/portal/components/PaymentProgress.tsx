import { formatCurrency } from '@hub-crm/shared';
import { usePortalStore } from '../portalStore.js';

export default function PaymentProgress({ showActions = false }: { showActions?: boolean }) {
  const payments = usePortalStore(s => s.event.payments);
  const packageTotal = usePortalStore(s => s.profile.packageTotal);
  const queueLink = usePortalStore(s => s.queuePaymentLink);

  const paid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const total = packageTotal > 0 ? packageTotal : 1;
  const pct = packageTotal > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const remaining = Math.max(0, packageTotal - paid);
  const paidInFull = packageTotal > 0 && remaining <= 0;

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
              {formatCurrency(p.amount)} · <strong>{p.status === 'paid' ? 'Paid' : p.status === 'due' ? 'Due' : 'Scheduled'}</strong>
            </span>
          </li>
        ))}
      </ul>
      {showActions && remaining > 0 && packageTotal > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button type="button" className="portal-btn portal-btn--secondary" onClick={() => queueLink()}>
            Ask coordinator to record a payment
          </button>
        </div>
      ) : null}
      {paidInFull ? (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--portal-success)', fontWeight: 600 }}>
          Fully paid — thank you. Planning details stay available here anytime.
        </p>
      ) : null}
    </div>
  );
}
