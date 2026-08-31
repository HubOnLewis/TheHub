import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { PORTAL_ROUTES } from '../paths.js';
import { computeReadiness } from '../readiness.js';
import ConciergePanel from '../components/ConciergePanel.js';
import PeaceOfMindBanner from '../components/PeaceOfMindBanner.js';
import ReadinessScore from '../components/ReadinessScore.js';
import { usePortalStore } from '../portalStore.js';

function daysUntilEvent(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

export default function PortalDashboard() {
  const event = usePortalStore(s => s.event);
  const profile = usePortalStore(s => s.profile);
  const nextChecklist = event.checklist.find(c => !c.complete);
  const paid = event.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, profile.packageTotal - paid);
  const { risks } = computeReadiness(event);
  const firstName = profile.contactName.split(' ')[0] || 'there';

  const days = daysUntilEvent(profile.eventStartIso);
  const paidPct =
    profile.packageTotal > 0 ? Math.min(100, Math.round((paid / profile.packageTotal) * 100)) : 0;

  return (
    <>
      <section className="portal-hero-countdown" aria-label="Event countdown">
        <div>
          <p className="portal-hero-countdown__eyebrow">Your celebration at HuB on Lewis</p>
          <h1 className="portal-hero-countdown__title">{profile.title}</h1>
          <p className="portal-hero-countdown__date">{profile.displayDate}</p>
          <p className="portal-hero-countdown__meta">
            Welcome back, {firstName}
            {profile.space ? ` · ${profile.space}` : ''}
            {profile.guests ? ` · ${profile.guests} guests` : ''}
          </p>
        </div>
        <div className="portal-hero-countdown__ring" aria-label={`${days} days until event`}>
          <span className="portal-hero-countdown__n">{days}</span>
          <span className="portal-hero-countdown__lbl">{days === 1 ? 'day to go' : 'days to go'}</span>
        </div>
      </section>

      <PeaceOfMindBanner />
      <ReadinessScore />

      <div className="portal-next-grid">
        {remaining > 0 ? (
          <article className="portal-next-card portal-next-card--pay">
            <span className="portal-next-card__kicker">Next for you</span>
            <h2>Secure your date</h2>
            <p>
              {formatCurrency(remaining)} remaining · {paidPct}% of your package is already in place.
            </p>
            <Link to={PORTAL_ROUTES.payments} className="portal-btn portal-btn--primary">
              Review payments
            </Link>
          </article>
        ) : (
          <article className="portal-next-card portal-next-card--ok">
            <span className="portal-next-card__kicker">You’re all set on payments</span>
            <h2>Package paid in full</h2>
            <p>Focus on guests, layout, and day-of details with your coordinator.</p>
            <Link to={PORTAL_ROUTES.checklist} className="portal-btn portal-btn--secondary">
              Open checklist
            </Link>
          </article>
        )}

        {nextChecklist ? (
          <article className="portal-next-card">
            <span className="portal-next-card__kicker">Planning</span>
            <h2>Up next</h2>
            <p>{nextChecklist.label}</p>
            <Link to={PORTAL_ROUTES.checklist} className="portal-btn portal-btn--secondary">
              Continue checklist
            </Link>
          </article>
        ) : (
          <article className="portal-next-card">
            <span className="portal-next-card__kicker">Planning</span>
            <h2>Checklist complete</h2>
            <p>Message your coordinator anytime if details change.</p>
            <Link to={PORTAL_ROUTES.messages} className="portal-btn portal-btn--secondary">
              Open messages
            </Link>
          </article>
        )}
      </div>

      <div className="portal-payment-confidence">
        <div className="portal-payment-confidence__bar" aria-hidden>
          <span style={{ width: `${paidPct}%` }} />
        </div>
        <p>
          <strong>{paidPct}%</strong> of package secured
          {remaining > 0 ? ` · ${formatCurrency(remaining)} remaining` : ' · nothing remaining'}
        </p>
      </div>

      <section className="portal-coord-card">
        <div>
          <span className="portal-next-card__kicker">Your coordinator</span>
          <strong>{profile.coordinator.name}</strong>
          <p>
            {profile.coordinator.email}
            {profile.coordinator.phone ? ` · ${profile.coordinator.phone}` : ''}
          </p>
        </div>
        <Link to={PORTAL_ROUTES.messages} className="portal-btn portal-btn--ghost">
          Send a note
        </Link>
      </section>

      <section className="live-rail" style={{ marginBottom: 20 }}>
        <div className="live-rail__head">
          <h2 className="live-rail__title">Recent updates</h2>
          <Link to={PORTAL_ROUTES.timeline}>All activity</Link>
        </div>
        <div className="live-rail__track">
          {event.timeline.slice(0, 6).map(t => (
            <div key={t.id} className="live-rail__item">
              <span className={`live-rail__cat live-rail__cat--${t.kind === 'payment' ? 'agent' : 'system'}`}>
                {t.kind}
              </span>
              <span className="live-rail__text">{t.title}</span>
            </div>
          ))}
        </div>
      </section>

      {risks.length > 0 ? (
        <p className="portal-risk-line">{risks[0]}</p>
      ) : null}

      <ConciergePanel />
    </>
  );
}
