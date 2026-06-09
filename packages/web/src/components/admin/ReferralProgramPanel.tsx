import { useMemo, useState } from 'react';
import type { ReferralIncentiveType } from '@hub-crm/shared';
import { useReferralsStore } from '../../store/referralsStore.js';

function referralUrl(code: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/r/${encodeURIComponent(code)}`;
  }
  return `/r/${encodeURIComponent(code)}`;
}

export default function ReferralProgramPanel() {
  const links = useReferralsStore(s => s.links);
  const addLink = useReferralsStore(s => s.addLink);
  const [referrerName, setReferrerName] = useState('');
  const [referrerEmail, setReferrerEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [incentiveType, setIncentiveType] = useState<ReferralIncentiveType>('discount');
  const [targetUrl, setTargetUrl] = useState('/login');
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referrerName.trim() || !referralCode.trim()) return;
    addLink({
      referralCode: referralCode.trim(),
      referrerName: referrerName.trim(),
      referrerEmail: referrerEmail.trim() || undefined,
      incentiveType,
      targetUrl: targetUrl.trim() || '/login',
    });
    setReferrerName('');
    setReferrerEmail('');
    setReferralCode('');
  };

  const copyUrl = async (code: string) => {
    try {
      await navigator.clipboard.writeText(referralUrl(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const totals = useMemo(() => ({
    clicks: links.reduce((n, l) => n + l.clickCount, 0),
    conversions: links.reduce((n, l) => n + l.conversionCount, 0),
  }), [links]);

  return (
    <div className="referral-program-panel">
      <p className="helper-banner">
        <strong>Referral tracking foundation.</strong> Incentive terms are configurable. Payouts are not automatic.
      </p>

      <div className="settings-grid-2 page-section">
        <div className="card settings-stat-card">
          <div className="settings-stat-card__label">Clicks</div>
          <div className="settings-stat-card__value">{totals.clicks}</div>
        </div>
        <div className="card settings-stat-card">
          <div className="settings-stat-card__label">Conversions</div>
          <div className="settings-stat-card__value">{totals.conversions}</div>
        </div>
      </div>

      <form className="card page-section" onSubmit={handleCreate}>
        <h2 className="page-section__title">Create link</h2>
        <div className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Referrer name</label>
            <input className="form-input" value={referrerName} onChange={e => setReferrerName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Referral code</label>
            <input className="form-input" value={referralCode} onChange={e => setReferralCode(e.target.value)} required placeholder="HUB-PARTNER-01" />
          </div>
          <div className="form-group">
            <label className="form-label">Incentive</label>
            <select className="form-select" value={incentiveType} onChange={e => setIncentiveType(e.target.value as ReferralIncentiveType)}>
              <option value="cash">Cash</option>
              <option value="discount">Discount</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Landing page</label>
            <input className="form-input" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="/login" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Create link</button>
      </form>

      {links.length > 0 ? (
        <div className="card page-section">
          <h2 className="page-section__title">Active links</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Referrer</th>
                <th>Clicks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id}>
                  <td><code>{l.referralCode}</code></td>
                  <td>{l.referrerName}</td>
                  <td>{l.clickCount}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyUrl(l.referralCode)}>
                      {copied === l.referralCode ? 'Copied' : 'Copy link'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-hint">No referral links yet.</p>
      )}
    </div>
  );
}
