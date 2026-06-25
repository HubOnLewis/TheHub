import { useEffect, useMemo } from 'react';
import { DEMO_INBOX_MESSAGES } from '../data/demoVenue.js';
import EmbeddedAgentPanel from '../components/agents/EmbeddedAgentPanel.js';
import { INBOX_INSIGHTS } from '../data/embeddedAgentInsights.js';
import { useDemoOpsStore } from '../state/demoOpsStore.js';

const TEMPLATES = [
  { key: 'inquiry', label: 'Initial inquiry response' },
  { key: 'proposal', label: 'Proposal follow-up' },
  { key: 'deposit', label: 'Deposit reminder' },
  { key: 'balance', label: 'Final balance reminder' },
  { key: 'thanks', label: 'Thank-you / review request' },
] as const;

export default function InboxPage() {
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const inbox = useDemoOpsStore(s => s.inbox);
  const selectInbox = useDemoOpsStore(s => s.selectInbox);
  const toggleInboxRead = useDemoOpsStore(s => s.toggleInboxRead);
  const generateInboxReply = useDemoOpsStore(s => s.generateInboxReply);
  const queueInboxDraft = useDemoOpsStore(s => s.queueInboxDraft);
  const createTaskFromInbox = useDemoOpsStore(s => s.createTaskFromInbox);

  useEffect(() => {
    ensureInitialized();
    if (!inbox.selectedId && DEMO_INBOX_MESSAGES[0]) {
      selectInbox(DEMO_INBOX_MESSAGES[0].id);
    }
  }, [ensureInitialized, inbox.selectedId, selectInbox]);

  const selected = useMemo(
    () => DEMO_INBOX_MESSAGES.find(m => m.id === inbox.selectedId) ?? DEMO_INBOX_MESSAGES[0],
    [inbox.selectedId],
  );

  const unread = DEMO_INBOX_MESSAGES.filter(m => {
    const read = inbox.read[m.id];
    return read === undefined ? m.unread : !read;
  }).length;

  const draft = selected ? inbox.drafts[selected.id] : undefined;
  const queued = selected ? inbox.draftQueued[selected.id] : false;

  return (
    <div className="command-page hub-inbox-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Inbox</h1>
          <p className="hub-admin-page__subtitle">
            Client conversations and follow-ups — {unread} thread{unread === 1 ? '' : 's'} awaiting a reply.
          </p>
        </div>
        <div className="inbox-toolbar">
          <span className="inbox-stat-pill">{DEMO_INBOX_MESSAGES.length} threads</span>
          <span className="inbox-stat-pill inbox-stat-pill--accent">{unread} need reply</span>
        </div>
      </header>

      <div className="inbox-command-layout">
        <div className="inbox-command-list card">
          {DEMO_INBOX_MESSAGES.map(row => {
            const isRead = inbox.read[row.id] !== undefined ? inbox.read[row.id] : !row.unread;
            const active = row.id === selected?.id;
            return (
              <button
                key={row.id}
                type="button"
                className={`inbox-row inbox-row--btn${!isRead ? ' inbox-row--unread' : ''}${active ? ' inbox-row--active' : ''}`}
                onClick={() => selectInbox(row.id)}
              >
                <div className="inbox-row__top">
                  <span className="inbox-channel">{row.channel}</span>
                  <span className="inbox-time">{row.time}</span>
                </div>
                <div className="inbox-row__from">
                  <strong>{row.from}</strong>
                  <span className="inbox-org">{row.org}</span>
                </div>
                <div className="inbox-subject">{row.subject}</div>
                <div className="inbox-preview">{row.preview}</div>
              </button>
            );
          })}
        </div>

        {selected ? (
          <aside className="inbox-command-detail card">
            <div className="inbox-detail__head">
              <h2>{selected.subject}</h2>
              <p className="inbox-detail__meta">
                {selected.org} · {selected.from}
              </p>
              <div className="inbox-detail__actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleInboxRead(selected.id)}>
                  Mark {inbox.read[selected.id] === false ? 'unread' : 'read'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => createTaskFromInbox(selected.id, selected.subject)}
                >
                  Create follow-up task
                </button>
              </div>
            </div>
            <div className="inbox-detail__thread">
              <p>{selected.preview}</p>
              <p className="inbox-detail__note">Message preview — full thread available when email is connected.</p>
            </div>

            <EmbeddedAgentPanel title="Assistant insights" insights={INBOX_INSIGHTS} compact />

            <div className="inbox-detail__compose">
              <h3>Draft response</h3>
              <p className="inbox-detail__hint" style={{ marginTop: 0 }}>
                Suggested next action — choose a template to generate a draft. Approval required before sending.
              </p>
              <div className="inbox-template-row">
                {TEMPLATES.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => generateInboxReply(selected.id, t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {draft ? (
                <textarea className="form-textarea inbox-draft-area" rows={6} readOnly value={draft} />
              ) : (
                <p className="inbox-detail__hint">Select a template above to generate a draft response.</p>
              )}
              <div className="inbox-detail__compose-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!draft}
                  onClick={() => {
                    if (draft) navigator.clipboard?.writeText(draft);
                  }}
                >
                  Copy draft
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!draft || queued}
                  onClick={() => queueInboxDraft(selected.id)}
                >
                  {queued ? 'Queued for approval' : 'Queue for approval'}
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
