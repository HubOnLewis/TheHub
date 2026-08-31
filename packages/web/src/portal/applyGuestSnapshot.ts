import type { GuestPortalSnapshot, GuestPortalMessage } from '@hub-crm/shared';
import type { PortalEventState, PortalMessage, PortalPaymentMilestone, PortalTimelineEntry } from './types.js';
import { portalStateFromProfile, type PortalEventProfile } from './fromCrmEvent.js';

export function profileFromSnapshot(snapshot: GuestPortalSnapshot): PortalEventProfile {
  return { ...snapshot.profile, source: 'crm' };
}

export function paymentsFromSnapshot(snapshot: GuestPortalSnapshot): PortalPaymentMilestone[] {
  if (snapshot.payments.length > 0) {
    return snapshot.payments.map(p => ({
      id: p.id,
      label: p.kind === 'deposit' ? 'Deposit' : p.kind === 'balance' ? 'Final balance' : p.kind,
      amount: p.amount,
      status: p.status === 'paid' ? 'paid' : p.status === 'sent' || p.status === 'created' ? 'due' : 'scheduled',
      dueDate: p.dueDate,
      paidAt: p.paidAt,
    }));
  }
  return portalStateFromProfile(profileFromSnapshot(snapshot)).payments;
}

export function messagesFromSnapshot(rows: GuestPortalMessage[]): PortalMessage[] {
  return rows.map(m => ({
    id: m.id,
    from: m.from,
    role: m.role === 'client' ? 'client' : 'coordinator',
    body: m.body,
    at: m.at,
  }));
}

export function timelineFromSnapshot(snapshot: GuestPortalSnapshot): PortalTimelineEntry[] {
  return snapshot.timeline.map(t => ({
    id: t.key,
    at: t.detail ?? t.state,
    title: t.label,
    detail: t.detail,
    kind: t.key === 'signed' || t.key === 'proposal' ? 'document' : t.key === 'deposit' || t.key === 'final_pay' ? 'payment' : 'system',
  }));
}

export function eventStateFromSnapshot(snapshot: GuestPortalSnapshot, base?: PortalEventState): PortalEventState {
  const seeded = base ?? portalStateFromProfile(profileFromSnapshot(snapshot));
  const proposal = snapshot.proposal;
  let agreementStatus: PortalEventState['agreementStatus'] = 'waiting_venue';
  if (proposal?.status === 'accepted') agreementStatus = 'signed';
  else if (proposal?.status === 'viewed') agreementStatus = 'viewed';
  else if (proposal?.status === 'sent' || proposal?.status === 'declined') agreementStatus = 'pending_review';
  const details = snapshot.clientDetails;
  const playbookSteps = snapshot.playbook?.clientTimeline ?? [];
  const checklist = playbookSteps.length
    ? playbookSteps.map(s => ({
        id: s.id,
        label: s.label,
        due: s.dueLabel,
        complete: s.status === 'done',
        category: s.id.includes('pay') || s.id.includes('deposit') || s.id.includes('balance') ? 'payments' as const : 'logistics' as const,
      }))
    : seeded.checklist.map(c => {
        if (c.id === 'ck-agreement') return { ...c, complete: proposal?.status === 'accepted' };
        if (c.id === 'ck-deposit') return { ...c, complete: snapshot.profile.paidTotal > 0 };
        if (c.id === 'ck-balance') return { ...c, complete: snapshot.profile.balanceDue <= 0 && snapshot.profile.packageTotal > 0 };
        if (c.id === 'ck-guests') return { ...c, complete: Boolean(details?.guestCount || snapshot.profile.guests) };
        return c;
      });
  return {
    ...seeded,
    agreementStatus,
    agreementSignedAt: proposal?.acceptedAt,
    agreementViewedAt: proposal?.viewedAt,
    guestCount: details?.guestCount ?? snapshot.profile.guests ?? seeded.guestCount,
    layoutChoice: details?.layout ?? seeded.layoutChoice,
    payments: paymentsFromSnapshot(snapshot),
    messages: messagesFromSnapshot(snapshot.messages).length
      ? messagesFromSnapshot(snapshot.messages)
      : seeded.messages,
    timeline: timelineFromSnapshot(snapshot),
    checklist,
  };
}
