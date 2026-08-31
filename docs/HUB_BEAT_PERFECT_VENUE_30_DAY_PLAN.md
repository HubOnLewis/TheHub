# The Hub — 30-Day Plan: Beat Perfect Venue (High Level)

**Status:** Active control plan · **Implementation sprint landed (core venue OS)**  
**Audience:** Product + engineering sprints  
**Companion:** `HUB_CRM_MASTER_CONSTITUTION.md`  
**Outcome:** Venue staff can run the day without Perfect Venue; AI + portal + owner intelligence make going back feel worse.

### Shipped in this build (high level)

| Area | Status |
|------|--------|
| Venue stage labels (Inquiry → Completed) | ✅ UI language |
| True week/day calendar + space conflicts | ✅ |
| Global search (Ctrl+K) | ✅ |
| Home attention rail + next-action strip | ✅ |
| Event tabs: Overview · Money · Docs · Activity · Portal | ✅ |
| Payment links (create / copy / mark paid → CRM totals) | ✅ client ledger + importMeta |
| Proposal / BEO / payment PDF generators | ✅ print-to-PDF |
| Lead → event convert | ✅ |
| Activity (honest rename of Inbox) + AI drafts | ✅ |
| Owner briefing from live/import data | ✅ |
| Reports from live pipeline | ✅ |
| Add-event conflict confirm | ✅ |
| Stripe live / Gmail send / Express Book | ⏳ next |

---

---

## North star (one sentence)

**Match Perfect Venue on boring daily ops, then bury it with AI follow-through, conflict-aware calendar, payments, client portal, and owner briefing.**

---

## Non‑negotiable rules for 30 days

1. **One shell for staff** — PV-style top nav only: Home · Leads · Inbox · Calendar · Tasks · Reports · Settings.
2. **Venue language only** — no units / builds / In Build / equipment stages in any client-facing UI.
3. **No lying chrome** — if search, Help, Express Book, or email aren’t real, hide them until they are.
4. **Demo vs live honesty** — demo mode may show Autopilot theater; production only shows wired value.
5. **Human in command** — AI drafts and queues; humans approve and send.
6. **Event is the center** — every action (message, pay, doc, task, portal) hangs off one event record.

---

## What to SHOW vs HIDE

### Always show (day-1 product)

| Surface | Job |
|--------|-----|
| **Home** | Active events + “what needs me” |
| **Leads** | Inquiries → convert to event |
| **Event detail** | Status, money, guests, space, next action, portal |
| **Calendar** | Real week/day schedule + conflicts (after Week 1) |
| **Tasks** | Ops checklist tied to events |
| **Inbox / Activity** | Follow-ups that matter (honest label until email ships) |
| **Reports** | Simple scorecard (booked revenue, pipeline, balances) |
| **Settings** | Team, AI bridge, payments provider, venue basics |
| **Client portal** | Guest-facing checklist / pay / docs (shareable link) |

### Hide until real (do not demo as live)

| Surface | Why |
|--------|-----|
| Legacy units / builds / production / delivery | Wrong product DNA |
| Full Autopilot workforce UI in production | Until actions write real tasks/drafts |
| Marketing blasts / referral program chrome | Distracts from PV replacement |
| Express Book public booking | Until availability + deposit work |
| Read-only global search | Looks broken — ship search or remove |
| Dense owner intel modules (revenue leaks, etc.) | Until fed by live Mongo data |
| SMS / Stripe buttons that only “simulate” | Only show when provider connected |

### Demo-mode only (screenshot / walkthrough)

- Rich agent approval theater  
- Cinematic owner briefing  
- Seeded Perfect Venue stories (Miller/Harris, etc.)  
- Local-only “queue for approval” without outbound send  

Label clearly: **Demo / review mode — nothing sends externally.**

---

## Success criteria (end of 30 days)

Staff can answer **yes** to all of these:

| # | Criterion |
|---|-----------|
| 1 | I can see this week’s events on a **real calendar** and avoid double-booking a space. |
| 2 | I can open an **event**, advance stage, edit details, and know balance due. |
| 3 | I can **create a lead**, convert it to an event, and not lose the thread. |
| 4 | I can generate or attach a **proposal/BEO-style PDF** from the event. |
| 5 | I can send a **deposit or balance payment link** (test mode OK) and see status update. |
| 6 | I can share a **client portal link** for that booking. |
| 7 | I get **AI draft help** on follow-ups without auto-sending. |
| 8 | Owner can open a **simple morning briefing** from live data (not only demo seed). |
| 9 | Nav and labels feel like a **venue product**, not equipment CRM. |
| 10 | Nothing important is a dead button in the primary path. |

---

## 30-day roadmap (high level)

```
Week 1  Foundation & truth
Week 2  Money & documents
Week 3  Intelligence that acts
Week 4  Polish, portal, owner habit, kill PV dependency
```

---

### Week 1 — Foundation & truth  
**Theme:** Staff trust the schedule and the language.

| Priority | Workstream | Outcome |
|----------|------------|---------|
| P0 | **Venue stage model (UI)** | Inquiry → Proposal → Deposit → Confirmed → Prep → Event → Closed / Lost (map legacy deal statuses under the hood if needed) |
| P0 | **True calendar v1** | Week view + day list; space/room lanes; hard conflict warning on same space + overlap |
| P0 | **Single staff shell** | Production = top nav only; bury sidebar “More tools” and legacy modules |
| P0 | **Kill lying chrome** | Remove or implement search; hide Express Book; honest “Activity” label if not email |
| P1 | **Home = next actions** | Metric strip: active, balance due, this week, needs follow-up — then events table |
| P1 | **Event detail primary action** | One clear CTA by stage (e.g. Send proposal / Request deposit / Mark confirmed) |

**Demo this week:** Calendar + event create/edit + stage change.  
**Do not demo:** Autopilot theater as “live.”

**Exit:** Coordinator prefers Hub calendar over paper/Google for “what’s on this week.”

---

### Week 2 — Money & documents  
**Theme:** PV’s payment + doc loop exists in Hub.

| Priority | Workstream | Outcome |
|----------|------------|---------|
| P0 | **Payments v1** | Stripe test mode: deposit + balance links; webhook → amount paid / balance; audit entry |
| P0 | **Docs v1** | Proposal + BEO templates → PDF download (and optional email attachment later) |
| P0 | **Event money panel** | Grand total, paid, balance, “Send payment link,” last payment status |
| P1 | **Lead → event convert** | One-click convert with field carryover; no orphan leads |
| P1 | **Tasks from milestones** | Confirm / deposit / prep auto-generate a small task set on stage change |

**Demo this week:** Create event → generate proposal PDF → send test deposit link → portal link.  
**Do not demo:** Live card charges in front of client without test mode labeled.

**Exit:** Staff can run “quote → deposit → confirmed” without leaving Hub for money/docs.

---

### Week 3 — Intelligence that acts  
**Theme:** AI is useful, not decorative.

| Priority | Workstream | Outcome |
|----------|------------|---------|
| P0 | **Activity + AI draft** | Activity list from live events (stale proposal, balance due, upcoming); AI draft reply; copy/edit only |
| P0 | **Follow-Up Hunter (live)** | Surfaces aging proposals / unpaid balances as tasks or activity — no auto-email |
| P0 | **Balance Guardian (live)** | Same for balances; ties to payment link action |
| P1 | **Calendar Conflict agent (live)** | Explains conflicts; blocks or warns on save |
| P1 | **Email templates v1** (if time) | 3–5 templates with smart fields; send via integrated mail **or** copy-to-clipboard fallback |
| P1 | **Autopilot production slice** | Approval queue only for actions that create **real** tasks/drafts — no fake impact metrics |

**Demo this week:** “Here’s what needs follow-up today” → draft → create task → payment nudge.  
**Do not demo:** Fully autonomous outbound.

**Exit:** Staff open Hub first for “what should I work?” not only for storage.

---

### Week 4 — Portal, owner habit, replace PV  
**Theme:** Client experience + owner addiction + switch confidence.

| Priority | Workstream | Outcome |
|----------|------------|---------|
| P0 | **Portal live path** | Portal always bound to CRM event id; checklist + payments progress + documents reflect live data |
| P0 | **Owner briefing v1 (live)** | One page: today/this week, revenue at risk, empty high-value slots, top 5 actions |
| P1 | **Reports that match venue** | Booked vs pipeline, deposit conversion, occupancy snapshot |
| P1 | **Mobile pass** | Home, event detail, calendar day, tasks usable on phone |
| P1 | **Migration confidence** | Import health banner; empty-state honesty; smoke checklist green for Week 1–4 paths |
| P2 | **Express Book design only** | Spec + settings shell — implement only if Weeks 1–3 solid |

**Demo this week:** Full path inquiry → event → proposal → deposit → portal → owner briefing.  
**Positioning:** “Cancel Perfect Venue for daily ops; Hub is the system of record.”

**Exit:** Client can run a week of operations on Hub; PV is backup at most, not primary.

---

## Ordered workstreams (PR / sprint DAG)

High-level dependency order — do not skip upward:

```
1. Shell + venue language + hide dead chrome
        ↓
2. Calendar v1 + conflict rules
        ↓
3. Event detail next-action UX
        ↓
4. Payments foundation (Stripe test) + event money panel
        ↓
5. Proposal/BEO PDF templates
        ↓
6. Lead convert + milestone tasks
        ↓
7. Live activity feed + AI drafts
        ↓
8. Live agents (follow-up + balance + conflict) → real tasks
        ↓
9. Portal bound to live events
        ↓
10. Owner briefing + reports from live data
        ↓
11. Mobile polish + smoke / demo runbook update
```

Parallel where safe:

- **Design/content:** BEO/proposal copy, email templates, portal copy  
- **Infra:** Stripe keys, webhook URL, AI/Ollama probe  
- **Data:** Keep PV import clean; no new demo-only pages in production nav  

---

## UX wireframe priorities (by screen)

### 1. Home
- **Top:** 4 metrics (Active · Balance due · This week · Needs follow-up)  
- **Main:** Events table (status, date, contact, value, balance, owner)  
- **Primary CTA:** + New event  
- **No:** multi-rail demo intel in production  

### 2. Event detail
- **Hero:** Name, status, date/time, owner, balance alert  
- **One primary button** by stage  
- **Tabs or sections:** Overview · Money · Docs · Tasks · Activity · Portal  
- **Secondary:** Edit, Add note, Copy portal link  

### 3. Calendar
- **Default:** Week view  
- **Lanes:** by space (Main Hall, Gallery, Patio, Full venue)  
- **Click:** open event; drag optional later  
- **Conflict:** red block + plain-language reason  

### 4. Activity (Inbox rename until email)
- **List:** why it matters + event link + age  
- **Action:** Draft with AI · Create task · Open event  

### 5. Client portal
- Countdown, readiness, pay progress, next checklist item  
- Calm hospitality tone — not staff command-center density  

### 6. Owner briefing
- 60-second read: money at risk, calendar holes, top actions  
- Deep links into events — no orphan charts  

---

## Role surfaces

| Role | Sees |
|------|------|
| **Coordinator** | Home, Leads, Activity, Calendar, Tasks, Event detail, Portal link |
| **Owner** | Above + Reports + Owner briefing |
| **Admin** | Settings (team, payments, AI, venue) + user admin |

No second “internal ops product” in the main nav for 30 days.

---

## Competitive messaging (for demos)

| PV has | Hub answers with |
|--------|------------------|
| Easy calendar | Calendar **plus** conflict intelligence |
| Email templates | Templates + **AI drafts** + approval |
| Stripe | Same, plus **Balance Guardian** nudges |
| Auto BEOs | Templates + path to **smarter prep packs** |
| Simple UI | Simple daily UI + **owner briefing** they don’t have |
| Staff-only | **Client portal** guests actually use |

**Never say:** “We’re almost like Perfect Venue.”  
**Say:** “Same jobs, fewer tools, smarter follow-through, better client experience.”

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Building AI before calendar/payments | Weeks 1–2 freeze on Autopilot chrome |
| Legacy deal model blocks venue stages | Display map first; migrate storage later |
| Demo oversells production | Updated demo runbook; production alpha nav strict |
| Stripe / email delayed | Payment link + PDF download still beat “nothing”; clipboard email fallback |
| Scope creep (marketing, referrals, Express Book) | P2 parking lot until exit criteria met |

---

## Weekly check-in questions

1. Can staff run **this week’s events** without PV?  
2. What still forces Excel, Gmail, or PV?  
3. Did we ship **one** thing staff touch daily, or only intel screens?  
4. Any dead buttons left in the primary path?  
5. Is production still free of demo theater?

---

## After day 30 (parking lot)

- Real email send (Gmail/Outlook)  
- Express Book / public inquiry + deposit  
- Google Calendar sync  
- Full BEO automation from menus/staffing  
- Floorplans  
- SMS reminders (Twilio)  
- Multi-venue SaaS packaging  
- Deep Autopilot autonomous modes  

---

## Immediate next sprint (start here)

1. Lock venue stage labels + primary CTAs on event detail.  
2. Ship calendar week view + space conflict warning.  
3. Strip production nav/chrome to the SHOW list above.  
4. Then payments + PDF — not more dashboard pages.

---

*This plan is the high-level execution control file. Implementation sprints should reference week + P0 items, not invent parallel product surfaces.*
