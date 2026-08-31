import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoadingState from '../../components/crm/LoadingState.js';
import LiveModuleTable, { EventLink, MoneyCell, StatusCell } from '../../components/live/LiveModuleTable.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { generateInboxActivity, type InboxActivityItem } from '../../lib/liveEventHelpers.js';
import { enhanceWithLlm, fetchAiStatus } from '../../intelligence/ai/provider.js';
import { useInboxTriage } from '../../hooks/useInboxTriage.js';


export default function LiveInboxPage() {
  const navigate = useNavigate();
  const { rows, isLoading, isError } = useLiveCrmEvents();
  const { data: aiStatus } = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => fetchAiStatus(false),
    staleTime: 30_000,
    retry: false,
  });
  const { data: triage } = useInboxTriage();
  const aiOnline = Boolean(aiStatus?.enabled && aiStatus?.configured && !aiStatus.offline);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [draftError, setDraftError] = useState<string | null>(null);

  const items = useMemo(() => generateInboxActivity(rows), [rows]);
  const go = (eventId: string) => navigate(`/deals/${eventId}`);

  const handleDraft = async (item: InboxActivityItem) => {
    if (!aiOnline) return;
    setDraftingId(item.id);
    setDraftError(null);
    try {
      const result = await enhanceWithLlm({
        kind: 'inbox_reply',
        input: `Draft a short follow-up for this venue activity.\nReason: ${item.reason}\nEvent: ${item.eventTitle}\nContact: ${item.contact}\nStatus: ${item.statusLabel}\nValue: ${item.value}\nBalance due: ${item.balanceDue}`,
        context: `HuB on Lewis operational inbox. Date: ${item.dateDisplay}`,
      });
      if (result.error && !result.enhanced) setDraftError(result.error);
      setDraftById(prev => ({
        ...prev,
        [item.id]: result.enhanced ? result.output : result.error ? `Could not enhance: ${result.error}` : result.output,
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
          <h1 className="hub-admin-page__title">Inbox</h1>
          <p className="hub-admin-page__subtitle">
            Event-linked triage — unanswered portal messages, unsigned proposals, unpaid deposits.
            Same objects as the guest portal. Email send is stubbed until hubonlewis.com is connected.
          </p>
        </div>
      </header>

      {triage ? (
        <div className="inbox-triage-grid">
          <button type="button" className="inbox-triage-card" onClick={() => triage.unansweredMessages[0] && go(triage.unansweredMessages[0].eventId)}>
            <span>Unanswered messages</span>
            <strong>{triage.unansweredMessages.length}</strong>
            <em>{triage.unansweredMessages[0]?.preview ?? 'All threads have a staff reply'}</em>
          </button>
          <button type="button" className="inbox-triage-card" onClick={() => triage.unsignedProposals[0] && go(triage.unsignedProposals[0].eventId)}>
            <span>Unsigned proposals</span>
            <strong>{triage.unsignedProposals.length}</strong>
            <em>{triage.unsignedProposals[0] ? `${triage.unsignedProposals[0].eventTitle} v${triage.unsignedProposals[0].version}` : 'No proposals waiting'}</em>
          </button>
          <button type="button" className="inbox-triage-card" onClick={() => triage.unpaidDeposits[0] && go(triage.unpaidDeposits[0].eventId)}>
            <span>Unpaid deposits</span>
            <strong>{triage.unpaidDeposits.length}</strong>
            <em>{triage.unpaidDeposits[0]?.eventTitle ?? 'No deposits outstanding'}</em>
          </button>
          <div className="inbox-triage-card">
            <span>Outbox</span>
            <strong>{(triage.drafts?.length ?? 0) + (triage.scheduled?.length ?? 0)}</strong>
            <em>Drafts + scheduled — provider stub, nothing sends</em>
          </div>
        </div>
      ) : null}

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
                    <pre className="text-sm" style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--surface-2, #f6f5f2)', padding: 8, borderRadius: 6, maxWidth: 420 }}>
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
                  {aiOnline ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={draftingId === r.id} onClick={() => void handleDraft(r)}>
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
