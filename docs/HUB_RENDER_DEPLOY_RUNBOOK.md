# HuB CRM — Render deploy runbook (client demo)

Use this checklist when deploying with the client **without** pre-existing GitHub access. Total manual input: **two secrets** (`MONGODB_URI`, `SEED_ADMIN_PASSWORD`).

---

## What the Blueprint automates

| Item | How |
|------|-----|
| JWT signing secret | `generateValue: true` on API |
| CORS `CLIENT_URL` | Derived from `HUB_WEB_SERVICE_NAME` → `https://the-hub-crm-web.onrender.com` |
| Web `VITE_API_URL` | Build script → `https://the-hub-crm-api.onrender.com/api` |
| Team admin emails | `SUPER_ADMIN_EMAILS` in `render.yaml` |
| First login user | `preDeployCommand` seeds `jason@hubonlewis.com` when DB has **zero** users |
| Health monitoring | API `/health` |
| Client-safe feature flags | Legacy modules off in production web build |

---

## Before the meeting (30–45 min)

### 1. MongoDB Atlas (if not ready)

1. Create a free M0 cluster (region near `oregon` on Render).
2. Database user with read/write on `hub_crm`.
3. Network access: **Allow access from anywhere** (or Render egress IPs if you restrict).
4. Connection string with `/hub_crm` in the path.

### 2. Verify locally

```bash
npm install
npm run verify:deploy
```

### 3. Choose a Git host (pick one)

| Option | When to use |
|--------|-------------|
| **Your repo now** | Push to `MikeWKI/MTTECore` (or a new `hub-crm-demo` repo) — fastest |
| **Client GitHub org** | Create org during meeting, add Render GitHub app, connect repo |
| **GitLab / Bitbucket** | Render supports both — same Blueprint flow |

Render **requires** a Git remote for Blueprint sync. You do not need the client's GitHub before **your** push — only before connecting Render.

### 4. Push code

```bash
git checkout -b deploy/hub-client-demo
git add render.yaml render.secrets.template docs/HUB_RENDER_DEPLOY_RUNBOOK.md scripts/
# … add all production-needed application files
git commit -m "Add Render Blueprint with auto-wired env for HuB CRM client demo"
git push -u origin deploy/hub-client-demo
```

---

## During the meeting (15 min hands-on)

### Step A — Apply Blueprint

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect Git provider → select repo + branch `deploy/hub-client-demo`
3. Render reads `render.yaml` → review **two** prompted secrets:
   - `MONGODB_URI` — paste Atlas URI
   - `SEED_ADMIN_PASSWORD` — choose demo password (e.g. share via password manager)
4. **Apply** → both services build (~5–8 min on free tier)

Alternatively: bulk-paste `render.secrets.template` into each service's Environment tab after apply.

### Step B — Confirm deploy

| Check | URL |
|-------|-----|
| API health | `https://the-hub-crm-api.onrender.com/health` → `{"status":"ok"}` |
| Web login | `https://the-hub-crm-web.onrender.com/login` |

### Step C — First login

| Field | Value |
|-------|--------|
| Email | `jason@hubonlewis.com` |
| Password | Value you set for `SEED_ADMIN_PASSWORD` |

If login fails: Render → API → **Logs** → search `[bootstrap]` for seed status.

### Step D — Smoke test (optional, 2 min)

```bash
npm run smoke:production
```

Or manually walk: Dashboard → Leads → Events → Marketing → Referrals → Scorecard → Settings.

---

## Client demo script (10 min)

1. **Dashboard** — command summary + work queues  
2. **Leads & Prospects** — queue; keep “Operational intelligence” collapsed  
3. **Events** — filter chips; open one event → finalization checklist  
4. **Marketing** — draft-only messaging  
5. **Referrals** — create/copy a link; open `/r/DEMO` in incognito  
6. **Monthly Scorecard**  
7. **Settings → Team & Access** — show Hannah, Jason, Jaden  
8. **Privacy / Terms** — footer links (public, no login)

**Do not expand** “More tools” or Settings → System during the client walkthrough.

---

## Free-tier expectations

- **Cold start**: first request after ~15 min idle can take 30–60s. Open the app **2 minutes before** the demo.
- **Ephemeral disk**: API local uploads reset on redeploy — fine for demo; use S3 later for production attachments.

---

## Custom domain (later)

When `app.hubonlewis.com` is ready:

1. Add custom domain on **web** static site in Render.
2. Set on **API**: `CLIENT_URL=https://app.hubonlewis.com`
3. Set on **web**: `VITE_API_URL=https://the-hub-crm-api.onrender.com/api` (or API custom domain + `/api`)
4. Redeploy **web** after changing `VITE_API_URL`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login “network error” | Web `VITE_API_URL` must end with `/api`; redeploy web after env change |
| CORS error in browser | API `CLIENT_URL` must exactly match web origin (scheme + host, no trailing slash) |
| Empty data | `DB_NAME` and URI path both `hub_crm`; wrong DB → empty collections |
| Invalid credentials | API logs: bootstrap ran? Re-set `SEED_ADMIN_PASSWORD`, clear users collection once, redeploy API |
| 502 on health | Mongo unreachable — check Atlas IP allowlist and URI credentials |

---

## Handoff to client GitHub

1. Client creates GitHub org / repo.
2. `git remote add client <url>` → push `deploy/hub-client-demo`.
3. Render → service → Settings → change connected repo to client org.
4. Rotate `JWT_SECRET` and `SEED_ADMIN_PASSWORD` after demo if credentials were shared on screen.
