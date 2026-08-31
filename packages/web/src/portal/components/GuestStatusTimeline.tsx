import { useGuestFacts } from '../guestFacts.js';

export default function GuestStatusTimeline() {
  const { steps } = useGuestFacts();

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
