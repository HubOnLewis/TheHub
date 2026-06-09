# Hub CRM — Demo Interaction Layer

Governing context: [HUB_CRM_MASTER_CONSTITUTION.md](./HUB_CRM_MASTER_CONSTITUTION.md) · Agent foundation: [HUB_AUTOPILOT_AGENT_FOUNDATION.md](./HUB_AUTOPILOT_AGENT_FOUNDATION.md).

This document describes **local, interactive demo state** used for client review and tomorrow’s walkthrough. Nothing here sends email, charges cards, or writes to production MongoDB.

---

## What is local vs API

| Local demo state (`demoOpsStore`) | Live API (unchanged) |
|-----------------------------------|----------------------|
| Autopilot approvals (approve/dismiss/queue/edit) | Dashboard stats when logged in |
| Activity feed entries | Deals/leads when backend available |
| Task complete/reopen/assign/priority | Auth session |
| Deal stage, notes, timeline additions | |
| Inbox read/draft/queue | |
| Toasts and pulse timestamps | |

Seeded data still originates from `perfectVenueSeed.ts` and `mockAgentEngine.ts`. The store **records reactions** to that data.

---

## Persistence

- **Storage key:** `hub-crm-demo-ops` (localStorage via Zustand persist)
- **Review notes:** separate key `hub-crm-review-notes` (existing)
- Works in normal demo login and screenshot mode

---

## Reset before a meeting

**In the app:** Autopilot page → **Reset demo state** (top right).

**In the browser console:**

```javascript
localStorage.removeItem('hub-crm-demo-ops');
localStorage.removeItem('hub-crm-review-notes');
location.reload();
```

---

## Safe to demo tomorrow

- Approve / dismiss / queue Autopilot items — UI updates, feed grows, toasts confirm
- Mark signals reviewed; plan recommendations; create tasks from recommendations
- Complete tasks, change priority/owner, filter Open/Completed/Autopilot
- Opportunity detail: change stage, add notes, generate/queue drafts, deposit reminder queued
- Inbox: select thread, generate template reply, queue for approval, create task
- Owner Briefing: operating memo + live feed
- Dashboard: live operations feed + pulse counts
- User Management: Jason Lavender, Hannah Bayless (`/user-management` or Settings)
- Review Notes: add / Planned / Done (`/review-notes` or Settings)

---

## Intentionally approval-gated

- Client-facing email (inbox + deal drafts)
- Payment links and balance sends
- Kisi / door-access emails (queued as approvals)

Trust copy appears once per page via **Ops trust strip** — not on every button.

---

## Future backend endpoints (replace local store)

| Action | Suggested API |
|--------|----------------|
| Evaluate agents | `GET /agents/snapshot` |
| Decide approval | `POST /agents/approvals/:id/decide` |
| Tasks CRUD | Existing `/tasks` routes |
| Inbox draft | `POST /inbox/threads/:id/drafts` |
| Activity audit | `GET /activity?since=` |

Keep the same TypeScript shapes as `AgentEngineSnapshot` and `DemoOpsState` where possible for a thin migration.

---

## Key files

- `packages/web/src/state/demoOpsStore.ts`
- `packages/web/src/components/demo/DemoToastStack.tsx`
- `packages/web/src/components/demo/DemoOpsInit.tsx`
- `packages/web/src/components/demo/LiveOperationsFeed.tsx`
- `packages/web/src/components/demo/OpsTrustStrip.tsx`
- `packages/web/src/styles/command-center.css`
