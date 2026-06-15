import { useState } from 'react';
import type { MarketingBlastChannel } from '@hub-crm/shared';
import { useMarketingBlastsStore } from '../store/marketingBlastsStore.js';
import { useAppStore } from '../store/index.js';
import PageIntro from '../components/layout/PageIntro.js';

const AUDIENCE_PLACEHOLDERS = [
  'All leads',
  'Confirmed events — 30 days out',
  'Past clients — 12 months',
  'Prospect list — manual segment',
  'Referral program participants',
];

export default function MarketingBlastsPage({ embedded = false }: { embedded?: boolean }) {
  const user = useAppStore(s => s.user);
  const drafts = useMarketingBlastsStore(s => s.drafts);
  const createDraft = useMarketingBlastsStore(s => s.createDraft);
  const removeDraft = useMarketingBlastsStore(s => s.removeDraft);

  const [name, setName] = useState('');
  const [audience, setAudience] = useState(AUDIENCE_PLACEHOLDERS[0]!);
  const [channels, setChannels] = useState<MarketingBlastChannel[]>(['email']);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const toggleChannel = (ch: MarketingBlastChannel) => {
    setChannels(prev => (prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createDraft({
      name: name.trim(),
      audienceSource: audience,
      channels: channels.length ? channels : ['email'],
      subject: subject.trim(),
      body: body.trim(),
      createdBy: user?.name ?? 'Admin',
      createdByEmail: user?.email ?? '',
    });
    setName('');
    setSubject('');
    setBody('');
  };

  return (
    <div className={embedded ? 'marketing-embedded' : 'page-simple'}>
      {!embedded && (
        <PageIntro
          title="Marketing"
          subtitle="Draft-only campaigns. Sending disabled until approved."
        />
      )}

      <p className="helper-banner">
        <strong>Draft campaigns.</strong> Sending is not enabled yet — review drafts before anything goes out.
      </p>

      <form className="card page-section" onSubmit={handleCreate}>
        <h2 className="page-section__title">New draft</h2>
        <div className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Draft name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="June availability spotlight" />
          </div>
          <div className="form-group">
            <label className="form-label">Audience</label>
            <select className="form-select" value={audience} onChange={e => setAudience(e.target.value)}>
              {AUDIENCE_PLACEHOLDERS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Channels</label>
          <div className="channel-checkboxes">
            {(['email', 'sms'] as const).map(ch => (
              <label key={ch}>
                <input type="checkbox" checked={channels.includes(ch)} onChange={() => toggleChannel(ch)} />
                {ch.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Subject</label>
          <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your summer event at HuB on Lewis" />
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-textarea" rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Draft message…" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={!name.trim()}>
          Save draft
        </button>
      </form>

      <div className="card page-section">
        <h2 className="page-section__title">Saved drafts ({drafts.length})</h2>
        {drafts.length === 0 ? (
          <p className="empty-hint">No drafts yet. Create one when you are ready to review copy with the team.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Audience</th>
                <th>Channels</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map(d => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                    {d.subject ? <div className="text-sm text-muted">{d.subject}</div> : null}
                  </td>
                  <td className="text-sm">{d.audienceSource}</td>
                  <td className="text-sm">{d.channels.map(c => c.toUpperCase()).join(', ')}</td>
                  <td><span className="badge badge-quoted">Draft</span></td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDraft(d.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
