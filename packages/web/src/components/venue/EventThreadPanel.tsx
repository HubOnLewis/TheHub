import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuestPortalMessage } from '@hub-crm/shared';
import client from '../../api/client.js';

type Props = {
  eventId: string;
  coordinatorName?: string;
  disabled?: boolean;
};

const TEMPLATES = [
  { key: 'inquiry', label: 'Inquiry reply' },
  { key: 'proposal', label: 'Proposal follow-up' },
  { key: 'deposit', label: 'Deposit reminder' },
  { key: 'balance', label: 'Balance reminder' },
  { key: 'thanks', label: 'Thank you' },
] as const;

export default function EventThreadPanel({ eventId, coordinatorName, disabled }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [channel, setChannel] = useState<'portal' | 'email'>('portal');
  const [asDraft, setAsDraft] = useState(false);
  const [schedule, setSchedule] = useState('');

  const { data: thread = [], isFetching } = useQuery({
    queryKey: ['comms', eventId],
    queryFn: async () => {
      const { data } = await client.get<{ data: GuestPortalMessage[] }>('/comms', { params: { eventId } });
      return data.data ?? [];
    },
    enabled: Boolean(eventId) && !disabled,
    retry: false,
  });

  const sendMut = useMutation({
    mutationFn: (input: {
      body: string;
      channel: 'portal' | 'email';
      templateKey?: string;
      asDraft?: boolean;
      scheduledAt?: string;
    }) => client.post('/comms', { eventId, ...input }).then(r => r.data),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['comms', eventId] });
      await qc.invalidateQueries({ queryKey: ['deals', eventId, 'interactions'] });
      await qc.invalidateQueries({ queryKey: ['comms', 'inbox'] });
      setDraft('');
      setMsg(
        vars.asDraft
          ? 'Draft saved on the event thread.'
          : vars.scheduledAt
            ? 'Queued in the outbox (not sent — email provider is a stub).'
            : vars.channel === 'email'
              ? 'Logged on the thread. Email provider is stubbed — nothing left the building.'
              : 'Posted to the guest portal thread.',
      );
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setMsg(ax.response?.data?.error ?? ax.message ?? 'Could not post');
    },
  });

  const unanswered = useMemo(() => {
    let lastGuest = -1;
    let lastStaff = -1;
    thread.forEach((m, i) => {
      if (m.role === 'client') lastGuest = i;
      else lastStaff = i;
    });
    return lastGuest > lastStaff;
  }, [thread]);

  return (
    <section className="event-thread-panel">
      <p className="text-muted text-sm">
        One thread with the guest — same conversation they see in the portal.
        {unanswered ? ' Guest is waiting on a reply.' : ''}
      </p>
      {isFetching ? <p className="text-muted text-sm">Refreshing thread…</p> : null}
      <div className="event-thread-list">
        {thread.length === 0 ? (
          <p className="text-muted text-sm">No messages yet. A note here appears in the client portal.</p>
        ) : (
          thread.map(m => (
            <article key={m.id} className={`event-thread-msg event-thread-msg--${m.role}`}>
              <header>
                <strong>{m.from}</strong>
                <span>
                  {m.channel}
                  {m.deliveryStatus ? ` · ${m.deliveryStatus}` : ''}
                </span>
              </header>
              <p>{m.body}</p>
              <time>{new Date(m.at).toLocaleString()}</time>
            </article>
          ))
        )}
      </div>
      <div className="event-thread-compose">
        <div className="event-thread-templates">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={disabled || sendMut.isPending}
              onClick={() => {
                setDraft(prev => prev || `(${t.label} — edit before sending)`);
                sendMut.mutate({ body: draft || t.label, channel, templateKey: t.key, asDraft: true });
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          className="form-textarea"
          rows={4}
          placeholder={`Message as ${coordinatorName || 'coordinator'}…`}
          value={draft}
          disabled={disabled}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="event-thread-actions">
          <label className="event-thread-channel">
            <input
              type="radio"
              name="channel"
              checked={channel === 'portal'}
              onChange={() => setChannel('portal')}
            />
            Portal
          </label>
          <label className="event-thread-channel">
            <input
              type="radio"
              name="channel"
              checked={channel === 'email'}
              onChange={() => setChannel('email')}
            />
            Email (stub)
          </label>
          <label className="event-thread-channel">
            <input type="checkbox" checked={asDraft} onChange={e => setAsDraft(e.target.checked)} />
            Draft
          </label>
          <input
            type="datetime-local"
            className="form-input"
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            title="Schedule outbox"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || sendMut.isPending || !draft.trim()}
            onClick={() =>
              sendMut.mutate({
                body: draft,
                channel,
                asDraft,
                scheduledAt: schedule ? new Date(schedule).toISOString() : undefined,
              })
            }
          >
            {asDraft ? 'Save draft' : schedule ? 'Queue outbox' : channel === 'email' ? 'Log email' : 'Post to portal'}
          </button>
        </div>
        {msg ? <p className="event-thread-msg-status" role="status">{msg}</p> : null}
      </div>
    </section>
  );
}
