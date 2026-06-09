# HuB CRM — Client demo runbook

Governing product law: `docs/HUB_CRM_MASTER_CONSTITUTION.md`.

This runbook is for **tomorrow’s client walkthrough** — local client review mode with sanitized Perfect Venue seed data, light theme default, and **no live** email, SMS, or payments.

---

## Local run (recommended)

From repo root, in **PowerShell**:

```powershell
$env:VITE_SCREENSHOT_MODE="true"
npm run dev:web
```

**URL:** [http://localhost:5173](http://localhost:5173)

- Auto sign-in as demo admin; light theme applied.
- No API or MongoDB required in this mode.
- Optional full stack: `npm run dev:api` in a second terminal (not needed for the walkthrough).

---

## Before the meeting

1. Open the URL above in a **fresh browser profile** or incognito window.
2. **Settings → Demo controls** → **Reset all demo state** (confirm).
3. Collapse the walkthrough guide if you prefer a cleaner frame (**Hide** on the guide bar).
4. Confirm top trust strip: actions queue locally; nothing is sent externally.

### Console reset (fallback)

```js
localStorage.removeItem('hub-crm-demo-ops');
localStorage.removeItem('hub-crm-review-notes');
localStorage.removeItem('hub-crm-audit-trail');
location.reload();
```

---

## Walkthrough sequence

Use the **walkthrough guide** (top of each step page) — **Continue →** advances in this order:

| Step | Route | Page |
|------|--------|------|
| 1 | `/dashboard` | Command overview |
| 2 | `/today` | Today operations |
| 3 | `/owner-briefing` | Owner briefing |
| 4 | `/revenue-leaks` | Revenue opportunity intelligence |
| 5 | `/autopilot` | Agent workforce |
| 6 | `/opportunities/pv-miller-harris` | Miller/Harris opportunity |
| 7 | `/audit-trail` | Audit trail |
| 8 | `/calendar` | Calendar & occupancy |
| 9 | `/inbox` | Inbox |
| 10 | `/tasks` | Tasks |
| 11 | `/user-management` | User management |
| 12 | `/review-notes` | Review notes |
| 13 | `/settings/sms-notifications` | Settings → SMS (then Payments) |

You can start mid-sequence; the guide detects the current route and offers **Back** / **Continue**.

---

## Actions to demonstrate (persist + audit)

### Autopilot (`/autopilot`)

- **Approve** one pending approval.
- **Dismiss** one signal (signal feed).
- **Create task** from a recommendation.

### Tasks (`/tasks`)

- **Complete** a Kisi-related task, then **reopen**.
- Change **priority**.
- Toggle **open / completed** filter.

### Inbox (`/inbox`)

- Select a thread.
- **Generate AI reply** → **Queue for approval**.
- **Create follow-up task**.
- **Mark read / unread**.

### Opportunity (`/opportunities/pv-miller-harris`)

- **Generate draft** → **Queue draft**.
- Add **internal note**.
- Change **status / stage**.
- **Mark deposit reminder queued** — confirm attribution bar updates.

### Audit (`/audit-trail`)

- After the above, filter or scroll — each action should appear with clean **Human / Agent** and **source** chips.

### Dashboard / Today

- Return to **Dashboard** or **Today** — live feed and session continuity strip should reflect recent actions; pulse/counts update where applicable.

### Settings (closing)

- **SMS & notifications** — queue a template locally (alert confirms nothing sent).
- **Payments** — preview payment link flow (alert only).
- **Review notes** — optional: add a note for “next build pass.”

---

## Talking points

| Topic | Message |
|--------|---------|
| **Perfect Venue familiarity** | Pipeline, events, and dollars mirror how HuB already thinks in Perfect Venue — sanitized Wichita seed, not production data. |
| **Today command center** | Single screen for what needs attention now — staffing, approvals, and movement vs. digging through modules. |
| **Owner briefing** | Executive roll-up: revenue posture, risks, and decisions without spreadsheet exports. |
| **Autopilot agents** | Specialized agents propose actions; humans approve, edit, or queue — labor reduction without black-box automation. |
| **Audit trail** | Every meaningful change is attributable (person, agent, automation) for operations and client trust. |
| **Review notes** | Jason & Hannah capture build feedback in-product during review. |
| **SMS keywords** | Keyword rules and templates are configured; provider status is simulated until Twilio credentials are connected. |
| **Payments foundation** | Deposit and balance flows are designed; Stripe (or chosen provider) connects in production — nothing charges in review mode. |
| **Production path** | Same UI routes to Hub API + MongoDB; agent runs and outbound channels move to server-side workers with real credentials. |

---

## Pages safe for the meeting

- All routes in the walkthrough table above.
- `/automation-impact` (linked from Autopilot metrics — optional depth).
- `/settings/venue-details`, `/settings/autopilot` if asked about configuration depth.

---

## Pages to avoid

- Legacy **Pipeline** modules that hit live API without screenshot mode: **Leads**, **My Work**, raw **Opportunities** list (use Miller/Harris detail instead).
- **Admin** (unless discussing operator tools).
- Legacy aliases behind gates: `/units`, `/builds`, `/production`, `/delivery` (bookings/proposals/fulfillment/closeout).
- **Forecast review**, **Rep scorecards**, **Account coverage/expansion** unless you want a tangent.

---

## If something breaks

1. **Refresh** the browser tab.
2. **Settings → Demo controls → Reset all demo state** (or console snippet above).
3. **Skip** to the next walkthrough step via **Continue →** or sidebar.
4. Use **static screenshots** under `packages/web/public/venue/hub-on-lewis/` only as a last resort for venue imagery — UI should run locally.

---

## Validation (maintainers)

```bash
npm run typecheck
npm run build
```

Both should pass before tagging a demo build.
