/**
 * Local audit trail — localStorage persistence for client review (future: API).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditEvent, AuditEventInput } from '@hub-crm/shared';

export type { AuditEvent };

export const AUDIT_STORAGE_KEY = 'hub-crm-audit-trail';

function uid(): string {
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function seedEvents(): AuditEvent[] {
  const base = '2026-05-18T15:00:00.000Z';
  return [
    {
      id: 'aud-seed-1',
      actorId: 'u-jason',
      actorName: 'Jason Lavender',
      actorRole: 'Owner / Admin',
      action: 'created',
      entityType: 'opportunity',
      entityId: 'pv-miller-harris',
      entityName: 'Miller/Harris Baby Shower',
      afterSummary: 'Event created from inquiry',
      timestamp: base,
      source: 'user',
      visibility: 'internal',
      severity: 'info',
      visibleToClientReview: true,
      deviceLabel: 'Web',
    },
    {
      id: 'aud-seed-2',
      actorId: 'u-hannah',
      actorName: 'Hannah Bayless',
      actorRole: 'Event Coordinator',
      action: 'status_changed',
      entityType: 'opportunity',
      entityId: 'pv-miller-harris',
      entityName: 'Miller/Harris Baby Shower',
      beforeSummary: 'Proposal Sent',
      afterSummary: 'Confirmed',
      timestamp: '2026-05-12T19:18:00.000Z',
      source: 'user',
      visibility: 'internal',
      severity: 'notice',
      visibleToClientReview: true,
    },
    {
      id: 'aud-seed-3',
      actorId: 'follow-up-hunter',
      actorName: 'Follow-Up Hunter',
      actorRole: 'Agent',
      action: 'message_drafted',
      entityType: 'message',
      entityId: 'inbox-miller',
      entityName: 'Miller/Harris · inbox thread',
      afterSummary: 'Client follow-up draft generated',
      timestamp: '2026-05-20T13:30:00.000Z',
      source: 'agent',
      visibility: 'internal',
      severity: 'info',
      visibleToClientReview: false,
    },
    {
      id: 'aud-seed-4',
      actorId: 'u-jason',
      actorName: 'Jason Lavender',
      actorRole: 'Owner / Admin',
      action: 'user_invited',
      entityType: 'user',
      entityId: 'u-hannah',
      entityName: 'Hannah Bayless',
      afterSummary: 'Coordinator invite sent',
      timestamp: '2026-04-01T10:00:00.000Z',
      source: 'user',
      visibility: 'owner',
      severity: 'notice',
      visibleToClientReview: false,
    },
  ];
}

interface AuditState {
  events: AuditEvent[];
  initialized: boolean;
}

interface AuditActions {
  ensureInitialized: () => void;
  resetAuditTrail: () => void;
}

export const useAuditStore = create<AuditState & AuditActions>()(
  persist(
    set => ({
      events: [],
      initialized: false,

      ensureInitialized: () => {
        const state = useAuditStore.getState();
        if (state.initialized && state.events.length > 0) return;
        set({ events: seedEvents(), initialized: true });
      },

      resetAuditTrail: () => set({ events: seedEvents(), initialized: true }),
    }),
    {
      name: AUDIT_STORAGE_KEY,
      version: 1,
      partialize: s => ({ events: s.events, initialized: s.initialized }),
    },
  ),
);

/** Append outside React — used by logAudit and demoOpsStore */
export function appendAuditEvent(input: AuditEventInput): AuditEvent {
  useAuditStore.getState().ensureInitialized();
  const row: AuditEvent = {
    id: input.id ?? uid(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    beforeSummary: input.beforeSummary,
    afterSummary: input.afterSummary,
    source: input.source,
    visibility: input.visibility,
    severity: input.severity,
    visibleToClientReview: input.visibleToClientReview,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    deviceLabel: input.deviceLabel,
  };
  useAuditStore.setState(s => ({
    events: [row, ...s.events].slice(0, 500),
  }));
  return row;
}

export function selectAuditEvents(): AuditEvent[] {
  useAuditStore.getState().ensureInitialized();
  return useAuditStore.getState().events;
}
