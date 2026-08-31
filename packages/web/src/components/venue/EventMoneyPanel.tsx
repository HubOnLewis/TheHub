import { useMemo, useState } from 'react';
import { formatCurrency, type PatchDealPayload } from '@hub-crm/shared';
import type { EventDetailViewModel } from '../../lib/eventDetail.js';
import client from '../../api/client.js';
import {
  createPaymentLink,
  listPaymentLinks,
  markPaymentLinkPaid,
  markPaymentLinkSent,
  paymentImportMetaPatch,
  paymentLinkUrl,
  suggestedDeposit,
  voidPaymentLink,
  type PaymentLinkRecord,
} from '../../venue/paymentStore.js';

type Props = {
  model: EventDetailViewModel;
  onPatch?: (data: PatchDealPayload) => Promise<void>;
  patchPending?: boolean;
};

export default function EventMoneyPanel({ model, onPatch, patchPending }: Props) {
  const [links, setLinks] = useState(() => listPaymentLinks(model.id));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const deposit = useMemo(
    () => suggestedDeposit(model.grandTotal ?? 0),
    [model.grandTotal],
  );
  const balance = model.balanceDue ?? Math.max(0, (model.grandTotal ?? 0) - (model.amountPaid ?? 0));

  const refresh = () => setLinks(listPaymentLinks(model.id));

  const mintShareUrl = async (rec: PaymentLinkRecord) => {
    try {
      const { data } = await client.post<{ path: string }>(`/portal/links/${model.id}`);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}${data.path}&pay=${encodeURIComponent(rec.token)}`;
    } catch {
      return paymentLinkUrl(rec);
    }
  };

  const createLink = async (kind: 'deposit' | 'balance' | 'custom', amount: number) => {
    if (!(amount > 0)) {
      setMsg('Enter a valid amount.');
      return;
    }
    const rec = createPaymentLink({
      eventId: model.id,
      eventTitle: model.title,
      kind,
      amount,
    });
    refresh();
    const url = await mintShareUrl(rec);
    void navigator.clipboard?.writeText(url);
    setMsg(
      `${kind === 'deposit' ? 'Deposit' : kind === 'balance' ? 'Balance' : 'Payment'} link copied. Card charges are not live — this opens the guest portal.`,
    );
  };

  const copyLink = async (rec: PaymentLinkRecord) => {
    const url = await mintShareUrl(rec);
    void navigator.clipboard?.writeText(url);
    markPaymentLinkSent(rec.id);
    refresh();
    setMsg('Guest pay link copied. Not a Stripe charge — staff can record payment below.');
  };

  const simulatePaid = async (rec: PaymentLinkRecord) => {
    if (!onPatch || model.isReferenceOnly) {
      markPaymentLinkPaid(rec.id);
      refresh();
      setMsg('Recorded locally (read-only event — CRM totals not updated). Not a card charge.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const patch = paymentImportMetaPatch({
        existingPaid: model.amountPaid ?? 0,
        existingBalance: model.balanceDue,
        grandTotal: model.grandTotal ?? rec.amount,
        paymentAmount: rec.amount,
        paymentType: rec.kind,
      });
      const existingPayments = model.payments.map(p => ({
        amount: p.amount,
        paymentDate: p.date,
        method: p.method,
        paymentType: p.type,
      }));
      await onPatch({
        amount: model.grandTotal ?? undefined,
        importMeta: {
          amountPaid: patch.amountPaid,
          balanceDue: patch.balanceDue,
          grandTotal: model.grandTotal ?? patch.amountPaid,
          payments: [...existingPayments, patch.paymentEntry],
          lastContactedIso: new Date().toISOString().slice(0, 10),
        },
      });
      markPaymentLinkPaid(rec.id);
      refresh();
      setMsg(`Recorded ${formatCurrency(rec.amount)} on the event (staff-entered — not a card charge).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not update event');
    } finally {
      setBusy(false);
    }
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
          disabled={busy || patchPending || !(deposit > 0)}
          onClick={() => void createLink('deposit', deposit)}
        >
          Create deposit link ({formatCurrency(deposit)})
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || patchPending || !(balance > 0)}
          onClick={() => void createLink('balance', balance)}
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
            disabled={busy}
            onClick={() => void createLink('custom', Number(customAmount))}
          >
            Create
          </button>
        </div>
      </div>

      <p className="event-money-panel__hint text-muted text-sm">
        Links open the guest portal with a signed token. Card charges are not live — Stripe is not
        connected. “Record payment” updates CRM totals (staff-entered). It does not charge a card.
      </p>

      {msg ? <p className="event-money-panel__msg" role="status">{msg}</p> : null}

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
                        onClick={() => void simulatePaid(link)}
                      >
                        Record payment
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          voidPaymentLink(link.id);
                          refresh();
                        }}
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
