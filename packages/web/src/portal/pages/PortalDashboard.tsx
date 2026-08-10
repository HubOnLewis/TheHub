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
          {profile.source === 'crm' ? (
            <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 6 }}>
              Live booking · {profile.space} · {profile.guests || '—'} guests
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 6 }}>Demo event preview</p>
          )}
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
              <span className={`live-rail__cat live-rail__cat--${t.kind === 'payment' ? 'agent' : 'system'}`}>
                {t.kind}
              </span>
              <span className="live-rail__text">{t.title}</span>
            </div>
          ))}
        </div>
      </section>

      {nextChecklist ? (
        <div className="portal-card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>Up next</h3>
          <p style={{ margin: 0 }}>{nextChecklist.label}</p>
          <Link to={PORTAL_ROUTES.checklist} className="portal-btn portal-btn--secondary" style={{ marginTop: 12, display: 'inline-block' }}>
            Open checklist
          </Link>
        </div>
      ) : null}

      {risks.length > 0 ? (
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
          {risks[0]}
        </p>
      ) : null}

      <ConciergePanel />
    </>
  );
}
