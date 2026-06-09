# Hub Autopilot — Agent Foundation

Governing product context: [HUB_CRM_MASTER_CONSTITUTION.md](./HUB_CRM_MASTER_CONSTITUTION.md).

This document describes the **real internal foundation** for agent orchestration in The Hub CRM web app, and what remains demo-only until a backend execution layer exists.

---

## Architecture overview

```
perfectVenueSeed.ts (sanitized venue data)
        │
        ▼
mockAgentEngine.ts ──► AgentEngineSnapshot
        │                    ├── signals
        │                    ├── recommendations
        │                    ├── proposedActions / pendingApprovals
        │                    ├── activities
        │                    ├── agentStates
        │                    └── ownerBriefing / dealRail / dashboardWidget
        ▲
registry.ts (8 AgentDefinition objects)
        │
types.ts (shared contracts)
        │
        ▼
autopilotDemo.ts / executiveDemo.ts / UI pages
```

**Registry** (`packages/web/src/agents/registry.ts`) defines the canonical eight agents.

**Mock engine** (`packages/web/src/agents/mockAgentEngine.ts`) deterministically evaluates the sanitized Perfect Venue seed and produces structured outputs. It does not call external APIs, send email, or mutate data.

**UI adapters** (`autopilotDemo.ts`, `executiveDemo.ts`) map engine snapshots into view models for React pages.

---

## The eight core agents

| ID | Agent | Primary role |
|----|--------|----------------|
| `lead-concierge` | Lead Concierge | Inquiry drafts, intake routing |
| `follow-up-hunter` | Follow-Up Hunter | Stale proposals, deposit nudges |
| `booking-coordinator` | Booking Coordinator | Kisi tasks, prep, load-in |
| `revenue-lift` | Revenue Lift | Add-on suggestions |
| `balance-guardian` | Balance Guardian | Balances due, deposit aging |
| `review-referral` | Review & Referral | Post-event thank-you |
| `calendar-conflict` | Calendar Conflict | Density, flips, access windows |
| `owner-briefing` | Owner Briefing | Morning digest for owner |

Each `AgentDefinition` includes: purpose, capabilities, watched signals, proposed action types, approval policy, safety notes, run mode, and priority.

---

## Run modes

| Mode | Behavior |
|------|----------|
| `observe_only` | Emit signals only; no outbound |
| `suggest` | Surface recommendations; human promotes |
| `queue_for_approval` | Proposed actions enter approval queue |
| `autonomous_low_risk` | Internal/low-risk steps without client send |

Current build: **no autonomous client email or payment links**. Even `autonomous_low_risk` is limited to internal summaries and thank-you drafts pending future policy.

---

## Safety and approval model

- Every agent has an `approvalPolicy` with `requiresApproval` and `approvalReason`.
- `AgentProposedAction` records: trigger, confidence, risk level, `approvalRequiredBecause`, and `approvalStatus`.
- UI shows **Approve / Edit / Dismiss** as disabled in demo mode; production will persist decisions to an orchestration API.
- PII rules from seeding apply: engine reads sanitized seed only, never raw export JSON.

---

## Mock engine behavior (current)

On first `getAgentEngineSnapshot()`:

1. Scans `PV_PIPELINE_EVENTS` for balances, proposals, qualified/lost states.
2. Scans `PV_TASKS` for **Send Kisi Email** automated tasks.
3. Emits calendar/density signals (June load-in cluster, Investor Lunch today).
4. Builds recommendations (Kisi batch, Miller/Harris follow-up, WAREIA deposit, etc.).
5. Queues pending approvals with explicit triggers and approval reasons.
6. Derives per-agent runtime state (status, queue depth, last signal, confidence).
7. Feeds Owner Briefing and Deal Detail Autopilot rail from flagship deal + pending actions.

Cache is session-stable; `resetAgentEngineCache()` clears it for dev hot-reload.

---

## Demo-only vs real foundation

| Real foundation (in repo now) | Demo-only (UI / no backend) |
|------------------------------|-----------------------------|
| Type system & agent registry | Approve / Dismiss buttons (disabled) |
| Deterministic evaluation pipeline | Impact metrics (28h saved, 88% cleared) |
| Signal → recommendation → action graph | Actual email send / Kisi API |
| Structured approval queue model | MongoDB persistence of runs |
| Seed-driven triggers | Multi-tenant agent scheduling |

---

## Future backend execution path

Recommended production steps:

1. **API routes** — `POST /agents/evaluate`, `GET /agents/snapshot`, `POST /agents/approvals/:id/decide`
2. **Worker queue** — Redis/Bull or Render background worker for scheduled evaluation
3. **Event bus** — CRM writes (deal stage, task created) enqueue re-evaluation
4. **Persistence** — `agent_runs`, `agent_signals`, `agent_proposed_actions` collections with tenantId
5. **Execution adapters** — email (SendGrid), access (Kisi), calendar (internal) behind approval gate
6. **Audit log** — immutable record of who approved what and what executed

Frontend should swap `getAgentEngineSnapshot()` for API fetch + React Query, keeping the same `AgentEngineSnapshot` shape.

---

## Next steps toward production orchestration

1. Mirror `AgentEngineSnapshot` in `packages/shared` for API contracts.
2. Implement server-side evaluator reusing registry rules (port `mockAgentEngine` logic).
3. Wire Dashboard / Autopilot / Owner Briefing to live snapshot endpoint.
4. Enable approval actions for Owner/Coordinator roles only.
5. Add per-venue agent toggles in Settings (already UI shells).
6. Instrument metrics: signals/hour, approval latency, false-positive rate.

---

## Related files

- `packages/web/src/agents/types.ts`
- `packages/web/src/agents/registry.ts`
- `packages/web/src/agents/mockAgentEngine.ts`
- `packages/web/src/data/perfectVenueSeed.ts`
- `packages/web/src/data/autopilotDemo.ts`
- `packages/web/src/pages/AutopilotPage.tsx`
