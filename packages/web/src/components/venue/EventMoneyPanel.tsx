import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, type PatchDealPayload, type PaymentLinkRecord } from '@hub-crm/shared';
import type { EventDetailViewModel } from '../../lib/eventDetail.js';
import client from '../../api/client.js';
import { suggestedDeposit } from '../../venue/paymentStore.js';

type Props = {
  model: EventDetailViewModel;
  onPatch?: (data: PatchDealPayload) => Promise<void>;
  patchPending?: boolean;
};

type ApiPayment = PaymentLinkRecord & { _id?: string };

function guestPayUrl(record: { eventId: string; token: string }): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin + '/portal/login?event=' + encodeURIComponent(record.eventId) + '&pay=' + encodeURIComponent(record.token);
}


export default function EventMoneyPanel({ model, patchPending }: Props) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const deposit = useMemo(() => suggestedDeposit(model.grandTotal ?? 0), [model.grandTotal]);
  const balance = model.balanceDue ?? Math.max(0, (model.grandTotal ?? 0) - (model.amountPaid ?? 0));

  const { data: links = [], isFetching } = useQuery({
    queryKey: ['payments', model.id],
    queryFn: async () => {
      const { data } = await client.get<{ data: ApiPayment[] }>('/payments', { params: { eventId: model.id } });
      return data.data ?? [];
    },
    enabled: Boolean(model.id) && !model.isReferenceOnly,
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: (input: { kind: 'deposit' | 'balance' | 'custom'; amount: number }) =>
      client.post<ApiPayment>('/payments', {
        eventId: model.id,
        eventTitle: model.title,
        kind: input.kind,
        amount: input.amount,
      }).then(r => r.data),
    onSuccess: async rec => {
      await qc.invalidateQueries({ queryKey: ['payments', model.id] });
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      let url = guestPayUrl(rec);
      try {
        const { data } = await client.post<{ path: string }>(`/portal/links/${model.id}`);
        url = `${origin}${data.path}&pay=${encodeURIComponent(rec.token)}`;
      } catch {
        /* keep fallback */
      }
      void navigator.clipboard?.writeText(url);
      setMsg(
        `${rec.kind === 'deposit' ? 'Deposit' : rec.kind === 'balance' ? 'Balance' : 'Payment'} link saved to CRM and copied. Card charges are not live.`,
      );
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setMsg(ax.response?.data?.error ?? ax.message ?? 'Could not create payment link');
    },
  });

  const patchMut = useMutation({
    mutationFn: (input: { id: string; status: 'sent' | 'paid' | 'void' }) =>
      client.patch<ApiPayment>(`/payments/${input.id}`, { status: input.status }).then(r => r.data),
    onSuccess: async rec => {
      await qc.invalidateQueries({ queryKey: ['payments', model.id] });
      await qc.invalidateQueries({ queryKey: ['deal', model.id] });
      await qc.invalidateQueries({ queryKey: ['deals'] });
      if (rec.status === 'paid') {
        setMsg(`Recorded ${formatCurrency(rec.amount)} on the event (staff-entered — not a card charge).`);
      }
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setMsg(ax.response?.data?.error ?? ax.message ?? 'Could not update payment');
    },
  });

  const busy = createMut.isPending || patchMut.isPending || patchPending;

  const createLink = (kind: 'deposit' | 'balance' | 'custom', amount: number) => {
    if (!(amount > 0)) {
      setMsg('Enter a valid amount.');
      return;
    }
    setMsg(null);
    createMut.mutate({ kind, amount });
  };

  const copyLink = async (rec: ApiPayment) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let url = guestPayUrl(rec);
    try {
      const { data } = await client.post<{ path: string }>(`/portal/links/${model.id}`);
      url = `${origin}${data.path}&pay=${encodeURIComponent(rec.token)}`;
    } catch {
      /* keep */
    }
    void navigator.clipboard?.writeText(url);
    patchMut.mutate({ id: rec.id, status: 'sent' });
    setMsg('Guest pay link copied. Not a Stripe charge — staff can record payment below.');
  };

  return (
    <section className="event-money-panel">
      <div className="event-money-panel__kpis">
        <div className="event-money-kpi">
          <span>Package total</span>
          <strong>{model.grandTotal != null ? formatCurrency(model.grandTotal) : '—'}</strong>
        </div>
        <div className="event-money-kpi">
          <span>Paid</span>
          <strong className="event-money-kpi--ok">
            {model.amountPaid != null ? formatCurrency(model.amountPaid) : '—'}
          </strong>
        </div>
        <div className="event-money-kpi">
          <span>Balance due</span>
          <strong className={balance > 0 ? 'event-money-kpi--warn' : 'event-money-kpi--ok'}>
            {formatCurrency(balance)}
          </strong>
        </div>
        <div className="event-money-kpi">
          <span>Status</span>
          <strong>{model.paymentStatus}</strong>
        </div>
      </div>

      <div className="event-money-panel__actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || model.isReferenceOnly || !(deposit > 0)}
          onClick={() => createLink('deposit', deposit)}
        >
          Create deposit link ({formatCurrency(deposit)})
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || model.isReferenceOnly || !(balance > 0)}
          onClick={() => createLink('balance', balance)}
        >
          Create balance link ({formatCurrency(balance)})
        </button>
        <div className="event-money-custom">
          <input
            type="number"
            min={0}
            step={50}
            placeholder="Custom $"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            className="form-input"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy || model.isReferenceOnly}
            onClick={() => createLink('custom', Number(customAmount))}
          >
            Create
          </button>
        </div>
      </div>

      <p className="event-money-panel__hint text-muted text-sm">
        Deposit, schedule, and balance live in Mongo via the Hub API — not only this browser.
        Card charges are not live until Stripe is connected. “Record payment” is staff-entered.
      </p>

      {msg ? <p className="event-money-panel__msg" role="status">{msg}</p> : null}
      {isFetching ? <p className="text-muted text-sm">Refreshing payment ledger…</p> : null}

      {links.length > 0 ? (
        <table className="event-money-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {links.map(link => (
              <tr key={link.id}>
                <td>{link.kind}</td>
                <td>{formatCurrency(link.amount)}</td>
                <td>
                  <span className={`event-money-status event-money-status--${link.status}`}>
                    {link.status}
                  </span>
                </td>
                <td>{new Date(link.createdAt).toLocaleString()}</td>
                <td className="event-money-table__acts">
                  {link.status !== 'paid' && link.status !== 'void' ? (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyLink(link)}>
                        Copy
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => patchMut.mutate({ id: link.id, status: 'paid' })}
                      >
                        Record payment
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => patchMut.mutate({ id: link.id, status: 'void' })}
                      >
                        Void
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted text-sm">No payment links yet for this event.</p>
      )}

      {model.payments.length > 0 ? (
        <>
          <h3 className="event-money-panel__sub">Recorded payments</h3>
          <ul className="event-money-history">
            {model.payments.map((p, i) => (
              <li key={`${p.date}-${i}`}>
                <strong>{formatCurrency(p.amount)}</strong>
                <span>
                  {p.date ?? '—'} · {p.type ?? 'Payment'} · {p.method ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}