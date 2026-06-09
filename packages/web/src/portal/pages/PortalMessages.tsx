import { useState } from 'react';
import { usePortalStore } from '../portalStore.js';
import { PORTAL_DEMO_EVENT } from '../demoData.js';

export default function PortalMessages() {
  const messages = usePortalStore(s => s.event.messages);
  const sendMessage = usePortalStore(s => s.sendMessage);
  const [draft, setDraft] = useState('');

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 8px' }}>Messages</h1>
      <p style={{ color: 'var(--portal-muted)', margin: '0 0 16px' }}>
        Thread with {PORTAL_DEMO_EVENT.coordinator.name}
      </p>
      <div className="portal-card" style={{ minHeight: 280 }}>
        {messages.map(m => (
          <div key={m.id} className={`portal-msg portal-msg--${m.role === 'client' ? 'client' : 'coord'}`}>
            <strong style={{ fontSize: 11 }}>{m.from}</strong>
            <p style={{ margin: '4px 0 0' }}>{m.body}</p>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{m.at}</span>
          </div>
        ))}
      </div>
      <form
        style={{ display: 'flex', gap: 8, marginTop: 12 }}
        onSubmit={e => {
          e.preventDefault();
          sendMessage(draft);
          setDraft('');
        }}
      >
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder="Ask your coordinator…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <button type="submit" className="portal-btn portal-btn--primary">
          Send
        </button>
      </form>
    </>
  );
}
