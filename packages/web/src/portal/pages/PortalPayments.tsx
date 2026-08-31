import PaymentProgress from '../components/PaymentProgress.js';
import { formatCurrency } from '@hub-crm/shared';
import { computeReadiness } from '../readiness.js';
import { usePortalStore } from '../portalStore.js';
import { useGuestFacts } from '../guestFacts.js';

export default function PortalPayments() {
  const event = usePortalStore(s => s.event);
  const profile = usePortalStore(s => s.profile);
  const { phase, hasProposal } = useGuestFacts();
  const { score } = computeReadiness(event);
  const remaining = Math.max(0, profile.balanceDue);
  const paidInFull = profile.packageTotal > 0 && remaining <= 0;

  if (!hasProposal || phase === 'awaiting_proposal' || phase === 'awaiting_signature') {
    return (
      <>
        <h1 className="portal-page-title">Payments</h1>
        <p className="portal-page-lede">
          {phase === 'awaiting_signature'
            ? 'Sign your proposal first. Deposit instructions appear after you sign — nothing is charged here.'
            : 'A proposal is not on file yet. Nothing is due, and this is not a booking.'}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="portal-page-title">Payments</h1>
      <p className="portal-page-lede">
        {remaining > 0
          ? `${formatCurrency(remaining)} remaining to fully secure ${profile.title}.`
          : paidInFull
            ? `Your package for ${profile.title} is paid in full.`
            : `No payment schedule yet for ${profile.title}.`}
      </p>

      <PaymentProgress showActions />

      {score >= 50 && event.payments.some(p => p.status === 'paid') && remaining > 0 ? (
        <div className="portal-peace" style={{ marginTop: 20 }}>
          <h2>Deposit received</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            Thank you — your coordinator is holding the date and preparing day-of details.
          </p>
        </div>
      ) : null}

      <div className="portal-card portal-card--flat" style={{ marginTop: 20 }}>
        <h3>Payment schedule</h3>
        <ul className="portal-pay-schedule">
          {event.payments.map(p => (
            <li key={p.id}>
              <span>
                <strong>{p.label}</strong>
                <span className="portal-pay-schedule__meta">
                  {p.status === 'paid' ? 'Paid' : p.status === 'due' ? 'Due now' : 'Scheduled'}
                  {p.dueDate && p.status !== 'paid' ? ` · ${p.dueDate}` : ''}
                  {p.paidAt ? ` · ${p.paidAt}` : ''}
                </span>
              </span>
              <span>{formatCurrency(p.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="portal-pay-footnote">
        Package total {formatCurrency(profile.packageTotal)}. Card checkout is not live yet — your coordinator
        records payments received another way (check, Venmo). Guests cannot mark a deposit paid from this
        portal.
      </p>
    </>
  );
}
