import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createInitialPortalEventState, PORTAL_DEMO_EVENT } from './demoData.js';
import { PORTAL_DEMO_EVENT_ID } from './paths.js';
import type { PortalEventState, PortalUser } from './types.js';
import { logPortalAudit } from './logPortalAudit.js';
import {
  demoPortalProfile,
  portalProfileFromDeal,
  portalStateFromProfile,
  portalUserFromProfile,
  type PortalEventProfile,
} from './fromCrmEvent.js';
import client from '../api/client.js';
import publicClient from '../api/publicClient.js';
import type { GuestPortalSnapshot, ProposalRecord, ProposalSignPayload } from '@hub-crm/shared';
import { eventStateFromSnapshot, profileFromSnapshot } from './applyGuestSnapshot.js';
import { getScreenshotDeal } from '../api/screenshotDealsStore.js';
import { isScreenshotMode } from '../config/screenshotMode.js';

const STORAGE_KEY = 'hub-crm-portal';

export interface PortalSession {
  user: PortalUser;
  token: string;
}

interface PortalStore {
  session: PortalSession | null;
  event: PortalEventState;
  profile: PortalEventProfile;
  accessToken: string | null;
  proposal: ProposalRecord | null;
  snapshot: GuestPortalSnapshot | null;
  login: (user: PortalUser) => void;
  logout: () => void;
  resetPortalDemo: () => void;
  refreshSnapshot: () => Promise<void>;
  viewProposal: () => Promise<void>;
  signProposal: (input: ProposalSignPayload) => Promise<void>;
  /** Bind portal to a CRM deal id (API or screenshot store). Staff preview — requires session for live API. */
  openEvent: (eventId: string) => Promise<{ ok: boolean; message: string }>;
  /** Guest signed-link open — public endpoint, no staff login. */
  openAccessToken: (token: string) => Promise<{ ok: boolean; message: string }>;
  signAgreement: () => void;
  viewAgreement: () => void;
  payDeposit: () => void;
  payBalance: () => void;
  queuePaymentLink: () => void;
  toggleChecklist: (id: string) => void;
  setGuestCount: (n: number) => void;
  lockGuestEstimate: () => void;
  setLayout: (choice: string) => void;
  sendMessage: (body: string) => void;
  dismissConcierge: (id: string) => void;
  appendTimeline: (entry: {
    title: string;
    detail?: string;
    kind: PortalEventState['timeline'][0]['kind'];
  }) => void;
}

const DEMO_USER: PortalUser = {
  id: 'portal-kiasia',
  name: 'Kiasia Allen',
  email: 'kiasia@example.com',
  role: 'client',
  eventId: PORTAL_DEMO_EVENT_ID,
};

export const PORTAL_DEMO_SESSION: PortalSession = {
  user: DEMO_USER,
  token: 'portal-demo-token',
};

async function resolveDealRecord(eventId: string): Promise<Record<string, unknown> | null> {
  if (!eventId) return null;

  if (isScreenshotMode()) {
    const local = getScreenshotDeal(eventId);
    if (local) return local as unknown as Record<string, unknown>;
  }

  try {
    const { data } = await client.get(`/deals/${eventId}`, { timeout: 12_000 });
    if (data && typeof data === 'object' && (data as { _id?: string })._id) {
      return data as Record<string, unknown>;
    }
  } catch {
    // fall through — screenshot store may still have it outside screenshot mode
  }

  const local = getScreenshotDeal(eventId);
  return local ? (local as unknown as Record<string, unknown>) : null;
}

export const usePortalStore = create<PortalStore>()(
  persist(
    (set, get) => ({
      session: null,
      event: createInitialPortalEventState(),
      profile: demoPortalProfile(),
      accessToken: null,
      proposal: null,
      snapshot: null,

      login: user => set({ session: { user, token: `portal-${user.id}` } }),

      logout: () => set({ session: null, accessToken: null, proposal: null, snapshot: null }),

      resetPortalDemo: () =>
        set({
          session: PORTAL_DEMO_SESSION,
          event: createInitialPortalEventState(),
          profile: demoPortalProfile(),
          accessToken: null,
          proposal: null,
          snapshot: null,
        }),

      openEvent: async eventId => {
        const id = eventId.trim();
        if (!id || id === PORTAL_DEMO_EVENT_ID || id === 'demo') {
          const profile = demoPortalProfile();
          set({
            profile,
            event: createInitialPortalEventState(),
            session: {
              user: portalUserFromProfile(profile),
              token: `portal-${profile.id}`,
            },
          });
          return { ok: true, message: 'Opened demo client portal' };
        }

        const deal = await resolveDealRecord(id);
        if (!deal) {
          return {
            ok: false,
            message: 'Event not found. Check the portal link from your venue coordinator.',
          };
        }

        const profile = portalProfileFromDeal(deal);
        const event = portalStateFromProfile(profile);
        const user = portalUserFromProfile(profile);
        set({
          profile,
          event,
          session: { user, token: `portal-${user.id}` },
        });
        logPortalAudit({
          action: 'updated',
          entityType: 'opportunity',
          entityId: profile.id,
          entityName: profile.title,
          afterSummary: 'Client opened portal for CRM event',
          timelineTitle: 'Client portal opened',
          timelineKind: 'system',
        });
        return { ok: true, message: `Opened portal for ${profile.title}` };
      },

      openAccessToken: async token => {
        const access = token.trim();
        if (!access) {
          return { ok: false, message: 'Missing guest access link. Ask your coordinator for a new one.' };
        }
        try {
          const { data } = await publicClient.get<GuestPortalSnapshot & { profile?: PortalEventProfile }>(
            `/public/portal/bookings/${encodeURIComponent(access)}`,
            { timeout: 12_000 },
          );
          if (!data?.profile?.id) {
            return { ok: false, message: 'This guest link could not be opened.' };
          }
          const snapshot = data.timeline ? (data as GuestPortalSnapshot) : null;
          const profile: PortalEventProfile = snapshot
            ? profileFromSnapshot(snapshot)
            : { ...data.profile, source: 'crm' };
          const event = snapshot ? eventStateFromSnapshot(snapshot) : portalStateFromProfile(profile);
          const user = portalUserFromProfile(profile);
          set({
            profile,
            event,
            accessToken: access,
            proposal: snapshot?.proposal ?? null,
            snapshot,
            session: { user, token: access },
          });
          logPortalAudit({
            action: 'updated',
            entityType: 'opportunity',
            entityId: profile.id,
            entityName: profile.title,
            afterSummary: 'Client opened signed guest portal',
            timelineTitle: 'Client portal opened',
            timelineKind: 'system',
          });
          return { ok: true, message: `Opened portal for ${profile.title}` };
        } catch {
          return {
            ok: false,
            message: 'This guest link is invalid or expired. Ask your coordinator for a new one.',
          };
        }
      },

      signAgreement: () => {
        const ev = get().event;
        const profile = get().profile;
        if (ev.agreementStatus === 'signed') return;
        set({
          event: {
            ...ev,
            agreementStatus: 'signed',
            agreementSignedAt: new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          },
        });
        logPortalAudit({
          action: 'status_changed',
          entityType: 'proposal',
          entityId: profile.id,
          entityName: profile.title,
          beforeSummary: ev.agreementStatus,
          afterSummary: 'Signed by client',
          timelineTitle: 'Agreement signed',
          timelineDetail: get().session?.user.name,
          timelineKind: 'document',
        });
      },

      viewAgreement: () => {
        const ev = get().event;
        const profile = get().profile;
        if (ev.agreementViewedAt) return;
        set({
          event: {
            ...ev,
            agreementViewedAt: new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            agreementStatus: ev.agreementStatus === 'signed' ? 'signed' : 'viewed',
          },
        });
        logPortalAudit({
          action: 'updated',
          entityType: 'proposal',
          entityId: profile.id,
          entityName: profile.title,
          afterSummary: 'Viewed by client',
          timelineTitle: 'Agreement viewed',
          timelineKind: 'document',
        });
      },

      payDeposit: () => {
        const ev = get().event;
        const profile = get().profile;
        const payments = ev.payments.map(p =>
          p.label.toLowerCase().includes('deposit')
            ? { ...p, status: 'paid' as const, paidAt: 'Just now' }
            : p,
        );
        set({ event: { ...ev, payments } });
        logPortalAudit({
          action: 'payment_received_future',
          entityType: 'payment',
          entityId: profile.id,
          entityName: 'Deposit',
          afterSummary: 'Deposit marked paid (portal demo — not charged)',
          timelineTitle: 'Deposit paid',
          timelineKind: 'payment',
        });
      },

      payBalance: () => {
        const ev = get().event;
        const profile = get().profile;
        const payments = ev.payments.map(p =>
          p.label.toLowerCase().includes('balance')
            ? { ...p, status: 'paid' as const, paidAt: 'Just now' }
            : p,
        );
        set({ event: { ...ev, payments } });
        logPortalAudit({
          action: 'payment_received_future',
          entityType: 'payment',
          entityId: profile.id,
          entityName: 'Final balance',
          afterSummary: 'Balance marked paid (portal demo — not charged)',
          timelineTitle: 'Final balance paid',
          timelineKind: 'payment',
        });
      },

      queuePaymentLink: () => {
        const profile = get().profile;
        set({
          event: {
            ...get().event,
            balanceQueuedAt: new Date().toISOString(),
          },
        });
        logPortalAudit({
          action: 'payment_link_created_future',
          entityType: 'payment',
          entityId: profile.id,
          entityName: profile.title,
          afterSummary: 'Payment link queued (not sent externally)',
          timelineTitle: 'Payment link queued',
          timelineKind: 'payment',
        });
      },

      toggleChecklist: id => {
        const ev = get().event;
        set({
          event: {
            ...ev,
            checklist: ev.checklist.map(c => (c.id === id ? { ...c, complete: !c.complete } : c)),
          },
        });
      },

      setGuestCount: n => set({ event: { ...get().event, guestCount: Math.max(0, n) } }),

      lockGuestEstimate: () => set({ event: { ...get().event, guestEstimateLocked: true } }),

      setLayout: choice => set({ event: { ...get().event, layoutChoice: choice } }),

      sendMessage: body => {
        const text = body.trim();
        if (!text) return;
        const access = get().accessToken;
        if (access) {
          void publicClient
            .post(`/public/portal/bookings/${encodeURIComponent(access)}/messages`, { body: text })
            .then(() => get().refreshSnapshot())
            .catch(() => undefined);
        }
        const ev = get().event;
        const user = get().session?.user;
        const msg = {
          id: `msg-${Date.now()}`,
          from: user?.name ?? 'Client',
          role: 'client' as const,
          body: text,
          at: 'Just now',
        };
        set({
          event: {
            ...ev,
            messages: [...ev.messages, msg],
            timeline: [
              {
                id: `tl-msg-${Date.now()}`,
                at: 'Just now',
                title: 'Client message',
                detail: text.slice(0, 80),
                kind: 'message',
              },
              ...ev.timeline,
            ],
          },
        });
      },

      dismissConcierge: id => {
        const ev = get().event;
        set({
          event: {
            ...ev,
            conciergeCards: ev.conciergeCards.map(c =>
              c.id === id ? { ...c, dismissed: true } : c,
            ),
          },
        });
      },

      refreshSnapshot: async () => {
        const access = get().accessToken;
        if (!access) return;
        try {
          const { data } = await publicClient.get<GuestPortalSnapshot>(
            `/public/portal/bookings/${encodeURIComponent(access)}`,
            { timeout: 12_000 },
          );
          if (!data?.profile?.id) return;
          set({
            snapshot: data,
            proposal: data.proposal,
            profile: profileFromSnapshot(data),
            event: eventStateFromSnapshot(data, get().event),
          });
        } catch {
          /* keep local */
        }
      },

      viewProposal: async () => {
        const access = get().accessToken;
        const proposal = get().proposal;
        get().viewAgreement();
        if (!access || !proposal) return;
        try {
          await publicClient.post(`/public/portal/bookings/${encodeURIComponent(access)}/proposals/${proposal.id}/view`);
          await get().refreshSnapshot();
        } catch {
          /* local viewed already recorded */
        }
      },

      signProposal: async input => {
        const access = get().accessToken;
        const proposal = get().proposal;
        get().signAgreement();
        if (!access || !proposal) return;
        try {
          await publicClient.post(
            `/public/portal/bookings/${encodeURIComponent(access)}/proposals/${proposal.id}/accept`,
            input,
          );
          await get().refreshSnapshot();
        } catch {
          /* local signed already recorded */
        }
      },

      appendTimeline: entry => {
        const ev = get().event;
        set({
          event: {
            ...ev,
            timeline: [
              {
                id: `tl-${Date.now()}`,
                at: new Date().toLocaleString(),
                ...entry,
              },
              ...ev.timeline,
            ],
          },
        });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: s => ({
        session: s.session,
        event: s.event,
        profile: s.profile,
        accessToken: s.accessToken,
        proposal: s.proposal,
      }),
    },
  ),
);

/** @deprecated use profile from store — kept for gradual migration */
export function getPortalEventDisplay() {
  return usePortalStore.getState().profile;
}

export { PORTAL_DEMO_EVENT };
