import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell, StatusCell } from '../../components/live/LiveModuleTable.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { generateInboxActivity, type InboxActivityItem } from '../../lib/liveEventHelpers.js';
import { enhanceWithLlm } from '../../intelligence/ai/provider.js';
import { isAiClientHintEnabled } from '../../intelligence/ai/config.js';

export default function LiveInboxPage() {
  const navigate = useNavigate();
  const { rows, isLoading, isError } = useLiveCrmEvents();
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [draftError, setDraftError] = useState<string | null>(null);

  const items = useMemo(() => generateInboxActivity(rows), [rows]);

  const handleDraft = async (item: InboxActivityItem) => {
    if (!isAiClientHintEnabled()) return;
    setDraftingId(item.id);
    setDraftError(null);
    try {
      const result = await enhanceWithLlm({
        kind: 'inbox_reply',
        input: `Draft a short follow-up for this venue activity.\nReason: ${item.reason}\nEvent: ${item.eventTitle}\nContact: ${item.contact}\nStatus: ${item.statusLabel}\nValue: ${item.value}\nBalance due: ${item.balanceDue}`,
        context: `HuB on Lewis operational inbox. Date: ${item.dateDisplay}`,
      });
      if (result.error && !result.enhanced) {
        setDraftError(result.error);
      }
      setDraftById(prev => ({
        ...prev,
        [item.id]: result.enhanced ? result.output : result.error
          ? `Could not enhance: ${result.error}`
          : result.output,
      }));
    } finally {
      setDraftingId(null);
    }
  };

  if (isLoading) return <LoadingState message="Loading activity…" />;

  return (
    <div className="hub-live-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Activity</h1>
          <p className="hub-admin-page__subtitle">
            What needs follow-up from your pipeline — balances, proposals, upcoming prep.
            {isAiClientHintEnabled()
              ? ' AI can draft replies (Settings → Integrations). Nothing sends without you.'
              : ' Connect AI in Settings for one-click drafts.'}
          </p>
        </div>
        <span className="hub-admin-stat-pill">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </header>

      {draftError ? (
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
          AI draft issue: {draftError}
        </p>
      ) : null}

      {isError ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load activity</p>
          <p className="text-muted text-sm">Try refreshing the page.</p>
        </div>
      ) : (
        <LiveModuleTable
          rows={items}
          rowKey={r => r.id}
          emptyTitle="No activity items right now"
          emptyHint="New proposals, balance-due events, and upcoming bookings will appear here."
          columns={[
            {
              key: 'reason',
              header: 'Activity',
              render: (r: InboxActivityItem) => (
                <div>
                  <strong>{r.reason}</strong>
                  <div className="text-muted text-sm">{r.dateDisplay}</div>
                  {draftById[r.id] ? (
                    <pre
                      className="text-sm"
                      style={{
                        marginTop: 8,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        background: 'var(--surface-2, #f6f5f2)',
                        padding: 8,
                        borderRadius: 6,
                        maxWidth: 420,
                      }}
                    >
                      {draftById[r.id]}
                    </pre>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'event',
              header: 'Event',
              render: (r: InboxActivityItem) => <EventLink href={r.href} title={r.eventTitle} subtitle={r.contact} />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r: InboxActivityItem) => <StatusCell label={r.statusLabel} />,
            },
            {
              key: 'value',
              header: 'Value',
              className: 'crm-events-table__col--num',
              render: (r: InboxActivityItem) => <MoneyCell amount={r.value} />,
            },
            {
              key: 'balance',
              header: 'Balance Due',
              className: 'crm-events-table__col--num',
              render: (r: InboxActivityItem) => (r.balanceDue > 0 ? <MoneyCell amount={r.balanceDue} /> : '—'),
            },
            {
              key: 'open',
              header: '',
              className: 'crm-events-table__col--actions',
              render: (r: InboxActivityItem) => (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {isAiClientHintEnabled() ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={draftingId === r.id}
                      onClick={() => void handleDraft(r)}
                    >
                      {draftingId === r.id ? 'Drafting…' : 'AI draft'}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(r.href)}>
                    Open
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
