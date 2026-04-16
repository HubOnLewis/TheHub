# MTTE Core — Build Direction and Control File

This file is the forward-looking source of truth for the MTTE Core build as we move from concept and scaffolding into execution.

It is intentionally high level. It is not a recap document. It exists to keep implementation aligned, prevent drift, and give both ChatGPT and Claude a stable project reference.

---

## 1) Product Intent

MTTE Core is the internal operating platform intended to replace the current Voze-style CRM workflow for MTTE and eventually support the wider dealership group where appropriate.

The app is not just a lead tracker. It should become the operational sales core for:

- lead intake and follow-up
- pipeline and deal progression
- unit inventory visibility
- accountability by salesperson, manager, entity, and location
- administrative control of users, roles, and tenant scope
- future integration with Karmak/Fusion and other dealership workflows

The build should stay grounded in real dealership operations, not generic SaaS CRM patterns.

---

## 2) What We Are Actually Building

We are building a **multi-tenant dealership sales operations platform** with three layers:

### Layer A — Core CRM foundation
The minimum business-critical replacement for Voze:

- users and auth
- tenant/entity/location scoping
- leads
- deals
- units/inventory
- role-based visibility
- admin controls

### Layer B — Operational management layer
What makes this valuable beyond a generic CRM:

- pipeline discipline
- stale lead accountability
- assignment ownership
- inventory-to-deal linkage
- sales manager visibility
- clean dashboards by location/entity
- controlled workflow states instead of loose note chaos

### Layer C — Future dealership intelligence/integration layer
Only after the core is stable:

- Karmak/Fusion sync
- activity timeline / communications history
- commission or performance tie-ins
- CSI / follow-up triggers
- workflow automations
- reporting for leadership

The current repo already reflects Layer A as the primary build target, with Layer C mostly stubbed. fileciteturn0file0L1-L20

---

## 3) Product Positioning Rules

These rules should govern every major build decision.

### Rule 1
This is an **internal business system**, not a startup-style feature playground.

### Rule 2
Every screen must answer one of these:
- What needs worked?
- Who owns it?
- What stage is it in?
- What is blocked?
- What moved?
- What is aging out?

### Rule 3
Do not overbuild integrations before the core workflow is proven.

### Rule 4
Do not let “future Karmak sync” distort current architecture decisions. Build integration-ready boundaries, but finish the real user workflow first.

### Rule 5
Every data model should support leadership reporting later, even if reporting is not built yet.

---

## 4) Current Architecture Direction

The current monorepo structure is good enough to continue with and should remain the base:

- `@mtte-core/api` = Express/Node backend
- `@mtte-core/web` = React/Vite frontend
- `@mtte-core/shared` = shared schemas/types/constants

That structure is appropriate for the app’s current maturity and supports disciplined growth if we keep responsibilities clean. fileciteturn0file0L1-L20

### Keep
- npm workspace monorepo
- shared schemas/types
- React + TanStack Query + Zustand on the frontend
- Express + service/repository separation on the backend
- native MongoDB driver for now
- tenant-aware repository pattern

### Avoid right now
- introducing a heavy ORM
- microservices
- splitting auth into a separate service
- premature event-driven complexity
- trying to build every future automation before the CRUD/workflow layer is solid

---

## 5) Immediate Architectural Truth

The repo is **not** at the “start adding lots of features” stage yet.

Before forward feature expansion, the build needs to be stabilized around a few hard blockers and design decisions.

### Immediate blocker class 1 — correctness
The current repo report identified at least two meaningful correctness issues:

- admin-created users cannot log in because `password` is being stored instead of `passwordHash`
- deal creation has a tenant fallback issue that can write malformed tenant IDs in certain flows

Those are not polish items. They are foundational correctness problems and should be corrected before feature expansion. fileciteturn0file0L21-L61

### Immediate blocker class 2 — security baseline
Before broader rollout, the app needs:
- login rate limiting
- removal of known/plain dev secrets from versioned config
- regex escaping in search filters
- a clearer production env model

These are the minimum responsible baseline, not “later hardening.” fileciteturn0file0L62-L118

### Immediate blocker class 3 — workflow definition
The system has pages and entities, but the business workflow still needs to be sharpened so the UI does not drift into generic CRM behavior.

---

## 6) The Right Build Sequence From Here

## Phase 1 — Stabilize the foundation
Goal: make the current repo trustworthy.

Must complete first:
- fix auth/admin user creation bug
- fix malformed tenant fallback logic
- fix unsafe regex search handling
- add login rate limiting
- formalize env handling
- define production build/deploy path
- confirm tenant scoping and role guard behavior with regression checks

Exit condition:
The current scaffold can be trusted for internal usage and expansion.

---

## Phase 2 — Lock the business workflow
Goal: define how MTTE actually wants sales operations to function.

This phase is not mainly code. It is workflow design.

Need to explicitly define:
- lead lifecycle statuses
- deal lifecycle statuses
- who can create, edit, assign, advance, close, reopen
- required fields by stage
- what “stale” means
- what managers need to see first
- how units tie to deals
- how cross-location/cross-entity visibility should work
- what notes/activity history must exist for accountability

Exit condition:
There is one clear operating model the app is enforcing.

---

## Phase 3 — Build the manager-grade workflow UX
Goal: make the app operationally useful, not just technically complete.

Highest-value targets:
- dashboard that surfaces aging/stalled work
- stronger lead/deal ownership visuals
- stage-driven actions
- unit linking workflow
- manager/admin filtering
- clean tables and detail views
- activity timeline foundation

Exit condition:
A sales manager can open the app and immediately know what needs attention.

---

## Phase 4 — Build the operational extras
Goal: add the things that make adoption stick.

Examples:
- stale lead jobs/notifications
- nightly sync jobs
- activity/event capture
- better admin tools
- import/sync tooling
- more refined dashboards
- auditability

Only after this should major integration-heavy work accelerate.

---

## 7) What the App Must Feel Like

The product should feel:

- disciplined
- dealership-specific
- fast
- operational
- accountable
- manager-friendly
- not bloated
- not generic

It should **not** feel like:
- a generic CRM clone
- a startup demo
- a flexible notebook
- a loose spreadsheet replacement
- an “AI-first” product with weak operational bones

---

## 8) Recommended Domain Priorities

These are the business domains that deserve the most attention next.

## A. Lead ownership and accountability
This is where CRMs usually fail internally.
The system must make it obvious:
- who owns a lead
- when it was last touched
- whether it is stale
- what next action is expected

## B. Deal progression discipline
Deals should move through explicit states with intent.
A deal record should communicate:
- stage
- expected value
- linked customer/company
- linked unit if applicable
- responsible salesperson
- blockers
- expected next movement

## C. Unit visibility
Inventory cannot feel bolted on.
Units should support:
- VIN / stock lookup
- status
- assignment or linkage to deals
- dealership-usable visibility rather than consumer listing language

## D. Tenant and role clarity
This is central to the architecture and should stay clean.
Cross-tenant visibility must be deliberate, not incidental. The current repo already leans into tenant-scoped repositories and role-aware behavior, which is the correct direction. fileciteturn0file0L79-L106

---

## 9) High-Level Build Decisions To Keep Fixed

These are decisions we should treat as fixed unless there is a strong reason to change them.

### Decision
Use the existing monorepo and keep shared domain schemas centralized.

### Decision
Keep MongoDB for this build phase.

### Decision
Keep service/repository separation in the API.

### Decision
Use Zod as the contract layer between frontend and backend.

### Decision
Treat multi-tenant scoping as a first-class architectural concern, not a UI filter.

### Decision
Keep the Karmak integration boundary stubbed until the internal workflow is proven.

### Decision
Prioritize business flow quality over “feature count.”

---

## 10) What Not To Let Claude Drift Into

When using Claude or any coding model on this project, do not let it drift into:

- generic SaaS CRM advice
- adding flashy features before workflow clarity
- refactoring for elegance at the expense of delivery
- introducing unnecessary abstraction layers
- assuming one global tenant context
- implementing Karmak-heavy logic before the local workflow is solid
- broad redesigns when a surgical fix is what is needed
- replacing architecture instead of moving the current build forward

---

## 11) Recommended Next Implementation Focus

The next major work should follow this order:

1. **Stabilize the repo**
   - fix known auth/tenant/security issues
   - establish production-safe config practices
   - add minimal regression coverage

2. **Define the actual business workflow**
   - finalize statuses, transitions, ownership model, stale logic, and required fields

3. **Rework the dashboard and list/detail UX around management usefulness**
   - not just “records on a page,” but operational visibility

4. **Introduce activity history and accountability hooks**
   - timeline/event model
   - stale jobs
   - meaningful manager signals

5. **Only then push deeper on integrations and automation**

---

## 12) Guidance For Claude Use

Use this project guidance file as a control document.

When prompting Claude for implementation help:
- reference this file first
- tell Claude to preserve current architecture unless specifically asked otherwise
- require focused changes, not broad rewrites
- require dealership/business relevance in UI and workflow decisions
- require tenant safety and role clarity in backend changes
- require minimal-diff implementation when fixing known issues

### Suggested steering line for Claude
“Use `MTTE_CORE_BUILD_DIRECTION.md` as the controlling project document. Do not drift into generic CRM patterns. Preserve the current monorepo architecture unless a change is explicitly requested. Favor minimal-diff, production-minded implementation that strengthens tenant-safe dealership sales workflow.”

---

## 13) Immediate Action List

The practical next move is:

### Now
- create and commit this file
- use it as the anchor reference in future prompts

### Next coding sprint
- fix correctness/security blockers from the repo report
- create a short workflow-spec file for lead/deal lifecycle rules
- begin manager-grade dashboard refinement from that workflow spec

### After that
- build activity/history and stale accountability
- then revisit integration roadmap

---

## 14) Non-Negotiable Success Criteria

MTTE Core is successful only if:

- it can actually replace daily Voze-style usage
- managers can trust what they see
- sales staff know exactly what they own
- tenant boundaries stay reliable
- the workflow feels tailored to dealership operations
- future integrations can attach cleanly without re-architecting the whole app

If a feature does not move one of those outcomes forward, it is probably not the next thing to build.

---

## 15) Repo Report Anchor

The current technical assessment this direction file is grounded on is the repo boot report you provided, including the confirmed monorepo structure, stack, data layer, risks, and identified implementation defects. fileciteturn0file0L1-L118
