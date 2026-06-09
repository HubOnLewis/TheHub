# MTTE Core — Dealership Workflow Specification

**Status:** Phase 2 locked  
**Controls:** MTTE_CORE_BUILD_DIRECTION.md  
**Scope:** Lead lifecycle, deal lifecycle, ownership rules, stale logic, required fields, manager visibility

This file defines how the sales workflow operates inside MTTE Core.
It is the reference for every status, field, and rule decision made during Phase 2 and 3 builds.

---

## 1. Lead Lifecycle

A lead is an inbound or prospected opportunity that has not yet been committed to a formal deal.
Leads belong to a salesperson and a tenant. They are the front end of the pipeline.

### Lead Statuses

| Status | Operational Meaning | Active / Needs Attention |
|---|---|---|
| **New** | Just entered the system. No contact made yet. | ✅ Yes — needs first touch |
| **Contacted** | Salesperson has made at least one contact attempt. Awaiting response or revisit. | ✅ Yes — needs follow-up |
| **Working** | Active engagement. Multiple touches, real conversation in progress, requirements being understood. | ✅ Yes — should be progressing |
| **Quoted** | A formal spec, proposal, or quote has been delivered to the customer. Customer is evaluating. | ✅ Yes — needs decision push |
| **Converted** | A deal has been created from this lead. Lead is closed as a success. | ❌ No — terminal |
| **Lost** | Opportunity is dead. Customer chose competitor, budget gone, timing failed. | ❌ No — terminal |

### Lead Flow

```
New → Contacted → Working → Quoted → Converted
                                    ↘ Lost (can exit from any active status)
```

**Rules:**
- Any active status (New, Contacted, Working, Quoted) can move directly to Lost.
- Converted requires a deal to have been created and linked — it is set by the system when a deal is created with `leadId` pointing to this lead, or manually when the salesperson advances the lead.
- A lead should never sit at New for more than 1 business day without a touch.
- "Working" is the right status when the customer is engaged but hasn't received a formal quote yet.

**What was removed and why:**
- `Won` — Leads are not won. Deals are won. Using Won on a lead conflated two different things. Converted is the correct terminal state for a successful lead.

---

## 2. Deal Lifecycle

A deal is a formal commercial opportunity being tracked through a sales approval and fulfillment process.
Deals are the core accountability unit for managers and the eventual tie-in to Karmak.

### Deal Stages

| Stage | What It Means Operationally | Who Owns It | Gate Before Advancing |
|---|---|---|---|
| **Draft** | Deal is being structured by the salesperson. Not submitted for review yet. May not have all info. | Salesperson | None — open entry |
| **Pending Approval** | Salesperson has submitted the deal for manager review. Margin, terms, and unit should be set. | Manager (review) | Amount > 0 required |
| **Approved** | Manager has approved the deal structure. Customer agreement in progress or confirmed. | Salesperson | Manager approval action |
| **Won** | Customer has committed. Paperwork signed or verbal commitment confirmed. | Salesperson → moves to F&I / ops | Unit must be linked |
| **In Build** | Unit is being prepped, built, or configured. Triggers Karmak work order (future). | Service / ops | Won status must precede |
| **Delivered** | Unit physically delivered to customer. Deal is complete. | Complete — no owner | In Build precedes |
| **Lost** | Deal fell through at any point. Document reason in notes. | N/A | Can exit any non-terminal stage |

### Deal Flow

```
Draft → Pending Approval → Approved → Won → In Build → Delivered
                                          ↘ (stock unit: may skip In Build and go to Delivered directly)
Any active stage → Lost
```

**Rules:**
- A deal should not advance to Pending Approval without a non-zero amount.
- A deal should not advance to Won without a unit linked (`unitId` required at Won).
- Lost deals should include a notes entry explaining why (encouraged, not enforced in v1).
- Delivered and Lost are terminal — no further status changes expected.
- Deals should not regress (e.g., Approved → Draft) without admin action. This is a soft rule for now.

**Stage ownership meaning for managers:**
- Draft with no activity after 5 days = salesperson needs a push
- Pending Approval older than 2 business days = manager has not reviewed it
- Approved older than 7 days with no Won = deal may be stalling
- Won with no movement in 14 days = build or delivery followup needed

---

## 3. Ownership Rules

### Lead Ownership
- Every lead must have an `assignedTo` (salesperson ID or name). Not optional.
- Leads default to the creating user if no `assignedTo` is provided at creation.
- Ownership can be reassigned by admin, manager, or the current owner.
- If a lead has no `assignedTo` it is considered an ownership gap and should surface as such in manager views.

### Deal Ownership
- Every deal must have an `assignedTo`. Not optional.
- Deals default to the creating user if no `assignedTo` is provided at creation.
- Managers can reassign deals at any stage.
- If a deal moves to Won or beyond, the salesperson should remain on record for commission tracking.

### Cross-Tenant Visibility
- `sales` role sees only their tenant (entity + location).
- `management` role sees their entity across locations (all WKI locations, or all MTTE locations).
- `admin` and `super_admin` see everything across all entities.
- No cross-entity visibility for sales — a Wichita WKI rep cannot see MTTE Dodge City records.

### Accountability on Stale Records
- Managers can view any stale record in their scope and reassign it.
- If a salesperson is deactivated, their leads should remain visible to managers — they are not deleted or hidden.
- Re-assignment of an orphaned lead resets the stale clock.

---

## 4. Stale Logic

Stale detection drives the accountability layer. These thresholds are operational defaults, not hard rules — they may need tuning based on actual usage.

### Lead Staleness

| Status | Stale After | Meaning |
|---|---|---|
| New | **1 business day** | Never contacted — needs first touch urgently |
| Contacted | **3 days** | No follow-up after initial contact |
| Working | **5 days** | Active conversation has gone cold |
| Quoted | **7 days** | Proposal sent, no response — needs a push |

- Stale detection uses `lastTouchedAt` (not `updatedAt`). Editing notes or changing the record should not reset a stale clock unless the intent is a real customer touch. *(See implementation note below.)*
- Current implementation uses `updatedAt` — this is acceptable for v1 but should migrate to `lastTouchedAt` before Phase 3 dashboard work.

### Deal Staleness

| Stage | Stale After | Meaning |
|---|---|---|
| Draft | **5 days** | Not submitted — may be abandoned |
| Pending Approval | **2 business days** | Waiting on manager — needs attention |
| Approved | **7 days** | Approved but not Won — customer followup needed |
| Won | **14 days** | Committed deal not moving to build — logistics gap |
| In Build | **30 days** | Build stalled — production followup needed |

- Delivered and Lost have no stale threshold.

---

## 5. Minimum Required Fields

### Creating a Lead
| Field | Required | Notes |
|---|---|---|
| `company` | ✅ Yes | Who is the customer |
| `contact` | ✅ Yes | Name of person we talked to |
| `assignedTo` | ✅ Yes | Defaults to creator — must not be blank |
| `status` | Defaults to `New` | |
| `email` or `phone` | ❌ No (v1) | At least one encouraged, not enforced yet |
| `source` | ❌ No | Encouraged (walk-in, referral, etc.) |

### Creating a Deal
| Field | Required | Notes |
|---|---|---|
| `title` | ✅ Yes | Descriptive — e.g. "2025 Kenworth T680 — Acme Trucking" |
| `company` | ✅ Yes | Customer company |
| `contact` | ✅ Yes | Person at that company |
| `assignedTo` | ✅ Yes | Defaults to creator — must not be blank |
| `amount` | Required at Pending Approval | Can be 0 at Draft stage |
| `unitId` | Required at Won | Must be linked before deal is won |
| `leadId` | ❌ No | Recommended — links deal back to originating lead |

### Advancing a Deal Stage
| Advancing to | Required Conditions |
|---|---|
| Pending Approval | `amount > 0` |
| Won | `unitId` linked |
| In Build | Must be Won first (system enforced) |
| Delivered | Must be In Build or Won (system enforced) |

---

## 6. Manager Visibility Requirements

This section drives dashboard and list design in Phase 3.

A sales manager opening MTTE Core should immediately see:

### Critical / Needs Action Today
- Leads at **New** with no touch in > 1 day
- Deals stuck at **Pending Approval** for > 2 days (awaiting their own review)
- Leads with no `assignedTo` (ownership gaps)

### Pipeline Health
- Deal count and total amount by stage (pipeline funnel view)
- Week-over-week movement: how many deals advanced, how many moved to Lost
- Active pipeline total (sum of all non-terminal deal amounts)

### Aging / Stalled
- Leads by status with days-since-last-touch
- Deals stuck in a stage beyond the stale threshold
- Salesperson-level summary: who has the most stale leads, who has the fewest Won deals

### Ownership
- Leads and deals by salesperson (within manager's tenant scope)
- Any lead/deal with no assignedTo surfaced as a gap

### Inventory Context
- Available units count (to correlate with Won deals that need a unit)
- Units in Reserved or In Build status (to understand fulfillment load)

---

## 7. Unit–Deal Linkage

Units (inventory) are the physical product the dealership sells. They connect to deals.

**Rules:**
- A unit can be linked to at most one active deal (status not Lost/Delivered). Enforcing this uniqueness in the DB/service layer is a Phase 3 task.
- When a deal moves to Won, the linked unit should move to `Reserved`.
- When a deal moves to In Build, the unit should move to `In Build`.
- When a deal moves to Delivered, the unit should move to `Delivered`.
- These unit status transitions are not yet enforced — they are the target behavior.

**Unit statuses reference:**
- `Available` — On the lot, not linked to any active deal
- `Reserved` — Linked to a Won deal, awaiting build or delivery
- `In Build` — Being prepped, configured, or built
- `Delivered` — Sold and delivered
- `Demo` — Demo unit, not available for sale

---

## Implementation Notes (Not Yet Built)

These items are called out for future builds and should not be skipped:

1. **`lastTouchedAt` field on Lead** — separate from `updatedAt`. Only reset when a real customer interaction is logged. Critical for accurate stale detection.
2. **Unit–deal status sync** — when deal status changes, unit status should follow automatically in `DealService`.
3. **Lead.status = Converted trigger** — when a deal is created with a `leadId`, set the linked lead to `Converted` automatically in `DealService.create`.
4. **Stage-advance guard enforcement** — server-side blocking of invalid transitions (e.g., cannot set Won without unitId).
5. **Ownership gap detection query** — `GET /leads?assignedTo=unset` or equivalent for manager dashboard.
