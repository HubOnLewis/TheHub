import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveHoldLifecycle, type HoldLifecycle } from '@hub-crm/shared';
import client from '../../api/client.js';

type Props = {
  dealId: string;
  holdExpiresAt: string | null;
  holdReleasedAt: string | null;
  crmStatus: string;
  pvStatus: string | null;
  canPatch: boolean;
};

function labelFor(life: HoldLifecycle, expiresAt: string | null): { title: string; detail: string; tone: 'ok' | 'warn' | 'danger' } {
  if (life === 'converted') {
    return { title: 'Date confirmed', detail: 'This hold converted into a booked event.', tone: 'ok' };
  }
  if (life === 'released') {
    return { title: 'Hold released', detail: 'Staff released this date. The room is back on the calendar.', tone: 'warn' };
  }
  if (life === 'expired') {
    return { title: 'Hold expired', detail: 'The public calendar is open again for this room and slot.', tone: 'danger' };
  }
  if (life === 'expiring') {
    return {
      title: 'Hold expiring',
      detail: expiresAt ? `Hold ends ${new Date(expiresAt).toLocaleString()}` : 'Extend or convert this date soon.',
      tone: 'warn',
    };
  }
  if (life === 'active') {
    return {
      title: 'Hold',
      detail: expiresAt ? `Hold until ${new Date(expiresAt).toLocaleString()}` : '7-day inquiry hold is active.',
      tone: 'ok',
    };
  }
  return { title: 'No hold yet', detail: 'Set a date and room to place a hold.', tone: 'ok' };
}

export default function EventHoldPanel({
  dealId,
  holdExpiresAt,
  holdReleasedAt,
  crmStatus,
  pvStatus,
  canPatch,
}: Props) {
  const qc = useQueryClient();
  const life = resolveHoldLifecycle(
    {
      status: crmStatus,
      importMeta: {
        pvStatus: pvStatus ?? undefined,
        holdExpiresAt: holdExpiresAt ?? undefined,
        holdReleasedAt: holdReleasedAt ?? undefined,
      },
    },
  );
  const copy = labelFor(life, holdExpiresAt);
  if (life === 'none' || life === 'converted') return null;
  const showActions = canPatch && (life === 'active' || life === 'expiring' || life === 'expired' || life === 'released');

  const extendMut = useMutation({
    mutationFn: () => client.post(`/deals/${dealId}/hold/extend`, { days: 7 }).then(r => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['deal', dealId] });
      await qc.invalidateQueries({ queryKey: ['venue-ops'] });
      await qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
  const releaseMut = useMutation({
    mutationFn: () => client.post(`/deals/${dealId}/hold/release`).then(r => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['deal', dealId] });
      await qc.invalidateQueries({ queryKey: ['venue-ops'] });
      await qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  return (
    <SectionCard title="Calendar hold" subtitle="Inquiry holds expire automatically unless extended or converted">
      <p className={`event-hold-panel__status event-hold-panel__status--${copy.tone}`}>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </p>
      {showActions ? (
        <div className="event-hold-panel__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={extendMut.isPending}
            onClick={() => extendMut.mutate()}
          >
            Extend 7 days
          </button>
          {life !== 'released' && life !== 'expired' ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={releaseMut.isPending}
              onClick={() => {
                if (window.confirm('Release this date hold and open the room on the public calendar?')) {
                  releaseMut.mutate();
                }
              }}
            >
              Release hold
            </button>
          ) : null}
        </div>
      ) : null}
      {extendMut.isError || releaseMut.isError ? (
        <p className="text-muted text-sm" role="status">
          Could not update the hold. Try again.
        </p>
      ) : null}
    </SectionCard>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="event-detail-section event-hold-panel">
      <header className="event-detail-section__head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
