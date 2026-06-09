import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createInitialPortalEventState, PORTAL_DEMO_EVENT } from './demoData.js';
import { PORTAL_DEMO_EVENT_ID } from './paths.js';
import type { PortalEventState, PortalMessage, PortalUser } from './types.js';
import { logPortalAudit } from './logPortalAudit.js';

const STORAGE_KEY = 'hub-crm-portal';

export interface PortalSession {
  user: PortalUser;
  token: string;
}

interface PortalStore {
  session: PortalSession | null;
  event: PortalEventState;
  login: (user: PortalUser) => void;
  logout: () => void;
  resetPortalDemo: () => void;
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
  appendTimeline: (entry: { title: string; detail?: string; kind: PortalEventState['timeline'][0]['kind'] }) => void;
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

export const usePortalStore = create<PortalStore>()(
  persist(
    (set, get) => ({
      session: null,
      event: createInitialPortalEventState(),

      login: user => set({ session: { user, token: `portal-${user.id}` } }),

      logout: () => set({ session: null }),

      resetPortalDemo: () =>
        set({
          session: PORTAL_DEMO_SESSION,
          event: createInitialPortalEventState(),
        }),

      signAgreement: () => {
        const ev = get().event;
        if (ev.agreementStatus === 'signed') return;
        set({
          event: {
            ...ev,
            agreementStatus: 'signed',
            agreementSignedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          },
        });
        logPortalAudit({
          action: 'status_changed',
          entityType: 'proposal',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: PORTAL_DEMO_EVENT.title,
          beforeSummary: ev.agreementStatus,
          afterSummary: 'Signed by client',
          timelineTitle: 'Agreement signed',
          timelineDetail: DEMO_USER.name,
          timelineKind: 'document',
        });
      },

      viewAgreement: () => {
        const ev = get().event;
        if (ev.agreementViewedAt) return;
        set({
          event: {
            ...ev,
            agreementViewedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            agreementStatus: ev.agreementStatus === 'signed' ? 'signed' : 'viewed',
          },
        });
        logPortalAudit({
          action: 'updated',
          entityType: 'proposal',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: PORTAL_DEMO_EVENT.title,
          afterSummary: 'Viewed by client',
          timelineTitle: 'Agreement viewed',
          timelineKind: 'document',
        });
      },

      payDeposit: () => {
        const ev = get().event;
        const payments = ev.payments.map(p =>
          p.label.toLowerCase().includes('deposit')
            ? { ...p, status: 'paid' as const, paidAt: 'Just now' }
            : p,
        );
        set({ event: { ...ev, payments } });
        logPortalAudit({
          action: 'payment_received_future',
          entityType: 'payment',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: 'Deposit',
          afterSummary: 'Deposit payment queued (demo)',
          timelineTitle: 'Deposit payment submitted',
          timelineKind: 'payment',
        });
      },

      payBalance: () => {
        const ev = get().event;
        const payments = ev.payments.map(p =>
          p.status === 'due' ? { ...p, status: 'queued' as const } : p,
        );
        set({ event: { ...ev, payments, balanceQueuedAt: new Date().toISOString() } });
        logPortalAudit({
          action: 'payment_link_created_future',
          entityType: 'payment',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: 'Final balance',
          afterSummary: 'Balance payment queued for approval',
          timelineTitle: 'Final balance payment queued',
          timelineKind: 'payment',
        });
      },

      queuePaymentLink: () => {
        logPortalAudit({
          action: 'payment_link_created_future',
          entityType: 'payment',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: PORTAL_DEMO_EVENT.title,
          afterSummary: 'Payment link sent to client email (demo)',
          timelineTitle: 'Payment link sent',
          timelineKind: 'payment',
        });
      },

      toggleChecklist: id => {
        const ev = get().event;
        const item = ev.checklist.find(c => c.id === id);
        if (!item) return;
        const next = !item.complete;
        const checklist = ev.checklist.map(c => (c.id === id ? { ...c, complete: next } : c));
        set({ event: { ...ev, checklist } });
        logPortalAudit({
          action: next ? 'task_completed' : 'updated',
          entityType: 'task',
          entityId: id,
          entityName: item.label,
          afterSummary: next ? 'Completed in portal' : 'Reopened',
          timelineTitle: next ? `Completed: ${item.label}` : `Reopened: ${item.label}`,
          timelineKind: 'checklist',
        });
      },

      setGuestCount: n => {
        set(state => ({
          event: { ...state.event, guestCount: Math.max(1, n) },
        }));
        logPortalAudit({
          action: 'updated',
          entityType: 'event',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: PORTAL_DEMO_EVENT.title,
          afterSummary: `Guest count set to ${n}`,
          timelineTitle: 'Guest count updated',
          timelineKind: 'system',
        });
      },

      lockGuestEstimate: () => {
        set(state => ({ event: { ...state.event, guestEstimateLocked: true } }));
        logPortalAudit({
          action: 'status_changed',
          entityType: 'event',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: PORTAL_DEMO_EVENT.title,
          afterSummary: 'Guest estimate locked',
          timelineTitle: 'Guest count confirmed',
          timelineKind: 'system',
        });
      },

      setLayout: choice => {
        set(state => ({ event: { ...state.event, layoutChoice: choice } }));
        logPortalAudit({
          action: 'updated',
          entityType: 'event',
          entityId: PORTAL_DEMO_EVENT_ID,
          entityName: PORTAL_DEMO_EVENT.title,
          afterSummary: `Layout: ${choice}`,
          timelineTitle: 'Layout preference saved',
          timelineKind: 'system',
        });
      },

      sendMessage: body => {
        const session = get().session;
        if (!body.trim() || !session) return;
        const msg: PortalMessage = {
          id: `m-${Date.now()}`,
          from: session.user.name,
          role: 'client',
          body: body.trim(),
          at: 'Just now',
        };
        set(state => ({
          event: { ...state.event, messages: [...state.event.messages, msg] },
        }));
        logPortalAudit({
          action: 'message_queued',
          entityType: 'message',
          entityId: msg.id,
          entityName: 'Coordinator thread',
          afterSummary: body.trim().slice(0, 80),
          timelineTitle: 'Message to coordinator',
          timelineKind: 'message',
        });
      },

      dismissConcierge: id => {
        set(state => ({
          event: {
            ...state.event,
            conciergeCards: state.event.conciergeCards.map(c =>
              c.id === id ? { ...c, dismissed: true } : c,
            ),
          },
        }));
        logPortalAudit({
          action: 'signal_reviewed',
          entityType: 'automation',
          entityId: id,
          entityName: 'AI Concierge',
          afterSummary: 'Recommendation dismissed',
        });
      },

      appendTimeline: ({ title, detail, kind }) => {
        const entry = {
          id: `tl-${Date.now()}`,
          at: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          title,
          detail,
          kind,
        };
        set(state => ({
          event: { ...state.event, timeline: [entry, ...state.event.timeline] },
        }));
      },
    }),
    { name: STORAGE_KEY, partialize: s => ({ session: s.session, event: s.event }) },
  ),
);
