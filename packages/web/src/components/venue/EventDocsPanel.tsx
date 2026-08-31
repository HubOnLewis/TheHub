import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, type ProposalRecord } from '@hub-crm/shared';
import type { EventDetailViewModel } from '../../lib/eventDetail.js';
import { openVenueDocument, type VenueDocKind } from '../../venue/documentGenerator.js';
import client from '../../api/client.js';

type Props = {
  model: EventDetailViewModel;
};

const ACTIONS: Array<{ kind: VenueDocKind; title: string; blurb: string; audience: string }> = [
  {
    kind: 'proposal',
    title: 'Client proposal PDF',
    blurb: 'Print-ready proposal — guests accept the live version in the portal, not this PDF.',
    audience: 'guest',
  },
  {
    kind: 'beo',
    title: 'Staff BEO',
    blurb: 'Internal banquet event order with run-of-show and financial snapshot. Not shown to guests.',
    audience: 'staff',
  },
  {
    kind: 'invoice_summary',
    title: 'Payment summary',
    blurb: 'Paid vs balance for client or accounting. Guest portal shows the same ledger.',
    audience: 'guest',
  },
];

function statusLabel(status: string): string {
  switch (status) {
    case 'accepted':
      return 'Accepted by client';
    case 'viewed':
      return 'Viewed — unsigned';
    case 'sent':
      return 'Sent to portal';
    case 'declined':
      return 'Declined';
    case 'superseded':
      return 'Superseded';
    default:
      return 'Draft';
  }
}

export default function EventDocsPanel({ model }: Props) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data: proposals = [], isFetching } = useQuery({
    queryKey: ['proposals', model.id],
    queryFn: async () => {
      const { data } = await client.get<{ data: ProposalRecord[] }>('/proposals', { params: { eventId: model.id } });
      return data.data ?? [];
    },
    enabled: Boolean(model.id) && !model.isReferenceOnly,
    retry: false,
  });

  const latest = proposals[0];

  const createMut = useMutation({
    mutationFn: (send: boolean) =>
      client
        .post<ProposalRecord>('/proposals', {
          eventId: model.id,
          eventTitle: model.title,
          packageTotal: model.grandTotal ?? 0,
          space: model.space ?? undefined,
          eventDate: model.eventDateIso ?? undefined,
          guests: model.guests ?? undefined,
          send,
        })
        .then(r => r.data),
    onSuccess: async rec => {
      await qc.invalidateQueries({ queryKey: ['proposals', model.id] });
      await qc.invalidateQueries({ queryKey: ['deal', model.id] });
      setMsg(
        rec.status === 'sent'
          ? `Proposal v${rec.version} is live in the guest portal.`
          : `Draft v${rec.version} saved. Send when you are ready.`,
      );
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setMsg(ax.response?.data?.error ?? ax.message ?? 'Could not save proposal');
    },
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => client.patch<ProposalRecord>(`/proposals/${id}`, { send: true }).then(r => r.data),
    onSuccess: async rec => {
      await qc.invalidateQueries({ queryKey: ['proposals', model.id] });
      setMsg(`Proposal v${rec.version} sent to the guest portal.`);
    },
  });

  return (
    <section className="event-docs-panel">
      <p className="event-docs-panel__intro text-muted text-sm">
        The portal is source of truth for the guest proposal. PDF generate is a copy. Guest BEO is a simplified event
        sheet; staff BEO stays internal.
      </p>

      <div className="event-proposal-live">
        <div>
          <h3 className="event-docs-panel__sub" style={{ marginTop: 0 }}>
            Live proposal
          </h3>
          {latest ? (
            <p>
              <strong>v{latest.version}</strong> · {statusLabel(latest.status)}
              {latest.packageTotal ? ` · ${formatCurrency(latest.packageTotal)}` : ''}
              {latest.acceptedBy ? ` · signed by ${latest.acceptedBy}` : ''}
            </p>
          ) : (
            <p className="text-muted text-sm">No persisted proposal yet. Create one to track sent / viewed / accepted.</p>
          )}
          {isFetching ? <p className="text-muted text-sm">Refreshing…</p> : null}
        </div>
        <div className="event-proposal-live__actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={createMut.isPending || model.isReferenceOnly}
            onClick={() => createMut.mutate(true)}
          >
            Send to portal
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={createMut.isPending || model.isReferenceOnly}
            onClick={() => createMut.mutate(false)}
          >
            Save draft
          </button>
          {latest && latest.status === 'draft' ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={sendMut.isPending}
              onClick={() => sendMut.mutate(latest.id)}
            >
              Send draft
            </button>
          ) : null}
        </div>
      </div>
      {msg ? <p role="status">{msg}</p> : null}

      {proposals.length > 1 ? (
        <ul className="event-proposal-versions">
          {proposals.map(p => (
            <li key={p.id}>
              v{p.version} · {statusLabel(p.status)} · {new Date(p.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="event-docs-grid">
        {ACTIONS.map(a => (
          <button
            key={a.kind}
            type="button"
            className="event-docs-card"
            onClick={() => openVenueDocument(a.kind, model)}
          >
            <strong>{a.title}</strong>
            <span>{a.blurb}</span>
            <span className="event-docs-card__cta">{a.audience} · Generate →</span>
          </button>
        ))}
      </div>

      <h3 className="event-docs-panel__sub">On file</h3>
      <ul className="event-docs-checklist">
        {model.documents.map(d => (
          <li key={d.key} className={d.onFile ? 'is-onfile' : ''}>
            <span className="event-docs-check" aria-hidden>
              {d.onFile ? '✓' : '○'}
            </span>
            {d.label}
            {d.onFile ? <span className="text-muted"> on file</span> : <span className="text-muted"> missing</span>}
          </li>
        ))}
        <li className={latest && latest.status !== 'draft' ? 'is-onfile' : ''}>
          <span className="event-docs-check" aria-hidden>
            {latest && latest.status !== 'draft' ? '✓' : '○'}
          </span>
          Portal proposal {latest ? `v${latest.version}` : ''}
        </li>
      </ul>
    </section>
  );
}
