import { Link, useParams } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import AgreementPanel from '../components/AgreementPanel.js';
import ConciergePanel from '../components/ConciergePanel.js';
import PaymentProgress from '../components/PaymentProgress.js';
import ReadinessScore from '../components/ReadinessScore.js';
import { PORTAL_ROUTES } from '../paths.js';
import { usePortalStore } from '../portalStore.js';

export default function PortalEvent() {
  const { id } = useParams();
  const event = usePortalStore(s => s.event);
  const profile = usePortalStore(s => s.profile);
  const toggleChecklist = usePortalStore(s => s.toggleChecklist);
  const setLayout = usePortalStore(s => s.setLayout);

  if (id && id !== profile.id) {
    return (
      <p>
        This portal session is bound to <strong>{profile.title}</strong>. Open the access link for that event, or{' '}
        <Link to={`${PORTAL_ROUTES.login}?event=${encodeURIComponent(id)}`}>switch events</Link>.
      </p>
    );
  }

  return (
    <>
      <div className="portal-hero-banner">
        <div className="portal-hero-banner__inner">
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{profile.venueName}</p>
          <h1>{profile.title}</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>{profile.displayDate}</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.8 }}>{profile.venueAddress}</p>
        </div>
      </div>

      <ReadinessScore compact />

      <div className="portal-grid-2" style={{ marginBottom: 20 }}>
        <div className="portal-card portal-card--flat">
          <h3>Overview</h3>
          <p style={{ margin: 0 }}>
            {profile.guests || event.guestCount} guests · {formatCurrency(profile.packageTotal)} · {profile.space}
          </p>
          <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
            Coordinator: {profile.coordinator.name}
            {profile.source === 'crm' ? ' · Live CRM booking' : ' · Demo preview'}
          </p>
          {profile.notes ? (
            <p style={{ fontSize: 13, marginTop: 10 }}>{profile.notes}</p>
          ) : null}
        </div>
        <div className="portal-card portal-card--flat">
          <h3>Venue access</h3>
          <p style={{ margin: 0, fontSize: 13 }}>
            Load-in details and Kisi codes will appear here closer to the event date.
          </p>
          <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 8 }}>
            Contact {profile.coordinator.email} with day-of questions.
          </p>
        </div>
      </div>

      <p className="portal-section-title">Planning</p>
      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Checklist</h3>
        {event.checklist.map(c => (
          <label key={c.id} className="portal-check-row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={c.complete} onChange={() => toggleChecklist(c.id)} />
            <span>
              <strong>{c.label}</strong>
              {c.due ? (
                <span style={{ display: 'block', fontSize: 11, color: 'var(--portal-muted)' }}>Due {c.due}</span>
              ) : null}
            </span>
          </label>
        ))}
        <Link to={PORTAL_ROUTES.checklist}>Full checklist →</Link>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Layout & design</h3>
        <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>Choose a floor preference for {profile.space}.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {['Crescent tables', 'Open lounge', 'Gift table by windows'].map(opt => (
            <button
              key={opt}
              type="button"
              className={`portal-btn ${event.layoutChoice === opt ? 'portal-btn--primary' : 'portal-btn--secondary'}`}
              onClick={() => setLayout(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <Link to={PORTAL_ROUTES.designBoard} style={{ display: 'inline-block', marginTop: 12 }}>
          Design board →
        </Link>
      </div>

      <PaymentProgress showActions />
      <AgreementPanel />
      <ConciergePanel />
    </>
  );
}
