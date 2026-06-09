import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo.js';
import { isScreenshotMode } from '../../config/screenshotMode.js';
import { PORTAL_ROUTES } from '../paths.js';
import { PORTAL_DEMO_SESSION, usePortalStore } from '../portalStore.js';

export default function PortalLogin() {
  const navigate = useNavigate();
  const login = usePortalStore(s => s.login);
  const session = usePortalStore(s => s.session);

  useEffect(() => {
    if (session) {
      navigate(PORTAL_ROUTES.dashboard, { replace: true });
      return;
    }
    if (isScreenshotMode()) {
      login(PORTAL_DEMO_SESSION.user);
      navigate(PORTAL_ROUTES.dashboard, { replace: true });
    }
  }, [session, login, navigate]);

  const enterPortal = () => {
    login(PORTAL_DEMO_SESSION.user);
    navigate(PORTAL_ROUTES.dashboard);
  };

  return (
    <div className="portal-login">
      <div className="portal-login__card">
        <BrandLogo size="lg" />
        <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 24, margin: '0 0 8px' }}>Your event portal</h1>
        <p style={{ color: 'var(--portal-muted)', fontSize: 14, margin: '0 0 24px' }}>
          HuB on Lewis · plan, pay, and prepare with confidence
        </p>
        <button type="button" className="portal-btn portal-btn--primary" style={{ width: '100%' }} onClick={enterPortal}>
          Open my event
        </button>
        <p style={{ fontSize: 11, color: 'var(--portal-muted)', marginTop: 16 }}>
          Demo: magic-link invite flow · production will use secure email links
        </p>
        <a href="/dashboard" style={{ display: 'block', marginTop: 20, fontSize: 12, color: 'var(--portal-muted)' }}>
          ← Venue team login
        </a>
      </div>
    </div>
  );
}
