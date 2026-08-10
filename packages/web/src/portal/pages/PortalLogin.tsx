import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo.js';
import { isScreenshotMode } from '../../config/screenshotMode.js';
import { PORTAL_ROUTES } from '../paths.js';
import { usePortalStore } from '../portalStore.js';

export default function PortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = usePortalStore(s => s.session);
  const openEvent = usePortalStore(s => s.openEvent);
  const [eventId, setEventId] = useState(() => searchParams.get('event') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = searchParams.get('event');
    if (q) setEventId(q);
  }, [searchParams]);

  useEffect(() => {
    if (session) {
      navigate(PORTAL_ROUTES.dashboard, { replace: true });
    }
  }, [session, navigate]);

  // Screenshot auto-open: prefer ?event=, else demo
  useEffect(() => {
    if (!isScreenshotMode() || session) return;
    const q = searchParams.get('event') || 'demo';
    void openEvent(q).then(r => {
      if (r.ok) navigate(PORTAL_ROUTES.dashboard, { replace: true });
    });
  }, [session, openEvent, navigate, searchParams]);

  const enterPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await openEvent(eventId.trim() || 'demo');
      if (!r.ok) {
        setError(r.message);
        return;
      }
      navigate(PORTAL_ROUTES.dashboard);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-login">
      <div className="portal-login__card">
        <BrandLogo size="lg" />
        <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 24, margin: '0 0 8px' }}>
          Your event portal
        </h1>
        <p style={{ color: 'var(--portal-muted)', fontSize: 14, margin: '0 0 24px' }}>
          HuB on Lewis · plan, pay, and prepare with confidence
        </p>

        <label className="form-label" style={{ display: 'block', textAlign: 'left', marginBottom: 6 }}>
          Event access code / ID
        </label>
        <input
          className="form-input"
          style={{ marginBottom: 12, width: '100%' }}
          value={eventId}
          onChange={e => setEventId(e.target.value)}
          placeholder="Paste link code from your coordinator (or leave blank for demo)"
          autoComplete="off"
        />

        {error ? (
          <p style={{ color: 'var(--status-lost, #b42318)', fontSize: 13, marginBottom: 12 }}>{error}</p>
        ) : null}

        <button
          type="button"
          className="portal-btn portal-btn--primary"
          style={{ width: '100%' }}
          disabled={busy}
          onClick={() => void enterPortal()}
        >
          {busy ? 'Opening…' : 'Open my event'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--portal-muted)', marginTop: 16 }}>
          Production uses secure email links. For now, your coordinator shares an event access code.
        </p>
        <a href="/dashboard" style={{ display: 'block', marginTop: 20, fontSize: 12, color: 'var(--portal-muted)' }}>
          ← Venue team login
        </a>
      </div>
    </div>
  );
}
