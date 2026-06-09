import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { PORTAL_DEMO_EVENT } from '../demoData.js';
import { PORTAL_ROUTES } from '../paths.js';
import { computeReadiness } from '../readiness.js';
import ConciergePanel from '../components/ConciergePanel.js';
import PeaceOfMindBanner from '../components/PeaceOfMindBanner.js';
import ReadinessScore from '../components/ReadinessScore.js';
import { usePortalStore } from '../portalStore.js';

function daysUntilEvent(): number {
  const d = new Date(PORTAL_DEMO_EVENT.eventStart);
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

export default function PortalDashboard() {
  const event = usePortalStore(s => s.event);
  const nextChecklist = event.checklist.find(c => !c.complete);
  const remaining = PORTAL_DEMO_EVENT.packageTotal - event.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const { risks } = computeReadiness(event);

  const days = daysUntilEvent();
  const paidPct = Math.round((PORTAL_DEMO_EVENT.paidTotal / PORTAL_DEMO_EVENT.packageTotal) * 100);

  return (
    <>
      <section className="portal-hero-countdown" aria-label="Event countdown">
        <div>
          <p className="portal-hero-countdown__eyebrow">Your celebration at HuB on Lewis</p>
          <h1 className="portal-hero-countdown__title">{PORTAL_DEMO_EVENT.title}</h1>
          <p className="portal-hero-countdown__date">{PORTAL_DEMO_EVENT.displayDate}</p>
        </div>
        <div className="portal-hero-countdown__ring" aria-label={`${days} days until event`}>
          <span className="portal-hero-countdown__n">{days}</span>
          <span className="portal-hero-countdown__lbl">days to go</span>
        </div>
      </section>

      <PeaceOfMindBanner />
      <ReadinessScore />

      <div className="portal-payment-confidence">
        <div className="portal-payment-confidence__bar" aria-hidden>
          <span style={{ width: `${paidPct}%` }} />
        </div>
        <p>
          <strong>{paidPct}%</strong> of package secured · {formatCurrency(remaining)} remaining
        </p>
      </div>

      <section className="live-rail" style={{ marginBottom: 20 }}>
        <div className="live-rail__head">
          <h2 className="live-rail__title">Live updates</h2>
          <Link to={PORTAL_ROUTES.timeline}>All activity</Link>
        </div>
        <div className="live-rail__track">
          {event.timeline.slice(0, 6).map(t => (
            <div key={t.id} className="live-rail__item">
              <span className={`live-rail__cat live-rail__cat--${t.kind === 'payment' ? 'agent' : 'system'}`}>{t.kind}</span>
              <span className="live-rail__text">{t.title}</span>
              <time className="live-rail__time">{t.at}</time>
            </div>
          ))}
        </div>
      </section>

      <div className="portal-grid-3" style={{ marginBottom: 20 }}>
        <div className="portal-card">
          <h3>What&apos;s next</h3>
          <p className="portal-countdown">{daysUntilEvent()} days</p>
          <p style={{ fontSize: 13, color: 'var(--portal-muted)', margin: 0 }}>until your event</p>
          {nextChecklist ? (
            <Link to={PORTAL_ROUTES.checklist} style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 600 }}>
              → {nextChecklist.label}
            </Link>
          ) : null}
        </div>
        <div className="portal-card portal-card--celebrate">
          <h3>Remaining balance</h3>
          <p className="portal-stat-val">{formatCurrency(remaining)}</p>
          <Link to={PORTAL_ROUTES.payments} className="portal-btn portal-btn--secondary" style={{ marginTop: 10, fontSize: 12 }}>
            View payments
          </Link>
        </div>
        <div className="portal-card">
          <h3>Coordinator</h3>
          <p style={{ margin: 0, fontWeight: 600 }}>{PORTAL_DEMO_EVENT.coordinator.name}</p>
          <p style={{ fontSize: 12, color: 'var(--portal-muted)', margin: '4px 0 0' }}>{PORTAL_DEMO_EVENT.coordinator.email}</p>
          <Link to={PORTAL_ROUTES.messages} className="portal-btn portal-btn--ghost" style={{ marginTop: 10, fontSize: 12 }}>
            Message
          </Link>
        </div>
      </div>

      {risks.length > 0 ? (
        <div className="portal-card portal-card--flat" style={{ marginBottom: 20 }}>
          <h3>Smart deadlines</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {risks.map((r, i) => (
              <li key={i} style={{ color: 'var(--portal-warn)' }}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="portal-grid-2" style={{ marginBottom: 20 }}>
        <div className="portal-card portal-card--flat">
          <h3>Agreement</h3>
          <p style={{ margin: 0, fontSize: 14 }}>{event.agreementStatus === 'signed' ? 'Signed ✓' : 'Action needed'}</p>
          <Link to={PORTAL_ROUTES.documents}>Documents →</Link>
        </div>
        <div className="portal-card portal-card--flat">
          <h3>Weather watch</h3>
          <p style={{ margin: 0, fontSize: 14 }}>{PORTAL_DEMO_EVENT.weatherWatch}</p>
        </div>
      </div>

      <ConciergePanel limit={2} />

      <p className="portal-section-title">Quick links</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Link to={PORTAL_ROUTES.event(PORTAL_DEMO_EVENT.id)} className="portal-btn portal-btn--primary">
          Event workspace
        </Link>
        <Link to={PORTAL_ROUTES.timeline} className="portal-btn portal-btn--secondary">
          Timeline
        </Link>
        <Link to={PORTAL_ROUTES.guests} className="portal-btn portal-btn--ghost">
          Guests
        </Link>
      </div>
    </>
  );
}
