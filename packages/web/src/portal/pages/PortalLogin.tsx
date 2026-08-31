import { useEffect, useRef, useState } from 'react';
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
  const openAccessToken = usePortalStore(s => s.openAccessToken);
  const [eventId, setEventId] = useState(() => searchParams.get('event') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const invitedEventId = searchParams.get('event');
  const accessToken = searchParams.get('access');
  const payToken = searchParams.get('pay');

  const finish = (ok: boolean, message?: string) => {
    if (!ok) {
      setError(message ?? 'This event could not be opened.');
      setBusy(false);
      return;
    }
    navigate(payToken ? PORTAL_ROUTES.payments : PORTAL_ROUTES.dashboard, { replace: true });
  };

  useEffect(() => {
    const q = searchParams.get('event');
    if (q) setEventId(q);
  }, [searchParams]);

  useEffect(() => {
    if (autoTried.current) return;
    if (accessToken) {
      autoTried.current = true;
      setBusy(true);
      void openAccessToken(accessToken).then(r => finish(r.ok, r.message));
      return;
    }
    const q = invitedEventId || (isScreenshotMode() ? 'demo' : '');
    if (!q) {
      if (session && !invitedEventId) {
        navigate(PORTAL_ROUTES.dashboard, { replace: true });
      }
      return;
    }
    autoTried.current = true;
    setBusy(true);
    void openEvent(q).then(r => finish(r.ok, r.message));
    // Auto-open shared coordinator links once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedEventId, accessToken]);

  const enterPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const raw = eventId.trim() || 'demo';
      const r =
        raw.includes('.') && raw.length > 24
          ? await openAccessToken(raw)
          : await openEvent(raw);
      finish(r.ok, r.message);
    } finally {
      if (!autoTried.current) setBusy(false);
    }
  };

  return (
    <div className="portal-login">
      <div className="portal-login__card">
        <BrandLogo size="lg" />
        <h1 className="portal-login__title">Your event portal</h1>
        <p className="portal-login__lede">
          {accessToken || invitedEventId
            ? payToken
              ? 'Opening your payment page…'
              : 'Opening your event — plan, pay, and prepare with confidence.'
            : 'HuB on Lewis · plan, pay, and prepare with confidence'}
        </p>

        {(accessToken || invitedEventId) && busy && !error ? (
          <p className="portal-login__status">Connecting you to your booking…</p>
        ) : (
          <>
            <label className="form-label" style={{ display: 'block', textAlign: 'left', marginBottom: 6 }}>
              Event access
            </label>
            <input
              className="form-input"
              style={{ marginBottom: 12, width: '100%' }}
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              placeholder="Access code from your coordinator"
              autoComplete="off"
            />

            {error ? <p className="portal-login__error">{error}</p> : null}

            <button
              type="button"
              className="portal-btn portal-btn--primary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => void enterPortal()}
            >
              {busy ? 'Opening…' : 'Open my event'}
            </button>
            <p className="portal-login__hint">
              Your coordinator sends a private link. You can also enter the access code they shared.
            </p>
          </>
        )}

        {error && (accessToken || invitedEventId) ? (
          <button
            type="button"
            className="portal-btn portal-btn--secondary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              autoTried.current = false;
              setError(null);
              setBusy(true);
              if (accessToken) {
                void openAccessToken(accessToken).then(r => finish(r.ok, r.message));
              } else {
                void enterPortal();
              }
            }}
          >
            Try again
          </button>
        ) : null}

        <a href="/dashboard" className="portal-login__staff">
          ← Venue team login
        </a>
      </div>
    </div>
  );
}
