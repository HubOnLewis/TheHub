/**
 * Local interactive demo operating layer — session + localStorage.
 * Simulates operational movement without backend / external side effects.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_TASKS, type DemoTask, type TaskAutomationBadge } from '../data/demoVenue.js';
import { getAgentEngineSnapshot } from '../agents/mockAgentEngine.js';
import type { AgentProposedAction, AgentRiskLevel } from '../agents/types.js';
import { useAppStore } from '../store/index.js';
import {
  auditApprovalApproved,
  auditApprovalDismissed,
  auditApprovalEdited,
  auditApprovalQueued,
  auditAutomationToggle,
  auditDealDraftQueued,
  auditDealNote,
  auditDealStage,
  auditDealTimeline,
  auditDepositReminderQueued,
  auditInboxDraftGenerated,
  auditInboxDraftQueued,
  auditRecommendationDone,
  auditRecommendationPlanned,
  auditSignalReviewed,
  auditTaskCompleted,
  auditTaskCreated,
  auditTaskReopened,
} from '../audit/demoOpsAudit.js';

export const DEMO_OPS_STORAGE_KEY = 'hub-crm-demo-ops';

export type DemoApprovalStatus = 'pending' | 'approved' | 'dismissed' | 'queued_later' | 'edited';

export type DemoEventStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Confirmed'
  | 'Balance Due'
  | 'Completed'
  | 'Lost / Archived';

export type DemoTaskStatus = 'open' | 'completed';

export type DemoRecStatus = 'open' | 'planned' | 'dismissed' | 'done';

export type DemoSignalStatus = 'open' | 'reviewed' | 'dismissed';

export interface DemoToast {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'neutral';
  createdAt: number;
}

export interface DemoActivityEntry {
  id: string;
  at: string;
  atIso: string;
  category: 'agent' | 'task' | 'inbox' | 'deal' | 'approval' | 'system';
  agent?: string;
  summary: string;
}

export interface DemoTaskRecord extends DemoTask {
  status: DemoTaskStatus;
  completedAt?: string;
}

export interface DemoApprovalRecord {
  id: string;
  agentId: string;
  agent: string;
  title: string;
  description: string;
  trigger: string;
  confidence: number;
  risk: AgentRiskLevel;
  approvalRequiredBecause: string;
  waitingOn: string;
  linkedEvent?: string;
  status: DemoApprovalStatus;
  updatedAt: string;
}

export interface DemoDealOps {
  dealId: string;
  stage: DemoEventStage;
  internalNotes: string[];
  timeline: Array<{ title: string; channel: string; actor: string; at: string }>;
  nextActionComplete: boolean;
  depositReminderQueued: boolean;
  activeDraft: string | null;
  draftQueued: boolean;
}

export interface DemoInboxOps {
  read: Record<string, boolean>;
  selectedId: string | null;
  drafts: Record<string, string>;
  draftQueued: Record<string, boolean>;
}

export interface DemoSessionMeta {
  sessionStartedAt: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  continuityLabel: string;
}

export interface DemoOpsState {
  initialized: boolean;
  lastPulseAt: string;
  sessionMeta: DemoSessionMeta;
  occupancyOverrides: Record<string, number>;
  toasts: DemoToast[];
  activityFeed: DemoActivityEntry[];
  approvals: Record<string, DemoApprovalRecord>;
  signalStatus: Record<string, DemoSignalStatus>;
  recommendationStatus: Record<string, DemoRecStatus>;
  tasks: DemoTaskRecord[];
  deal: DemoDealOps;
  inbox: DemoInboxOps;
  automationToggles: Record<string, boolean>;
  expandedAgents: Record<string, boolean>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function relNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultSessionMeta(): DemoSessionMeta {
  const t = nowIso();
  return {
    sessionStartedAt: t,
    lastModifiedAt: t,
    lastModifiedBy: 'System',
    continuityLabel: 'Fresh operational session',
  };
}

function seedApprovals(): Record<string, DemoApprovalRecord> {
  const snap = getAgentEngineSnapshot();
  const out: Record<string, DemoApprovalRecord> = {};
  for (const p of snap.pendingApprovals) {
    const agent = snap.agentStates.find(s => s.id === p.agentId);
    out[p.id] = {
      id: p.id,
      agentId: p.agentId,
      agent: agent?.shortName ?? p.agentId,
      title: p.title,
      description: p.description,
      trigger: p.trigger,
      confidence: p.confidence,
      risk: p.riskLevel,
      approvalRequiredBecause: p.approvalRequiredBecause,
      waitingOn: p.waitingOn ?? 'Coordinator',
      linkedEvent: p.linkedEvent,
      status: 'pending',
      updatedAt: nowIso(),
    };
  }
  return out;
}

function seedTasks(): DemoTaskRecord[] {
  return DEMO_TASKS.map(t => ({ ...t, status: 'open' as const }));
}

function seedActivity(): DemoActivityEntry[] {
  const snap = getAgentEngineSnapshot();
  const t = nowIso();
  const opsSeed: DemoActivityEntry[] = [
    { id: 'seed-1', at: relNow(), atIso: t, category: 'deal', agent: 'Follow-Up Hunter', summary: 'Proposal viewed again · Miller/Harris' },
    { id: 'seed-2', at: relNow(), atIso: t, category: 'deal', agent: 'Balance Guardian', summary: 'Deposit reminder queued · approval-gated' },
    { id: 'seed-3', at: relNow(), atIso: t, category: 'agent', agent: 'Follow-Up Hunter', summary: 'AI drafted follow-up · Miller/Harris shower' },
    { id: 'seed-4', at: relNow(), atIso: t, category: 'task', summary: 'Kisi access task completed · Send Kisi Email' },
    { id: 'seed-5', at: relNow(), atIso: t, category: 'deal', agent: 'Balance Guardian', summary: 'Balance reminder escalated · Villarreal grad' },
    { id: 'seed-6', at: relNow(), atIso: t, category: 'deal', summary: 'Guest count updated · Miller/Harris · 30' },
    { id: 'seed-7', at: relNow(), atIso: t, category: 'deal', summary: 'Timeline note added · layout questions' },
    { id: 'seed-8', at: relNow(), atIso: t, category: 'approval', agent: 'Booking Coordinator', summary: 'Approval cleared · Kisi batch' },
  ];
  const agentRows = snap.activities.slice(0, 4).map(a => ({
    id: a.id,
    at: a.at,
    atIso: nowIso(),
    category: 'agent' as const,
    agent: a.agentName,
    summary: a.summary,
  }));
  return [...opsSeed, ...agentRows].slice(0, 14);
}

const DEFAULT_DEAL: DemoDealOps = {
  dealId: 'pv-miller-harris',
  stage: 'Confirmed',
  internalNotes: [],
  timeline: [],
  nextActionComplete: false,
  depositReminderQueued: false,
  activeDraft: null,
  draftQueued: false,
};

function pushActivity(
  feed: DemoActivityEntry[],
  entry: Omit<DemoActivityEntry, 'id' | 'at' | 'atIso'>,
): DemoActivityEntry[] {
  const row: DemoActivityEntry = {
    id: uid('act'),
    at: relNow(),
    atIso: nowIso(),
    ...entry,
  };
  return [row, ...feed].slice(0, 40);
}

function pushToast(toasts: DemoToast[], message: string, tone: DemoToast['tone'] = 'success'): DemoToast[] {
  const t: DemoToast = { id: uid('toast'), message, tone, createdAt: Date.now() };
  return [t, ...toasts].slice(0, 4);
}

interface DemoOpsActions {
  ensureInitialized: () => void;
  resetDemoOps: () => void;
  dismissToast: (id: string) => void;
  approveApproval: (id: string) => void;
  dismissApproval: (id: string) => void;
  queueApprovalLater: (id: string) => void;
  editApproval: (id: string) => void;
  reviewSignal: (id: string) => void;
  dismissSignal: (id: string) => void;
  planRecommendation: (id: string) => void;
  dismissRecommendation: (id: string) => void;
  doneRecommendation: (id: string) => void;
  createTaskFromRecommendation: (id: string, title: string, linkedEvent?: string) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  assignTask: (id: string, owner: { initials: string; name: string }) => void;
  setTaskPriority: (id: string, priority: DemoTask['priority']) => void;
  addTask: (task: Omit<DemoTaskRecord, 'id' | 'status' | 'completedAt'>) => void;
  setDealStage: (stage: DemoEventStage) => void;
  addDealNote: (text: string) => void;
  addDealTimeline: (title: string, channel: string, actor: string) => void;
  generateDealDraft: () => string;
  queueDealDraftApproval: () => void;
  completeDealNextAction: () => void;
  markDepositReminderQueued: () => void;
  selectInbox: (id: string | null) => void;
  toggleInboxRead: (id: string) => void;
  generateInboxReply: (id: string, template: string) => string;
  queueInboxDraft: (id: string) => void;
  createTaskFromInbox: (id: string, subject: string) => void;
  toggleAgentExpanded: (agentId: string) => void;
  setAutomationToggle: (key: string, on: boolean) => void;
  pulse: () => void;
  setOccupancyOverride: (key: string, pct: number) => void;
}

export const useDemoOpsStore = create<DemoOpsState & DemoOpsActions>()(
  persist(
    (set, get) => {
      const touch = (): Pick<DemoOpsState, 'lastPulseAt' | 'sessionMeta'> => {
        const cur = get().sessionMeta ?? defaultSessionMeta();
        const name = useAppStore.getState().user?.name ?? 'System';
        return {
          lastPulseAt: nowIso(),
          sessionMeta: {
            ...cur,
            lastModifiedAt: nowIso(),
            lastModifiedBy: name,
            continuityLabel: 'Changes saved locally · survives refresh',
          },
        };
      };

      return {
      initialized: false,
      lastPulseAt: nowIso(),
      sessionMeta: defaultSessionMeta(),
      occupancyOverrides: { 'may-2026': 81 },
      toasts: [],
      activityFeed: [],
      approvals: {},
      signalStatus: {},
      recommendationStatus: {},
      tasks: [],
      deal: { ...DEFAULT_DEAL },
      inbox: { read: {}, selectedId: null, drafts: {}, draftQueued: {} },
      automationToggles: {
        'wf-lead': true,
        'wf-proposal': true,
        'wf-deposit': true,
        'wf-prep': true,
        'wf-review': true,
      },
      expandedAgents: {},

      ensureInitialized: () => {
        const s = get();
        const patches: Partial<DemoOpsState> = {};
        if (!s.sessionMeta) patches.sessionMeta = defaultSessionMeta();
        if (!s.occupancyOverrides || Object.keys(s.occupancyOverrides).length === 0) {
          patches.occupancyOverrides = { 'may-2026': 81 };
        }
        if (s.initialized && s.tasks.length > 0) {
          if (Object.keys(patches).length > 0) set(patches);
          return;
        }
        set({
          initialized: true,
          activityFeed: seedActivity(),
          approvals: seedApprovals(),
          tasks: seedTasks(),
          ...patches,
          ...touch(),
        });
      },

      resetDemoOps: () => {
        localStorage.removeItem(DEMO_OPS_STORAGE_KEY);
        set({
          initialized: true,
          ...touch(),
          sessionMeta: defaultSessionMeta(),
          toasts: pushToast([], 'Demo state reset — fresh session', 'info'),
          activityFeed: seedActivity(),
          approvals: seedApprovals(),
          signalStatus: {},
          recommendationStatus: {},
          tasks: seedTasks(),
          deal: { ...DEFAULT_DEAL },
          inbox: { read: {}, selectedId: null, drafts: {}, draftQueued: {} },
          automationToggles: {
            'wf-lead': true,
            'wf-proposal': true,
            'wf-deposit': true,
            'wf-prep': true,
            'wf-review': true,
          },
          expandedAgents: {},
        });
      },

      dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

      approveApproval: id => {
        const a = get().approvals[id];
        if (!a || a.status !== 'pending') return;
        set(s => ({
          approvals: { ...s.approvals, [id]: { ...a, status: 'approved', updatedAt: nowIso() } },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'approval',
            agent: a.agent,
            summary: `Approved · ${a.title}`,
          }),
          toasts: pushToast(s.toasts, `Approved — ${a.title}`, 'success'),
          ...touch(),
        }));
        auditApprovalApproved(id, a.title, a.agent);
      },

      dismissApproval: id => {
        const a = get().approvals[id];
        if (!a) return;
        set(s => ({
          approvals: { ...s.approvals, [id]: { ...a, status: 'dismissed', updatedAt: nowIso() } },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'approval',
            agent: a.agent,
            summary: `Dismissed · ${a.title}`,
          }),
          toasts: pushToast(s.toasts, 'Approval dismissed', 'neutral'),
          ...touch(),
        }));
        auditApprovalDismissed(id, a.title);
      },

      queueApprovalLater: id => {
        const a = get().approvals[id];
        if (!a) return;
        set(s => ({
          approvals: { ...s.approvals, [id]: { ...a, status: 'queued_later', updatedAt: nowIso() } },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'approval',
            agent: a.agent,
            summary: `Queued for later · ${a.title}`,
          }),
          toasts: pushToast(s.toasts, 'Queued for coordinator review', 'info'),
          ...touch(),
        }));
        auditApprovalQueued(id, a.title);
      },

      editApproval: id => {
        const a = get().approvals[id];
        if (!a) return;
        set(s => ({
          approvals: { ...s.approvals, [id]: { ...a, status: 'edited', updatedAt: nowIso() } },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'approval',
            agent: a.agent,
            summary: `Edit requested · ${a.title}`,
          }),
          toasts: pushToast(s.toasts, 'Draft opened for edit — queue when ready', 'info'),
          ...touch(),
        }));
        auditApprovalEdited(id, a.title);
      },

      reviewSignal: id => {
        set(s => ({
          signalStatus: { ...s.signalStatus, [id]: 'reviewed' },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'agent',
            summary: 'Signal marked reviewed',
          }),
          ...touch(),
        }));
        auditSignalReviewed(id);
      },

      dismissSignal: id =>
        set(s => ({
          signalStatus: { ...s.signalStatus, [id]: 'dismissed' },
          ...touch(),
        })),

      planRecommendation: id => {
        set(s => ({
          recommendationStatus: { ...s.recommendationStatus, [id]: 'planned' },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'agent',
            summary: 'Recommendation marked planned',
          }),
          toasts: pushToast(s.toasts, 'Marked planned', 'success'),
          ...touch(),
        }));
        auditRecommendationPlanned(id);
      },

      dismissRecommendation: id =>
        set(s => ({
          recommendationStatus: { ...s.recommendationStatus, [id]: 'dismissed' },
          ...touch(),
        })),

      doneRecommendation: id => {
        set(s => ({
          recommendationStatus: { ...s.recommendationStatus, [id]: 'done' },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'agent',
            summary: 'Recommendation completed',
          }),
          toasts: pushToast(s.toasts, 'Recommendation marked done', 'success'),
          ...touch(),
        }));
        auditRecommendationDone(id);
      },

      createTaskFromRecommendation: (id, title, linkedEvent) => {
        get().addTask({
          title,
          priority: 'medium',
          linkedEvent: linkedEvent ?? 'From recommendation',
          client: 'HuB on Lewis',
          owner: { initials: 'HB', name: 'Hannah Bayless' },
          dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          overdue: false,
          daysUntil: 3,
          automationSource: `Autopilot · rec ${id}`,
          automationBadge: 'ai-suggested',
        });
        set(s => ({
          recommendationStatus: { ...s.recommendationStatus, [id]: 'planned' },
        }));
      },

      completeTask: id => {
        const task = get().tasks.find(t => t.id === id);
        set(s => {
          const tasks = s.tasks.map(t =>
            t.id === id ? { ...t, status: 'completed' as const, completedAt: nowIso(), overdue: false } : t,
          );
          return {
            tasks,
            activityFeed: pushActivity(s.activityFeed, {
              category: 'task',
              summary: `Task completed · ${task?.title ?? id}`,
            }),
            toasts: pushToast(s.toasts, 'Task marked complete', 'success'),
            ...touch(),
          };
        });
        if (task) auditTaskCompleted(id, task.title);
      },

      reopenTask: id => {
        const task = get().tasks.find(t => t.id === id);
        set(s => ({
          tasks: s.tasks.map(t =>
            t.id === id ? { ...t, status: 'open' as const, completedAt: undefined } : t,
          ),
          ...touch(),
        }));
        if (task) auditTaskReopened(id, task.title);
      },

      assignTask: (id, owner) =>
        set(s => ({
          tasks: s.tasks.map(t => (t.id === id ? { ...t, owner } : t)),
          ...touch(),
        })),

      setTaskPriority: (id, priority) =>
        set(s => ({
          tasks: s.tasks.map(t => (t.id === id ? { ...t, priority } : t)),
          ...touch(),
        })),

      addTask: input => {
        const id = uid('task');
        set(s => ({
          tasks: [
            {
              ...input,
              id,
              status: 'open',
            },
            ...s.tasks,
          ],
          activityFeed: pushActivity(s.activityFeed, {
            category: 'task',
            summary: `Task created · ${input.title}`,
          }),
          toasts: pushToast(s.toasts, 'Task added to queue', 'success'),
          ...touch(),
        }));
        auditTaskCreated(id, input.title, input.automationSource);
      },

      setDealStage: stage => {
        const before = get().deal.stage;
        set(s => ({
          deal: { ...s.deal, stage },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'deal',
            summary: `Stage updated · ${stage}`,
          }),
          toasts: pushToast(s.toasts, `Event stage · ${stage}`, 'success'),
          ...touch(),
        }));
        auditDealStage(before, stage);
      },

      addDealNote: text => {
        if (!text.trim()) return;
        set(s => ({
          deal: { ...s.deal, internalNotes: [text.trim(), ...s.deal.internalNotes] },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'deal',
            summary: 'Internal note added',
          }),
          toasts: pushToast(s.toasts, 'Note saved locally', 'success'),
          ...touch(),
        }));
        auditDealNote(text.trim());
      },

      addDealTimeline: (title, channel, actor) => {
        set(s => ({
          deal: {
            ...s.deal,
            timeline: [{ title, channel, actor, at: relNow() }, ...s.deal.timeline],
          },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'deal',
            summary: `Timeline · ${title}`,
          }),
          ...touch(),
        }));
        auditDealTimeline(title);
      },

      generateDealDraft: () => {
        const draft = `Hi Kiasia — confirming your Miller/Harris baby shower on Sunday, June 7 (3:00p–7:00p) in the Event Space. Deposit received; remaining balance due before the event. Door-access details will follow in a separate note after coordinator approval. — Hannah @ HuB on Lewis`;
        set(s => ({ deal: { ...s.deal, activeDraft: draft } }));
        return draft;
      },

      queueDealDraftApproval: () => {
        const snap = getAgentEngineSnapshot();
        const draft = get().deal.activeDraft ?? get().generateDealDraft();
        const newId = uid('ap');
        const agent = snap.agentStates.find(s => s.id === 'follow-up-hunter');
        set(s => ({
          deal: { ...s.deal, draftQueued: true },
          approvals: {
            ...s.approvals,
            [newId]: {
              id: newId,
              agentId: 'follow-up-hunter',
              agent: agent?.shortName ?? 'Follow-Up Hunter',
              title: 'Queue client draft · Miller/Harris',
              description: draft.slice(0, 120) + '…',
              trigger: 'Deal workspace · Generate draft',
              confidence: 85,
              risk: 'low',
              approvalRequiredBecause: 'Client-facing message requires approval.',
              waitingOn: 'Hannah Bayless',
              linkedEvent: 'Miller/Harris Baby Shower',
              status: 'pending',
              updatedAt: nowIso(),
            },
          },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'deal',
            agent: 'Follow-Up Hunter',
            summary: 'Client draft queued for approval',
          }),
          toasts: pushToast(s.toasts, 'Draft queued for approval', 'success'),
          ...touch(),
        }));
        auditDealDraftQueued(agent?.shortName ?? 'Follow-Up Hunter');
      },

      completeDealNextAction: () =>
        set(s => ({
          deal: { ...s.deal, nextActionComplete: true },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'deal',
            summary: 'Next action marked complete',
          }),
          toasts: pushToast(s.toasts, 'Next action cleared', 'success'),
          ...touch(),
        })),

      markDepositReminderQueued: () => {
        set(s => ({
          deal: { ...s.deal, depositReminderQueued: true },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'deal',
            agent: 'Balance Guardian',
            summary: 'Deposit reminder prepared (approval-gated)',
          }),
          toasts: pushToast(s.toasts, 'Balance reminder queued — awaiting approval', 'info'),
          ...touch(),
        }));
        auditDepositReminderQueued();
      },

      selectInbox: id => set(s => ({ inbox: { ...s.inbox, selectedId: id } })),

      toggleInboxRead: id =>
        set(s => {
          const cur = s.inbox.read[id] ?? true;
          return {
            inbox: { ...s.inbox, read: { ...s.inbox.read, [id]: !cur } },
            ...touch(),
          };
        }),

      generateInboxReply: (_id, template) => {
        const drafts: Record<string, string> = {
          inquiry: `Thank you for reaching out to HuB on Lewis. We have availability for your date and would love to host your event. I've attached our standard intake questions — reply with guest count and preferred time window and we'll hold the Event Space while we prepare your proposal.`,
          proposal: `Following up on your proposal — we're excited about your event. When you're ready, you can complete the agreement and deposit steps in the portal. Let us know if you have questions on layout or catering minimums.`,
          deposit: `This is a friendly reminder that your deposit secures your date on our calendar. The remaining balance will be due before your event per your agreement. No payment links are sent until your coordinator confirms.`,
          balance: `Your event is approaching — this note confirms your remaining balance is due before load-in. Our team will send door-access details separately after approval.`,
          thanks: `Thank you for choosing HuB on Lewis. We hope your event was everything you envisioned. If you have a moment, we'd appreciate a brief review — it helps other planners discover the space.`,
        };
        const draft = drafts[template] ?? drafts.inquiry;
        set(s => ({
          inbox: { ...s.inbox, drafts: { ...s.inbox.drafts, [_id]: draft } },
        }));
        auditInboxDraftGenerated(_id);
        return draft;
      },

      queueInboxDraft: id => {
        set(s => ({
          inbox: { ...s.inbox, draftQueued: { ...s.inbox.draftQueued, [id]: true } },
          activityFeed: pushActivity(s.activityFeed, {
            category: 'inbox',
            summary: 'Inbox reply queued for approval',
          }),
          toasts: pushToast(s.toasts, 'Reply queued — no email sent', 'info'),
          ...touch(),
        }));
        auditInboxDraftQueued(id);
      },

      createTaskFromInbox: (id, subject) => {
        get().addTask({
          title: `Follow up · ${subject}`,
          priority: 'medium',
          linkedEvent: subject,
          client: 'Inbox thread',
          owner: { initials: 'HB', name: 'Hannah Bayless' },
          dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          overdue: false,
          daysUntil: 2,
          automationSource: `Inbox · ${id}`,
          automationBadge: 'approval-required',
        });
      },

      toggleAgentExpanded: agentId =>
        set(s => ({
          expandedAgents: { ...s.expandedAgents, [agentId]: !s.expandedAgents[agentId] },
        })),

      setAutomationToggle: (key, on) => {
        set(s => ({
          automationToggles: { ...s.automationToggles, [key]: on },
          ...touch(),
        }));
        auditAutomationToggle(key, on);
      },

      pulse: () => set(touch()),

      setOccupancyOverride: (key, pct) =>
        set(s => ({
          occupancyOverrides: { ...s.occupancyOverrides, [key]: pct },
          ...touch(),
        })),
    };
    },
    {
      name: DEMO_OPS_STORAGE_KEY,
      version: 2,
      partialize: s => ({
        initialized: s.initialized,
        lastPulseAt: s.lastPulseAt,
        sessionMeta: s.sessionMeta,
        occupancyOverrides: s.occupancyOverrides,
        activityFeed: s.activityFeed,
        approvals: s.approvals,
        signalStatus: s.signalStatus,
        recommendationStatus: s.recommendationStatus,
        tasks: s.tasks,
        deal: s.deal,
        inbox: s.inbox,
        automationToggles: s.automationToggles,
        expandedAgents: s.expandedAgents,
      }),
    },
  ),
);

/** Pending approval count for widgets */
export function countPendingApprovals(approvals: Record<string, DemoApprovalRecord>): number {
  return Object.values(approvals).filter(a => a.status === 'pending').length;
}
