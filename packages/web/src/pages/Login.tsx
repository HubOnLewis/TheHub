import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client, { getApiConfigError } from '../api/client.js';
import { getApiNetworkErrorMessage } from '../config/apiBaseUrl.js';
import { BRAND } from '../branding/tokens.js';
import BrandLoader from '../components/BrandLoader.js';
import BrandLogo from '../components/BrandLogo.js';
import { useAppStore, type AppUser } from '../store/index.js';
import { isScreenshotMode } from '../config/screenshotMode.js';
import { getScreenshotDemoUser, SCREENSHOT_DEMO_TOKEN } from '../config/screenshotSession.js';
import LegalFooterLinks from '../components/LegalFooterLinks.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enteringDemo, setEnteringDemo] = useState(false);
  const { login, user } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isScreenshotMode()) return;
    if (user) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setEnteringDemo(true);
    login(getScreenshotDemoUser(), SCREENSHOT_DEMO_TOKEN);
    navigate('/dashboard', { replace: true });
  }, [user, login, navigate]);

  const enterDemoWorkspace = () => {
    setError('');
    setEnteringDemo(true);
    login(getScreenshotDemoUser(), SCREENSHOT_DEMO_TOKEN);
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isScreenshotMode()) {
      enterDemoWorkspace();
      return;
    }
    const configErr = getApiConfigError();
    if (configErr) {
      setError(configErr);
      return;
    }
    setLoading(true);
    try {
      const { data } = await client.post<{ token: string; user: AppUser }>('/auth/login', { email, password });
      login(data.user!, data.token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string } };
        message?: string;
        code?: string;
      };
      const apiErr = ax.response?.data?.error;
      const network =
        ax.code === 'ECONNABORTED' ||
        ax.message === 'Network Error' ||
        (typeof ax.message === 'string' && ax.message.includes('Network'));
      const msg =
        apiErr ??
        (network ? getApiNetworkErrorMessage() : ax.message ?? 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (enteringDemo && isScreenshotMode()) {
    return <BrandLoader message="Opening client review workspace…" showStatusRotation={false} />;
  }

  return (
    <div className={`login-page${loading ? ' login-page--loading' : ''}`}>
      <section className="login-page__brand-panel" aria-hidden={false}>
        <div className="login-page__brand-inner">
          <BrandLogo size="hero" className="login-page__logo" />
          <p className="login-page__tagline">{BRAND.tagline}</p>
          <p className="login-page__location">
            {BRAND.venueName} · {BRAND.venueLocation}
          </p>
        </div>
      </section>

      <section className="login-page__form-panel">
        {loading && (
          <BrandLoader variant="overlay" message="Signing in…" showStatusRotation={false} />
        )}
        <div className="login-card">
          <p className="login-card__eyebrow">{BRAND.productName}</p>
          <h1 className="login-card__title">Sign in</h1>
          <p className="login-card__sub">Access your venue workspace</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--red-muted)',
                  color: 'var(--red)',
                  border: '1px solid rgba(225, 29, 72, 0.35)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            {isScreenshotMode() && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 10 }}
                onClick={enterDemoWorkspace}
              >
                Enter client review workspace
              </button>
            )}
          </form>
          <LegalFooterLinks className="login-card__legal" />
        </div>
      </section>
    </div>
  );
}
