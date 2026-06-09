# The Hub CRM — smoke test checklist

Manual checks before a demo or release. Adjust for your tenant and credentials.

## Environment

- [ ] `MONGODB_URI` points at the intended cluster and database path matches **`DB_NAME`**.
- [ ] `JWT_SECRET` length ≥ 32 in API environment.
- [ ] Web **`VITE_API_URL`** (if used) points at API base including `/api` where applicable.
- [ ] Review **`VITE_FEATURE_*`** flags for legacy modules if the demo needs bookings, fulfillment, closeout, or proposals UI.

## Authentication

- [ ] Login with a known user succeeds.
- [ ] Logout clears session; protected routes redirect to `/login`.
- [ ] Legacy token migration: existing users who only had old keys should still sign in after upgrade (or accept one-time re-login).

## Core CRM (primary nav)

- [ ] **Dashboard** loads without error for an allowed role; restricted roles see the restricted empty state if applicable.
- [ ] **My Work** lists or empty state renders.
- [ ] **Leads** list, filters, and create/update flows (as far as your role allows).
- [ ] **Accounts** (`/accounts`) list opens; row opens **account detail** (`/accounts/:id`).
- [ ] **Opportunities** (`/opportunities`) list and key actions work.
- [ ] **Follow-ups** list links to the correct account detail with interaction context.
- [ ] **Pipeline** (`/pipeline-pressure`) loads; link to opportunities works.
- [ ] **Insights** (`/forecast-review`) loads.
- [ ] **Rep scorecards**, **Weekly cadence**, **Account coverage**, **Account expansion** — open each page (even if empty).

## Admin workspace

- [ ] **Admin workspace** visible only for admin/super_admin.
- [ ] User list loads; create/edit user works if you test it in a safe environment.

## Route aliases (bookmark parity)

- [ ] `/companies` shows the same **accounts** list as `/accounts`.
- [ ] `/companies/:id` matches `/accounts/:id` for the same account.
- [ ] `/deals` matches `/opportunities` for the opportunities list.
- [ ] `/units` and `/bookings` behave the same (subject to feature flag).
- [ ] `/builds` and `/proposals` behave the same (subject to feature flag).
- [ ] `/production` and `/fulfillment` behave the same (subject to feature flag).
- [ ] `/delivery` and `/closeout` behave the same (subject to feature flag).

## Legacy modules (feature flags)

- [ ] With flags **off** (production default): visiting legacy paths shows a clear **module not enabled** message.
- [ ] With flags **on**: legacy screens render fully (bookings, proposals, fulfillment, closeout).
- [ ] Vite **dev** server: confirm default-on legacy modules unless overridden in `.env`.

## Database name behavior

- [ ] Switching to a **wrong** `DB_NAME` (empty DB) yields empty lists — treat as config error, not app bug.
- [ ] After fixing `DB_NAME`/`MONGODB_URI`, data reappears.

## Regression spot-checks

- [ ] No console errors on hard refresh on dashboard and account detail.
- [ ] Theme toggle still works.

## Automated tests

- [ ] `npm run typecheck` — pass.
- [ ] `npm run build` — pass.
- [ ] **No `npm test` script** in current workspaces unless you add one.
