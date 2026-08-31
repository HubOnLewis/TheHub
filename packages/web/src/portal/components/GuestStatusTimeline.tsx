import { buildGuestStatusTimeline } from '@hub-crm/shared';
import { usePortalStore } from '../portalStore.js';

export default function GuestStatusTimeline() {
  const profile = usePortalStore(s => s.profile);
  const event = usePortalStore(s => s.event);
  const proposalStatus =
    event.agreementStatus === 'signed'
      ? 'accepted'
      : event.agreementStatus === 'viewed'
        ? 'viewed'
        : event.agreementStatus === 'pending_review'
          ? 'sent'
          : null;
  const steps = buildGuestStatusTimeline({
    proposalStatus,
    amountPaid: profile.paidTotal,
    balanceDue: profile.balanceDue,
    grandTotal: profile.packageTotal,
    eventDateIso: profile.eventStartIso,
    detailsConfirmed: Boolean(profile.guests && profile.space && profile.eventStartIso),
  });

  return (
    <ol className="guest-timeline" aria-label="Event status">
      {steps.map(s => (
        <li key={s.key} className={`guest-timeline__step guest-timeline__step--${s.state}`}>
          <span className="guest-timeline__dot" aria-hidden />
          <strong>{s.label}</strong>
          {s.detail ? <span className="guest-timeline__detail">{s.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}
