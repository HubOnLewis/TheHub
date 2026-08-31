import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  extraContacts,
  barPackageLabel,
  formatCurrency,
  type EventType,
} from '@hub-crm/shared';
import type { EventDetailViewModel } from '../../lib/eventDetail.js';
import client from '../../api/client.js';

type Props = {
  model: EventDetailViewModel;
};

function parseErr(e: unknown): string {
  const ax = e as { response?: { data?: { error?: string } }; message?: string };
  return ax.response?.data?.error ?? ax.message ?? 'Request failed';
}

export default function EventPlaybookPanel({ model }: Props) {
  const qc = useQueryClient();
  const [eventType, setEventType] = useState<EventType>(
    (EVENT_TYPES as readonly string[]).includes(model.eventType ?? '')
      ? (model.eventType as EventType)
      : 'other',
  );
  const [msg, setMsg] = useState<string | null>(null);

  const applyMut = useMutation({
    mutationFn: () =>
      client.post(`/deals/${model.id}/playbook`, { eventType }).then(r => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['deal', model.id] });
      await qc.invalidateQueries({ queryKey: ['payments', model.id] });
      setMsg(`${EVENT_TYPE_LABELS[eventType]} playbook applied — tasks, payment rows, docs, and client dates are on this event.`);
    },
    onError: (e: unknown) => setMsg(parseErr(e) || 'Could not apply playbook'),
  });

  const taskMut = useMutation({
    mutationFn: (input: { taskId: string; status: 'open' | 'done' }) =>
      client.patch(`/deals/${model.id}/playbook/tasks`, input).then(r => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['deal', model.id] });
      setMsg(null);
    },
    onError: (e: unknown) => setMsg(parseErr(e)),
  });

  const docMut = useMutation({
    mutationFn: (input: { key: string; onFile: boolean }) =>
      client.patch(`/deals/${model.id}/playbook/documents`, input).then(r => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['deal', model.id] });
      setMsg(null);
    },
    onError: (e: unknown) => setMsg(parseErr(e)),
  });

  const playbook = model.playbook;
  const details = model.clientDetails;
  const extras = extraContacts(details);
  const busy = applyMut.isPending || taskMut.isPending || docMut.isPending || model.isReferenceOnly;
  const grandTotal = model.grandTotal ?? 0;

  return (
    <section className="event-docs-panel">
      <p className="event-docs-panel__intro text-muted text-sm">
        Event type generates the staff task list, milestone payment schedule, document set, and client
        timeline from Hub contract windows (deposit, final count, balance, alcohol docs).
      </p>
      <div className="event-proposal-live">
        <div>
          <h3 className="event-docs-panel__sub" style={{ marginTop: 0 }}>
            Playbook
          </h3>
          <select
            className="form-select"
            value={eventType}
            onChange={e => setEventType(e.target.value as EventType)}
            disabled={model.isReferenceOnly}
          >
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {playbook ? (
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              Applied {playbook.eventTypeLabel}
              {playbook.appliedAt ? ` · ${new Date(playbook.appliedAt).toLocaleDateString()}` : ''}
            </p>
          ) : (
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              No playbook yet. Apply to seed tasks, payment rows, and client dates.
            </p>
          )}
        </div>
        <div className="event-proposal-live__actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={applyMut.isPending || model.isReferenceOnly}
            onClick={() => applyMut.mutate()}
          >
            {playbook ? 'Re-apply playbook' : 'Apply playbook'}
          </button>
        </div>
      </div>
      {msg ? <p role="status">{msg}</p> : null}

      {playbook ? (
        <>
          <h3 className="event-docs-panel__sub">Staff tasks</h3>
          <p className="text-muted text-sm">Mark done or undo. Saved on this event.</p>
          <ul className="event-docs-checklist">
            {playbook.tasks.map(t => (
              <li key={t.id} className={t.status === 'done' ? 'is-onfile' : ''}>
                <button
                  type="button"
                  className="event-docs-checkbtn"
                  disabled={busy}
                  aria-pressed={t.status === 'done'}
                  onClick={() =>
                    taskMut.mutate({ taskId: t.id, status: t.status === 'done' ? 'open' : 'done' })
                  }
                >
                  <span className="event-docs-check" aria-hidden>
                    {t.status === 'done' ? '✓' : '○'}
                  </span>
                  {t.label}
                  <span className="text-muted"> · {t.owner} · {t.dueLabel}</span>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="event-docs-panel__sub">Milestone payments</h3>
          <p className="text-muted text-sm">
            Apply writes deposit and balance as Hub payment rows (Money tab). Not Stripe charges.
          </p>
          <ul className="event-docs-checklist">
            {playbook.paymentSchedule.map(p => {
              const amount = grandTotal > 0 ? Math.round(grandTotal * p.percent * 100) / 100 : null;
              return (
                <li key={p.id}>
                  <span className="event-docs-check" aria-hidden>
                    ○
                  </span>
                  {p.label} ({Math.round(p.percent * 100)}%)
                  {amount != null ? <span> · {formatCurrency(amount)}</span> : null}
                  <span className="text-muted"> · due {p.dueLabel}</span>
                </li>
              );
            })}
          </ul>
          <h3 className="event-docs-panel__sub">Document set</h3>
          <p className="text-muted text-sm">Mark on-file using the same flags as Docs. Does not upload a second copy.</p>
          <ul className="event-docs-checklist">
            {playbook.documents.map(d => {
              const onFile = Boolean(model.documents.find(x => x.key === d.key)?.onFile);
              return (
                <li key={d.key} className={onFile ? 'is-onfile' : ''}>
                  <button
                    type="button"
                    className="event-docs-checkbtn"
                    disabled={busy}
                    aria-pressed={onFile}
                    onClick={() => docMut.mutate({ key: d.key, onFile: !onFile })}
                  >
                    <span className="event-docs-check" aria-hidden>
                      {onFile ? '✓' : '○'}
                    </span>
                    {d.label}
                    <span className="text-muted"> · {d.audience}{d.required ? ' · required' : ''}{onFile ? ' · on file' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <h3 className="event-docs-panel__sub">Client timeline</h3>
          <ul className="event-docs-checklist">
            {playbook.clientTimeline.map(s => (
              <li key={s.id}>
                <span className="event-docs-check" aria-hidden>
                  ○
                </span>
                {s.label}
                <span className="text-muted"> · {s.dueLabel}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="event-docs-panel__sub">Portal client details</h3>
      {details && (details.guestCount || details.layout || details.barPackage) ? (
        <dl className="event-detail-fields event-detail-fields--grid">
          <div className="event-detail-field">
            <dt className="event-detail-field__label">Guest count</dt>
            <dd className="event-detail-field__value">{details.guestCount ?? '—'}</dd>
          </div>
          <div className="event-detail-field">
            <dt className="event-detail-field__label">Layout</dt>
            <dd className="event-detail-field__value">{details.layout ?? '—'}</dd>
          </div>
          <div className="event-detail-field">
            <dt className="event-detail-field__label">Bar package</dt>
            <dd className="event-detail-field__value">{barPackageLabel(details.barPackage)}</dd>
          </div>
          <div className="event-detail-field">
            <dt className="event-detail-field__label">Music cutoff</dt>
            <dd className="event-detail-field__value">{details.musicCutoff ?? '—'}</dd>
          </div>
          <div className="event-detail-field">
            <dt className="event-detail-field__label">Allergies</dt>
            <dd className="event-detail-field__value">{details.allergies ?? '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted text-sm">Client has not submitted planning details in the portal yet.</p>
      )}

      {details?.timelineBlocks && details.timelineBlocks.length > 0 ? (
        <>
          <h3 className="event-docs-panel__sub">Run of show (client)</h3>
          <ul className="event-docs-checklist">
            {details.timelineBlocks.map(b => (
              <li key={b.id}>
                <span className="event-docs-check" aria-hidden>
                  ○
                </span>
                {b.label}
                <span className="text-muted">
                  {' '}
                  · {b.startTime || '—'} – {b.endTime || '—'}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {details?.vendors && details.vendors.length > 0 ? (
        <>
          <h3 className="event-docs-panel__sub">Vendor roster</h3>
          <ul className="event-docs-checklist">
            {details.vendors.map(v => (
              <li key={v.id}>
                <span className="event-docs-check" aria-hidden>
                  {v.status === 'confirmed' ? '✓' : '○'}
                </span>
                {v.type}: {v.name}
                <span className="text-muted"> · {v.status}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {extras.length > 0 ? (
        <>
          <h3 className="event-docs-panel__sub">Additional contacts</h3>
          <ul className="event-docs-checklist">
            {extras.map(c => (
              <li key={`${c.role}-${c.name}`}>
                <span className="event-docs-check" aria-hidden>
                  ○
                </span>
                {c.name} ({c.role})
                {c.email ? <span className="text-muted"> · {c.email}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
