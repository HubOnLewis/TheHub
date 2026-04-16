# MTTE CORE v2

> Multi-location CRM + Operations Platform for WKI / MTTE / PacLease  
> Built as a production-ready monorepo with tenant-aware data isolation.

---

## Monorepo Structure

```
mtte-core/
├── packages/
│   ├── shared/          # Types, Zod schemas, constants, utils
│   │   └── src/
│   │       ├── constants/   # ENTITIES, LOCATIONS, ROLES, STATUS enums
│   │       ├── schemas/     # Zod schemas → TypeScript types
│   │       └── utils/       # formatCurrency, timeAgo, statusClass
│   │
│   ├── api/             # Express + MongoDB backend
│   │   └── src/
│   │       ├── config/      # env.ts (validated), db.ts (indexes)
│   │       ├── tenancy/     # TenantContext, resolveTenant middleware
│   │       ├── repositories/# BaseRepository + entity repos
│   │       ├── services/    # Business logic (no Express imports)
│   │       ├── routes/      # Thin HTTP controllers
│   │       ├── middleware/   # auth, validate, errorHandler
│   │       └── errors/      # AppError subclasses
│   │
│   └── web/             # React + TypeScript + Vite frontend
│       └── src/
│           ├── api/         # Typed Axios modules per entity
│           ├── store/       # Zustand (auth + activeTenantId)
│           ├── hooks/       # useLeads, useDeals (React Query)
│           ├── components/  # UI primitives + layout
│           └── pages/       # Dashboard, Leads, Deals, Customers
│
├── tsconfig.base.json   # Shared TS config (strict mode)
├── render.yaml          # One-click Render deployment
└── package.json         # npm workspaces root
```

---

## Multi-Tenancy Architecture

### Tenant ID Format
```
<entity_slug>-<location_slug>
```
Examples: `wki-wichita`, `mtte-dodge-city`, `paclease-wichita`

### Scope Resolution (per request)
```
1. SUPER_ADMIN (env: SUPER_ADMIN_EMAILS)
   → tenantId = null (sees everything)
   → Can scope via X-Tenant-Override header

2. management / admin role
   → tenantId = null (sees all by default)
   → Can scope via X-Tenant-Override header

3. All other roles (sales, service, parts)
   → tenantId = user.tenantId (hard-scoped, no override)
```

### Database enforcement
Every query goes through `BaseRepository.scope(ctx, filter)` which merges `{ tenantId }` into the MongoDB filter. **There is no path to retrieve data without tenant scoping** — it is not a UI guard, it is enforced at the query layer.

### Index strategy
All high-cardinality indexes lead with `tenantId`:
```js
{ tenantId: 1, status: 1, updatedAt: -1 }   // leads
{ tenantId: 1, assignedTo: 1, status: 1 }   // leads by rep
{ tenantId: 1, status: 1, updatedAt: -1 }   // deals
{ tenantId: 1, entityType: 1, entityId: 1 } // activities
```

### Frontend tenant switching
Management users see a **TenantSwitcher** dropdown in the sidebar. Selecting a tenant:
1. Updates `activeTenantId` in Zustand (persisted to localStorage)
2. Axios interceptor reads this on every request
3. Sends `X-Tenant-Override: wki-emporia` header
4. React Query cache is keyed on `activeTenantId` so switching invalidates stale data

---

## Layered Architecture

```
HTTP Request
  → Auth middleware (JWT verify)
    → resolveTenant (TenantContext)
      → validate middleware (Zod schema)
        → Route handler (HTTP only)
          → Service (business logic)
            → Repository (DB + tenant scope)
              → MongoDB
```

**Rules:**
- Routes call Services. Never repositories directly.
- Services call Repositories. Never `getDB()` directly.
- Repositories call `getDB()`. Nowhere else does.
- Services throw `AppError` subclasses. Never raw `Error`.
- `asyncHandler()` wraps all routes — no try/catch in route files.

---

## Setup

### 1. Install
```bash
git clone <repo>
cd mtte-core
npm install          # installs all workspaces
```

### 2. Configure
```bash
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET (min 32 chars)
```

### 3. Seed database
```bash
npm run seed
# Seeds 9 users across 4 locations × 3 entities
# Seeds 17 leads spread across all tenants
```

### 4. Run
```bash
npm run dev          # starts API (:3001) + web (:5173) concurrently
npm run dev:api      # API only
npm run dev:web      # web only
```

### 5. Deploy to Render
```bash
# Push to GitHub, connect repo in Render dashboard
# Select "Use render.yaml" — both services configure automatically
# Set MONGODB_URI in the API service environment variables
```

---

## Test Credentials

| Email                  | Password    | Role       | Tenant             |
|------------------------|-------------|------------|--------------------|
| mike@wki.com           | mtte2025!   | management | wki-wichita        |
| joey@mtte.com          | mtte2025!   | sales      | mtte-wichita       |
| august@mtte.com        | mtte2025!   | management | mtte-wichita       |
| dana@wki-emp.com       | mtte2025!   | sales      | wki-emporia        |
| ray@wki-dc.com         | mtte2025!   | sales      | wki-dodge-city     |
| pam@wki-lib.com        | mtte2025!   | sales      | wki-liberal        |
| greg@paclease.com      | mtte2025!   | sales      | paclease-wichita   |

> **Test tenant isolation**: Log in as `joey@mtte.com` — only sees MTTE Wichita leads.  
> Log in as `mike@wki.com` — can switch to any location via the sidebar switcher.

---

## Adding a New Module

1. **Schema** → `packages/shared/src/schemas/index.ts`  
   Add `CreateXSchema`, `XSchema`, derive `CreateXPayload`, `X` types.

2. **Repository** → `packages/api/src/repositories/XRepository.ts`  
   Extend `BaseRepository<XDoc>`. Add custom query methods.

3. **Service** → `packages/api/src/services/XService.ts`  
   Inject repository. Write business logic. Throw `AppError` subclasses.

4. **Route** → `packages/api/src/routes/x.ts`  
   Register `requireAuth`, `resolveTenant`. Use `validate()` + `asyncHandler()`.

5. **Register** → `packages/api/src/server.ts`  
   `app.use('/api/x', xRoutes);`

6. **Hook** → `packages/web/src/hooks/useX.ts`  
   Query key factory + `useQuery`/`useMutation` wrappers.

7. **Page** → `packages/web/src/pages/X.tsx`  
   Use the hook. No direct API calls from pages.

---

## Future Integrations

| System       | Hook Point                              | Status     |
|--------------|-----------------------------------------|------------|
| Karmak Fusion| `karmakId` / `karmakJobId` fields       | Stub ready |
| Decisiv      | `decisivCaseId` on deals               | Stub ready |
| Email ingest | `POST /api/ingest/email`               | Planned    |
| Excel import | `POST /api/import/leads`               | Planned    |
| Webhooks     | `POST /api/webhooks/decisiv`           | Planned    |

---

## Naming Conventions

| Thing            | Convention                        | Example               |
|------------------|-----------------------------------|-----------------------|
| Tenant IDs       | `{entity}-{location}` kebab       | `wki-dodge-city`      |
| Lead numbers     | `L-{ENTITY}-{YEAR}-{SEQ:4}`       | `L-WKI-2025-0047`     |
| Deal numbers     | `{YY}W{SEQ:7}`                    | `25W0001234`          |
| Stock numbers    | `{ENTITY}-{YEAR}-{SEQ:3}`         | `WKI-2025-041`        |
| Collection names | `snake_case` plural               | `leads`, `activities` |
| Services         | `PascalCase` + `Service` suffix   | `LeadService`         |
| Repositories     | `PascalCase` + `Repository` suffix| `LeadRepository`      |
| Query keys       | kebab segments in arrays          | `['leads','detail',id]`|
