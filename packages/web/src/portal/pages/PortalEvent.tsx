import { Link, useParams } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import AgreementPanel from '../components/AgreementPanel.js';
import ConciergePanel from '../components/ConciergePanel.js';
import PaymentProgress from '../components/PaymentProgress.js';
import ReadinessScore from '../components/ReadinessScore.js';
import { PORTAL_DEMO_EVENT } from '../demoData.js';
import { PORTAL_ROUTES } from '../paths.js';
import { usePortalStore } from '../portalStore.js';

export default function PortalEvent() {
  const { id } = useParams();
  const event = usePortalStore(s => s.event);
  const toggleChecklist = usePortalStore(s => s.toggleChecklist);
  const setLayout = usePortalStore(s => s.setLayout);

  if (id !== PORTAL_DEMO_EVENT.id) {
    return <p>Event not found in demo.</p>;
  }

  return (
    <>
      <div className="portal-hero-banner">
        <div className="portal-hero-banner__inner">
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{PORTAL_DEMO_EVENT.venueName}</p>
          <h1>{PORTAL_DEMO_EVENT.title}</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>{PORTAL_DEMO_EVENT.displayDate}</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.8 }}>{PORTAL_DEMO_EVENT.venueAddress}</p>
        </div>
      </div>

      <ReadinessScore compact />

      <div className="portal-grid-2" style={{ marginBottom: 20 }}>
        <div className="portal-card portal-card--flat">
          <h3>Overview</h3>
          <p style={{ margin: 0 }}>
            {PORTAL_DEMO_EVENT.guestCount} guests · {formatCurrency(PORTAL_DEMO_EVENT.packageTotal)} ·{' '}
            {PORTAL_DEMO_EVENT.proposalStatus}
          </p>
          <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>{PORTAL_DEMO_EVENT.nextAction}</p>
          {'packageLines' in PORTAL_DEMO_EVENT && PORTAL_DEMO_EVENT.packageLines?.length ? (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12 }}>
              {PORTAL_DEMO_EVENT.packageLines.map((l, i) => (
                <li key={i}>
                  {l.name} · {l.qty} · {formatCurrency(l.lineTotal)}
                  {'section' in l ? ` · ${l.section}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="portal-card portal-card--flat">
          <h3>Venue access</h3>
          <p style={{ margin: 0, fontSize: 13 }}>{PORTAL_DEMO_EVENT.accessInstructions}</p>
          <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 8 }}>{PORTAL_DEMO_EVENT.weatherWatch}</p>
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
              {c.due ? <span style={{ display: 'block', fontSize: 11, color: 'var(--portal-muted)' }}>Due {c.due}</span> : null}
            </span>
          </label>
        ))}
        <Link to={PORTAL_ROUTES.checklist}>Full checklist →</Link>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Layout & design</h3>
        <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>Choose a floor preference for the Event Space.</p>
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
        <Link to={PORTAL_ROUTES.designBoard} style={{ display: 'inline-block', marginTop: 12, fontSize: 12 }}>
          Design board →
        </Link>
      </div>

      <div className="portal-grid-2" style={{ marginBottom: 20 }}>
        <PaymentProgress />
        <AgreementPanel />
      </div>

      <p className="portal-section-title">Timeline</p>
      <ul className="portal-timeline">
        {event.timeline.slice(0, 6).map(t => (
          <li key={t.id}>
            <strong>{t.title}</strong>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--portal-muted)' }}>
              {t.at}
              {t.detail ? ` · ${t.detail}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <Link to={PORTAL_ROUTES.timeline}>Full timeline →</Link>

      <ConciergePanel />

      <p className="portal-section-title">Vendor collaboration</p>
      <div className="portal-card portal-card--flat">
        {event.vendors.map(v => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
            <span>
              <strong>{v.type}</strong> — {v.name}
            </span>
            <span className="portal-status portal-status--pending">{v.status}</span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: 'var(--portal-muted)', margin: '8px 0 0' }}>Invite vendors via magic link — coming in production.</p>
      </div>
    </>
  );
}
