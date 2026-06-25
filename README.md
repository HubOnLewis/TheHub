# The Hub CRM

> Premium, automation-first venue operating system for **HuB on Lewis** and future multi-tenant SaaS — booking lifecycle, Autopilot agent workforce, owner intelligence, and CRM workflows.  
> Monorepo: Express + MongoDB API, React (Vite) web app, shared Zod schemas and types.

---

## Monorepo layout

```
packages/
  shared/     # Types, Zod schemas, constants, ui label helpers, utils
  api/        # Express API, repositories, services, tenant middleware
  web/        # React UI (The Hub CRM web app)
```

Workspace packages are published internally as `@hub-crm/shared`, `@hub-crm/api`, `@hub-crm/web`.

---

## Product constitution

See **`docs/HUB_CRM_MASTER_CONSTITUTION.md`** — governing intent for venue realism, automation visibility, agentic AI, and screenshot-grade UX.

---

## Tenancy

Tenant IDs use `{entity}-{location}` in kebab-case. For **HuB on Lewis** operator / demo installs the canonical example is **`hub-wichita`**.

Scoped roles and `X-Tenant-Override`: see `packages/api/src/tenancy/index.ts`.

### Database name (`DB_NAME`)

- **New installs** should use `hub_crm` with a `MONGODB_URI` whose path targets that database.
- **Older cloned databases** may use a different name — keep **`DB_NAME`** and the URI segment **aligned** or the API will connect to an empty database (looks like “no data”).
- Application code does **not** hardcode production database names; configuration lives in env only.

### Feature flags (web)

Legacy-adapted screens (bookings, fulfillment, closeout, proposals) use `VITE_FEATURE_*` (see `.env.example`). When unset, **Vite dev** defaults these **on** for local work; **production builds** default them **off** unless set to `true` in the host environment.

### Session storage

The SPA may read a legacy auth storage key once to migrate tokens to Hub-branded keys — intentional for upgrades after rebrand.

---

## Local setup — starting The Hub CRM

```bash
npm install
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET (≥32 chars), DB_NAME aligned with URI
```

### Run API + web (native)

**API** listens on **http://localhost:3001**.  
**Web app** (The Hub CRM UI) listens on **http://localhost:5173**.

```bash
npm run dev:api    # API → http://localhost:3001
npm run dev:web    # The Hub CRM web app → http://localhost:5173
```

### Screenshot mode (no API or Mongo required)

Local-only: set the env var when starting Vite (PowerShell: `$env:VITE_SCREENSHOT_MODE="true"; npm run dev:web`).

Screenshot mode:

`VITE_SCREENSHOT_MODE=true`

`npm run dev:web`

(no API or Mongo required)

### Seed local demo admin (optional)

Creates the first `super_admin` for development — **local/dev only**, not production secrets:

```bash
node scripts/seed-admin.mjs
```

Defaults are defined in `scripts/seed-admin.mjs` and can be overridden with **`SEED_ADMIN_*`** variables in `.env` (see `.env.example`). **Do not commit real passwords.**

### Default local demo login (after seed only)

If you seeded with the script defaults and have not overridden `SEED_ADMIN_*`:

| Field | Value |
|--------|--------|
| Email | `admin@hubonlewis.com` |
| Password | `HubAdmin123!` |

Change the password after first login on any shared machine.

### Docker (MongoDB + API + web)

```bash
docker-compose up
```

Same URLs: API **3001**, web **5173**.

### Login troubleshooting

| Symptom | What to check |
|--------|----------------|
| **Invalid credentials** | Run `node scripts/seed-admin.mjs` again — it **updates** the password for `admin@hubonlewis.com` if that user already exists. Ensure `.env` **`SUPER_ADMIN_EMAILS`** includes `admin@hubonlewis.com`. |
| **Network / cannot reach API** | Start **`npm run dev:api`**. MongoDB must match **`MONGODB_URI`** / **`DB_NAME`**. |
| **Wrong URL** | If you set **`VITE_API_URL`**, use **`http://localhost:3001/api`** (with `/api`). Or omit `VITE_API_URL` and rely on the dev proxy. The web client auto-appends `/api` when you only pass the host. |

---

## Deploy (Render)

**Runbook:** [`docs/HUB_RENDER_DEPLOY_RUNBOOK.md`](docs/HUB_RENDER_DEPLOY_RUNBOOK.md)

The Blueprint (`render.yaml`) auto-wires JWT, CORS, and API URLs from service names. On first apply you only paste **two** secrets from `render.secrets.template`:

- `MONGODB_URI` (MongoDB Atlas)
- `SEED_ADMIN_PASSWORD` (first-login password for `jason@hubonlewis.com`)

```bash
npm run verify:deploy          # typecheck + production build
npm run smoke:production       # after live deploy (optional)
```

Default alpha URLs: `https://The-Hub.onrender.com` (web), `https://The-Hub-Api.onrender.com` (API).
 * Render may lowercase public URL slugs for default *.onrender.com web URLs.
 * Production API uses custom domain: https://api.hubonlewis.com

---

## Import scripts (optional)

Node scripts under `scripts/` support bulk import from CSV/Excel for migration projects. Internal `source` fields may store historical values for deduplication — not user-facing branding.

---

## Navigation (web)

Primary nav emphasizes Hub CRM workflows. Legacy fulfillment modules (`/builds`, `/production`, `/delivery`, `/units`) remain routable when feature flags allow but may be omitted from the main menu.

---

## Conventions

- Routes and collections may use internal names (`deals`, `companies`, `units`, `builds`) for API compatibility; UI copy uses **accounts**, **opportunities**, **bookings**, **proposals**, **fulfillment**, and **closeout** where appropriate.
- Pipeline stage *values* in the database remain existing strings; `dealStatusForDisplay()` maps them to Hub-friendly labels in the UI.

---

## Venue imagery (web)

Place final photography under **`packages/web/public/venue/hub-on-lewis/`** (see **`packages/web/public/venue/hub-on-lewis/README.md`**). Settings → Venue profile and proposal previews reference these paths once files exist.

---

## Internal migration notes

Technical notes for upgrades from older forks: **`docs/hub-crm-migration-notes.md`**.
