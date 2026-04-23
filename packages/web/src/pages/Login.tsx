// packages/web/src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAppStore, type AppUser } from '../store/index.js';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }               = useAppStore();
  const navigate                = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post<{ token: string; user: AppUser }>('/auth/login', { email, password });
      login(data.user!, data.token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        className="card"
        style={{
          padding: '40px 36px',
          width: 'min(400px, 100%)',
          boxShadow: 'var(--shadow-lg)',
          background: 'linear-gradient(165deg, var(--surface) 0%, var(--surface-2) 100%)',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-cond)', fontSize: 28, fontWeight: 800, color: 'var(--red)', letterSpacing: '2px' }}>
            MTTE CORE
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@mtte.com"
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
        </form>
      </div>
    </div>
  );
}
