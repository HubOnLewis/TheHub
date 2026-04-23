# Code Citations

## License: unknown
https://github.com/gusmfs/netclient/blob/d68cd1e18bf274b8cecc4cb22eacf85b6cb15bb9/README.md

```
Now I have the complete picture. Making all changes:I don't have a direct file-write tool in this session, but VS Code will show an **Apply** button on each code block below. I'll go through each file in order.

---

### Fix 1 — `packages/api/src/services/AdminService.ts`

**Bug:** field stored as `password`, read back as `passwordHash` → all admin-created logins fail silently. Also strips hash from the create response.

```typescript
// packages/api/src/services/AdminService.ts
import type { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { ConflictError, NotFoundError } from '../errors/index.js';
import type { CreateUserPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';

export class AdminService {
  async listUsers(db: Db) {
    // listAll already projects { passwordHash: 0 } — safe to return directly
    return UserRepository.listAll(db);
  }

  async createUser(db: Db, payload: CreateUserPayload) {
    const existing = await UserRepository.findByEmail(db, payload.email);
    if (existing) throw new ConflictError('Email already in use');

    const tenantId = buildTenantId(payload.entity as Entity, payload.location as Location);
    const hashed   = await bcrypt.hash(payload.password, 12);

    const inserted = await UserRepository.insertOne(db, { tenantId } as never, {
      tenantId,
      name:         payload.name,
      email:        payload.email.toLowerCase(),
      passwordHash: hashed,           // ← was: password (BLOCKER fix)
      role:         payload.role,
      entity:       payload.entity,
      location:     payload.location,
      active:       true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    });

    // Never return the hash to the client
    const { passwordHash: _pw, ...safeUser } = inserted as typeof inserted & { passwordHash?: string };
    return safeUser;
  }

  async deactivateUser(db: Db, id: string) {
    const ok = await UserRepository.deactivate(db, id);
    if (!ok) throw new NotFoundError('User');
  }

  async stats(db: Db) {
    const superCtx = {
      tenantId: null, defaultEntity: '', defaultLocation: '',
      isCrossTenant: true, isSuperAdmin: true,
    };
    const [leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus] = await Promise.all([
      LeadRepository.byTenantCounts(db),
      DealRepository.byTenantCounts(db),
      LeadRepository.statusCounts(db, superCtx),
      DealRepository.statusCounts(db, superCtx),
    ]);
    return { leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus };
  }

  async syncStatus(db: Db) {
    return db.collection('karmak_sync').find({}).sort({ lastSyncAt: -1 }).limit(50).toArray();
  }
}

export const adminService = new AdminService();
```

---

### Fix 2 — `packages/api/src/tenancy/index.ts`

**Change:** add `defaultLocation` to `TenantContext` so services can build valid tenant IDs without hardcoding a location.

```typescript
// packages/api/src/tenancy/index.ts
//
// TENANT ARCHITECTURE
// ───────────────────
// TenantId format: "<entity_slug>-<location_slug>"  e.g. "wki-wichita", "mtte-dodge-city"
//
// Every authenticated request resolves to exactly one TenantContext.
// The context flows through req.tenant and is injected into every
// repository method — no route or service ever manually adds { tenantId }.
//
// Scope resolution order:
//  1. If user is SUPER_ADMIN → tenantId = null (sees everything)
//  2. If user has CROSS_TENANT_ROLE + X-Tenant-Override header → use override
//  3. If user has CROSS_TENANT_ROLE + no header → tenantId = null (sees everything for their entity)
//  4. All other roles → tenantId = user.tenantId (hard-scoped to their location)

import type { Request, Response, NextFunction } from 'express';
import { CROSS_TENANT_ROLES } from '@mtte-core/shared';
import { env } from '../config/env.js';

export interface TenantContext {
  /** null = no filter applied (management/admin viewing all) */
  tenantId: string | null;
  /** The entity the request resolves to, for use in new-document creation */
  defaultEntity: string;
  /** The location the request resolves to, for use in new-document creation */
  defaultLocation: string;
  /** Whether this user is operating with elevated cross-tenant access */
  isCrossTenant: boolean;
  /** True only for SUPER_ADMIN_EMAILS users */
  isSuperAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: JwtPayload;
      tenant: TenantContext;
    }
  }
}

export interface JwtPayload {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  entity:   string;
  location: string;
  tenantId: string;
}

/**
 * Resolves tenant context after requireAuth.
 * Attach to all protected routes.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  const isSuperAdmin  = env.SUPER_ADMIN_EMAILS.includes(user.email);
  const isCrossTenant = isSuperAdmin || CROSS_TENANT_ROLES.includes(user.role as never);

  let tenantId: string | null = user.tenantId;

  if (isSuperAdmin) {
    tenantId = req.headers['x-tenant-override'] as string | null ?? null;
  } else if (isCrossTenant) {
    const override = req.headers['x-tenant-override'] as string | undefined;
    tenantId = override ?? null;
  }

  req.tenant = {
    tenantId,
    defaultEntity:   user.entity,
    defaultLocation: user.location,   // ← added
    isCrossTenant,
    isSuperAdmin,
  };

  next();
}

/**
 * Build the tenant filter for MongoDB queries.
 * Returns {} if no tenant scope (sees all), or { tenantId } if scoped.
 */
export function tenantFilter(ctx: TenantContext): Record<string, string> {
  return ctx.tenantId ? { tenantId: ctx.tenantId } : {};
}
```

---

### Fix 3 — `packages/api/src/services/DealService.ts`

**Bug:** `ctx.tenantId ?? ctx.defaultEntity` writes raw entity name (e.g., `"WKI"`) as a tenantId when a cross-tenant user creates a deal without an override header.

```typescript
// packages/api/src/services/DealService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository, type DealFilter } from '../repositories/DealRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateDealPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';
import { eventBus } from '../jobs/index.js';

export class DealService {
  async list(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    return DealRepository.listDeals(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const deal = await DealRepository.findById(db, ctx, id);
    if (!deal) throw new NotFoundError('Deal');
    return deal;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateDealPayload) {
    // Always derive a valid slug-format tenantId; never fall back to raw entity name
    const tenantId = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    return DealRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateDealPayload>) {
    const before = await DealRepository.findById(db, ctx, id);
    if (!before) throw new NotFoundError('Deal');

    const deal = await DealRepository.updateOne(db, ctx, id, payload as never);
    if (!deal) throw new NotFoundError('Deal');

    // Fire domain events on status transitions
    const tenantId = deal['tenantId'] as string;
    if (payload.status && payload.status !== before.status) {
      if (payload.status === 'Won') {
        void eventBus.emit({ type: 'deal.won', dealId: id, tenantId, amount: deal['amount'] as number }, db);
      } else if (payload.status === 'Approved') {
        void eventBus.emit({ type: 'deal.approved', dealId: id, approver: ctx.defaultEntity, tenantId }, db);
      } else if (payload.status === 'In Build') {
        void eventBus.emit({ type: 'deal.in_build', dealId: id, tenantId }, db);
      } else if (payload.status === 'Delivered') {
        void eventBus.emit({ type: 'deal.delivered', dealId: id, tenantId }, db);
      }
    }

    return deal;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await DealRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Deal');
  }
}

export const dealService = new DealService();
```

---

### Fix 3b — `packages/api/src/services/LeadService.ts`

**Same root cause:** hardcoded `'Wichita'` fallback — now uses `ctx.defaultLocation`.

```typescript
// packages/api/src/services/LeadService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { LeadRepository, type LeadFilter } from '../repositories/LeadRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateLeadPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';

export class LeadService {
  async list(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    return LeadRepository.listLeads(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const lead = await LeadRepository.findById(db, ctx, id);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateLeadPayload) {
    // Always derive a valid slug-format tenantId; never fall back to a hardcoded location
    const tenantId = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    return LeadRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateLeadPayload>) {
    const lead = await LeadRepository.updateOne(db, ctx, id, payload as never);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await LeadRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Lead');
  }
}

export const leadService = new LeadService();
```

---

### Fix 4 — `packages/api/src/repositories/LeadRepository.ts`

**Security:** escape user-supplied search strings before passing to MongoDB `$regex` to prevent ReDoS.

```typescript
// packages/api/src/repositories/LeadRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { LeadStatus } from '@mtte-core/shared';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface LeadDoc extends Document {
  tenantId:    string;
  company:     string;
  contact:     string;
  email?:      string;
  phone?:      string;
  source?:     string;
  notes?:      string;
  assignedTo?: string;
  status:      LeadStatus;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface LeadFilter {
  status?:     LeadStatus;
  assignedTo?: string;
  search?:     string;
}

class LeadRepositoryClass extends BaseRepository<LeadDoc> {
  protected collectionName = 'leads';

  async listLeads(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status)     mongoFilter['status']     = filter.status;
    if (filter.assignedTo) mongoFilter['assignedTo'] = filter.assignedTo;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { company: { $regex: safe, $options: 'i' } },
        { contact: { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }
}

export const LeadRepository = new LeadRepositoryClass();
```

---

### Fix 5 — `packages/api/src/repositories/DealRepository.ts`

**Security:** same regex escape applied to deal search.

```typescript
// packages/api/src/repositories/DealRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { DealStatus } from '@mtte-core/shared';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface DealDoc extends Document {
  tenantId:    string;
  title:       string;
  company:     string;
  contact:     string;
  amount:      number;
  assignedTo?: string;
  leadId?:     string;
  unitId?:     string;
  notes?:      string;
  status:      DealStatus;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface DealFilter {
  status?:     DealStatus;
  assignedTo?: string;
  search?:     string;
}

class DealRepositoryClass extends BaseRepository<DealDoc> {
  protected collectionName = 'deals';

  async listDeals(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status)     mongoFilter['status']     = filter.status;
    if (filter.assignedTo) mongoFilter['assignedTo'] = filter.assignedTo;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { company: { $regex: safe, $options: 'i' } },
        { title:   { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }
}

export const DealRepository = new DealRepositoryClass();
```

---

### Fix 6 — `packages/api/package.json`

**Add** `express-rate-limit` dependency (the only new library, explicitly permitted by the prompt).

```json
{
  "name": "@mtte-core/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev":       "tsx watch --env-file=../../.env src/server.ts",
    "build":     "tsc",
    "start":     "node --env-file=../../.env dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mtte-core/shared":   "*",
    "bcryptjs":            "^2.4.3",
    "cors":                "^2.8.5",
    "express":             "^4.18.2",
    "express-rate-limit":  "^7.5.0",
    "jsonwebtoken":        "^9.0.2",
    "mongodb":             "^6.3.0",
    "zod":                 "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs":     "^2.4.6",
    "@types/cors":         "^2.8.17",
    "@types/express":      "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node":         "^20.11.0",
    "tsx":                 "^4.7.0",
    "typescript":          "^5.4.0"
  }
}
```

---

### Fix 7 — `packages/api/src/routes/auth.ts`

**Security:** rate-limit login to 10 attempts/minute. Explicit `expiresIn` comment on response for clarity.

```typescript
// packages/api/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserRepository } from '../repositories/UserRepository.js';
import { getDB } from '../config/db.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

const router = Router();

// Limit login attempts — prevents brute-force attacks on credentials
const loginLimiter = r
```


## License: unknown
https://github.com/gusmfs/netclient/blob/d68cd1e18bf274b8cecc4cb22eacf85b6cb15bb9/README.md

```
Now I have the complete picture. Making all changes:I don't have a direct file-write tool in this session, but VS Code will show an **Apply** button on each code block below. I'll go through each file in order.

---

### Fix 1 — `packages/api/src/services/AdminService.ts`

**Bug:** field stored as `password`, read back as `passwordHash` → all admin-created logins fail silently. Also strips hash from the create response.

```typescript
// packages/api/src/services/AdminService.ts
import type { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { ConflictError, NotFoundError } from '../errors/index.js';
import type { CreateUserPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';

export class AdminService {
  async listUsers(db: Db) {
    // listAll already projects { passwordHash: 0 } — safe to return directly
    return UserRepository.listAll(db);
  }

  async createUser(db: Db, payload: CreateUserPayload) {
    const existing = await UserRepository.findByEmail(db, payload.email);
    if (existing) throw new ConflictError('Email already in use');

    const tenantId = buildTenantId(payload.entity as Entity, payload.location as Location);
    const hashed   = await bcrypt.hash(payload.password, 12);

    const inserted = await UserRepository.insertOne(db, { tenantId } as never, {
      tenantId,
      name:         payload.name,
      email:        payload.email.toLowerCase(),
      passwordHash: hashed,           // ← was: password (BLOCKER fix)
      role:         payload.role,
      entity:       payload.entity,
      location:     payload.location,
      active:       true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    });

    // Never return the hash to the client
    const { passwordHash: _pw, ...safeUser } = inserted as typeof inserted & { passwordHash?: string };
    return safeUser;
  }

  async deactivateUser(db: Db, id: string) {
    const ok = await UserRepository.deactivate(db, id);
    if (!ok) throw new NotFoundError('User');
  }

  async stats(db: Db) {
    const superCtx = {
      tenantId: null, defaultEntity: '', defaultLocation: '',
      isCrossTenant: true, isSuperAdmin: true,
    };
    const [leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus] = await Promise.all([
      LeadRepository.byTenantCounts(db),
      DealRepository.byTenantCounts(db),
      LeadRepository.statusCounts(db, superCtx),
      DealRepository.statusCounts(db, superCtx),
    ]);
    return { leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus };
  }

  async syncStatus(db: Db) {
    return db.collection('karmak_sync').find({}).sort({ lastSyncAt: -1 }).limit(50).toArray();
  }
}

export const adminService = new AdminService();
```

---

### Fix 2 — `packages/api/src/tenancy/index.ts`

**Change:** add `defaultLocation` to `TenantContext` so services can build valid tenant IDs without hardcoding a location.

```typescript
// packages/api/src/tenancy/index.ts
//
// TENANT ARCHITECTURE
// ───────────────────
// TenantId format: "<entity_slug>-<location_slug>"  e.g. "wki-wichita", "mtte-dodge-city"
//
// Every authenticated request resolves to exactly one TenantContext.
// The context flows through req.tenant and is injected into every
// repository method — no route or service ever manually adds { tenantId }.
//
// Scope resolution order:
//  1. If user is SUPER_ADMIN → tenantId = null (sees everything)
//  2. If user has CROSS_TENANT_ROLE + X-Tenant-Override header → use override
//  3. If user has CROSS_TENANT_ROLE + no header → tenantId = null (sees everything for their entity)
//  4. All other roles → tenantId = user.tenantId (hard-scoped to their location)

import type { Request, Response, NextFunction } from 'express';
import { CROSS_TENANT_ROLES } from '@mtte-core/shared';
import { env } from '../config/env.js';

export interface TenantContext {
  /** null = no filter applied (management/admin viewing all) */
  tenantId: string | null;
  /** The entity the request resolves to, for use in new-document creation */
  defaultEntity: string;
  /** The location the request resolves to, for use in new-document creation */
  defaultLocation: string;
  /** Whether this user is operating with elevated cross-tenant access */
  isCrossTenant: boolean;
  /** True only for SUPER_ADMIN_EMAILS users */
  isSuperAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: JwtPayload;
      tenant: TenantContext;
    }
  }
}

export interface JwtPayload {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  entity:   string;
  location: string;
  tenantId: string;
}

/**
 * Resolves tenant context after requireAuth.
 * Attach to all protected routes.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  const isSuperAdmin  = env.SUPER_ADMIN_EMAILS.includes(user.email);
  const isCrossTenant = isSuperAdmin || CROSS_TENANT_ROLES.includes(user.role as never);

  let tenantId: string | null = user.tenantId;

  if (isSuperAdmin) {
    tenantId = req.headers['x-tenant-override'] as string | null ?? null;
  } else if (isCrossTenant) {
    const override = req.headers['x-tenant-override'] as string | undefined;
    tenantId = override ?? null;
  }

  req.tenant = {
    tenantId,
    defaultEntity:   user.entity,
    defaultLocation: user.location,   // ← added
    isCrossTenant,
    isSuperAdmin,
  };

  next();
}

/**
 * Build the tenant filter for MongoDB queries.
 * Returns {} if no tenant scope (sees all), or { tenantId } if scoped.
 */
export function tenantFilter(ctx: TenantContext): Record<string, string> {
  return ctx.tenantId ? { tenantId: ctx.tenantId } : {};
}
```

---

### Fix 3 — `packages/api/src/services/DealService.ts`

**Bug:** `ctx.tenantId ?? ctx.defaultEntity` writes raw entity name (e.g., `"WKI"`) as a tenantId when a cross-tenant user creates a deal without an override header.

```typescript
// packages/api/src/services/DealService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository, type DealFilter } from '../repositories/DealRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateDealPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';
import { eventBus } from '../jobs/index.js';

export class DealService {
  async list(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    return DealRepository.listDeals(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const deal = await DealRepository.findById(db, ctx, id);
    if (!deal) throw new NotFoundError('Deal');
    return deal;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateDealPayload) {
    // Always derive a valid slug-format tenantId; never fall back to raw entity name
    const tenantId = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    return DealRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateDealPayload>) {
    const before = await DealRepository.findById(db, ctx, id);
    if (!before) throw new NotFoundError('Deal');

    const deal = await DealRepository.updateOne(db, ctx, id, payload as never);
    if (!deal) throw new NotFoundError('Deal');

    // Fire domain events on status transitions
    const tenantId = deal['tenantId'] as string;
    if (payload.status && payload.status !== before.status) {
      if (payload.status === 'Won') {
        void eventBus.emit({ type: 'deal.won', dealId: id, tenantId, amount: deal['amount'] as number }, db);
      } else if (payload.status === 'Approved') {
        void eventBus.emit({ type: 'deal.approved', dealId: id, approver: ctx.defaultEntity, tenantId }, db);
      } else if (payload.status === 'In Build') {
        void eventBus.emit({ type: 'deal.in_build', dealId: id, tenantId }, db);
      } else if (payload.status === 'Delivered') {
        void eventBus.emit({ type: 'deal.delivered', dealId: id, tenantId }, db);
      }
    }

    return deal;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await DealRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Deal');
  }
}

export const dealService = new DealService();
```

---

### Fix 3b — `packages/api/src/services/LeadService.ts`

**Same root cause:** hardcoded `'Wichita'` fallback — now uses `ctx.defaultLocation`.

```typescript
// packages/api/src/services/LeadService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { LeadRepository, type LeadFilter } from '../repositories/LeadRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateLeadPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';

export class LeadService {
  async list(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    return LeadRepository.listLeads(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const lead = await LeadRepository.findById(db, ctx, id);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateLeadPayload) {
    // Always derive a valid slug-format tenantId; never fall back to a hardcoded location
    const tenantId = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    return LeadRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateLeadPayload>) {
    const lead = await LeadRepository.updateOne(db, ctx, id, payload as never);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await LeadRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Lead');
  }
}

export const leadService = new LeadService();
```

---

### Fix 4 — `packages/api/src/repositories/LeadRepository.ts`

**Security:** escape user-supplied search strings before passing to MongoDB `$regex` to prevent ReDoS.

```typescript
// packages/api/src/repositories/LeadRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { LeadStatus } from '@mtte-core/shared';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface LeadDoc extends Document {
  tenantId:    string;
  company:     string;
  contact:     string;
  email?:      string;
  phone?:      string;
  source?:     string;
  notes?:      string;
  assignedTo?: string;
  status:      LeadStatus;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface LeadFilter {
  status?:     LeadStatus;
  assignedTo?: string;
  search?:     string;
}

class LeadRepositoryClass extends BaseRepository<LeadDoc> {
  protected collectionName = 'leads';

  async listLeads(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status)     mongoFilter['status']     = filter.status;
    if (filter.assignedTo) mongoFilter['assignedTo'] = filter.assignedTo;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { company: { $regex: safe, $options: 'i' } },
        { contact: { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }
}

export const LeadRepository = new LeadRepositoryClass();
```

---

### Fix 5 — `packages/api/src/repositories/DealRepository.ts`

**Security:** same regex escape applied to deal search.

```typescript
// packages/api/src/repositories/DealRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { DealStatus } from '@mtte-core/shared';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface DealDoc extends Document {
  tenantId:    string;
  title:       string;
  company:     string;
  contact:     string;
  amount:      number;
  assignedTo?: string;
  leadId?:     string;
  unitId?:     string;
  notes?:      string;
  status:      DealStatus;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface DealFilter {
  status?:     DealStatus;
  assignedTo?: string;
  search?:     string;
}

class DealRepositoryClass extends BaseRepository<DealDoc> {
  protected collectionName = 'deals';

  async listDeals(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status)     mongoFilter['status']     = filter.status;
    if (filter.assignedTo) mongoFilter['assignedTo'] = filter.assignedTo;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { company: { $regex: safe, $options: 'i' } },
        { title:   { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }
}

export const DealRepository = new DealRepositoryClass();
```

---

### Fix 6 — `packages/api/package.json`

**Add** `express-rate-limit` dependency (the only new library, explicitly permitted by the prompt).

```json
{
  "name": "@mtte-core/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev":       "tsx watch --env-file=../../.env src/server.ts",
    "build":     "tsc",
    "start":     "node --env-file=../../.env dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mtte-core/shared":   "*",
    "bcryptjs":            "^2.4.3",
    "cors":                "^2.8.5",
    "express":             "^4.18.2",
    "express-rate-limit":  "^7.5.0",
    "jsonwebtoken":        "^9.0.2",
    "mongodb":             "^6.3.0",
    "zod":                 "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs":     "^2.4.6",
    "@types/cors":         "^2.8.17",
    "@types/express":      "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node":         "^20.11.0",
    "tsx":                 "^4.7.0",
    "typescript":          "^5.4.0"
  }
}
```

---

### Fix 7 — `packages/api/src/routes/auth.ts`

**Security:** rate-limit login to 10 attempts/minute. Explicit `expiresIn` comment on response for clarity.

```typescript
// packages/api/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserRepository } from '../repositories/UserRepository.js';
import { getDB } from '../config/db.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

const router = Router();

// Limit login attempts — prevents brute-force attacks on credentials
const loginLimiter = r
```


## License: unknown
https://github.com/gusmfs/netclient/blob/d68cd1e18bf274b8cecc4cb22eacf85b6cb15bb9/README.md

```
Now I have the complete picture. Making all changes:I don't have a direct file-write tool in this session, but VS Code will show an **Apply** button on each code block below. I'll go through each file in order.

---

### Fix 1 — `packages/api/src/services/AdminService.ts`

**Bug:** field stored as `password`, read back as `passwordHash` → all admin-created logins fail silently. Also strips hash from the create response.

```typescript
// packages/api/src/services/AdminService.ts
import type { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { ConflictError, NotFoundError } from '../errors/index.js';
import type { CreateUserPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';

export class AdminService {
  async listUsers(db: Db) {
    // listAll already projects { passwordHash: 0 } — safe to return directly
    return UserRepository.listAll(db);
  }

  async createUser(db: Db, payload: CreateUserPayload) {
    const existing = await UserRepository.findByEmail(db, payload.email);
    if (existing) throw new ConflictError('Email already in use');

    const tenantId = buildTenantId(payload.entity as Entity, payload.location as Location);
    const hashed   = await bcrypt.hash(payload.password, 12);

    const inserted = await UserRepository.insertOne(db, { tenantId } as never, {
      tenantId,
      name:         payload.name,
      email:        payload.email.toLowerCase(),
      passwordHash: hashed,           // ← was: password (BLOCKER fix)
      role:         payload.role,
      entity:       payload.entity,
      location:     payload.location,
      active:       true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    });

    // Never return the hash to the client
    const { passwordHash: _pw, ...safeUser } = inserted as typeof inserted & { passwordHash?: string };
    return safeUser;
  }

  async deactivateUser(db: Db, id: string) {
    const ok = await UserRepository.deactivate(db, id);
    if (!ok) throw new NotFoundError('User');
  }

  async stats(db: Db) {
    const superCtx = {
      tenantId: null, defaultEntity: '', defaultLocation: '',
      isCrossTenant: true, isSuperAdmin: true,
    };
    const [leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus] = await Promise.all([
      LeadRepository.byTenantCounts(db),
      DealRepository.byTenantCounts(db),
      LeadRepository.statusCounts(db, superCtx),
      DealRepository.statusCounts(db, superCtx),
    ]);
    return { leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus };
  }

  async syncStatus(db: Db) {
    return db.collection('karmak_sync').find({}).sort({ lastSyncAt: -1 }).limit(50).toArray();
  }
}

export const adminService = new AdminService();
```

---

### Fix 2 — `packages/api/src/tenancy/index.ts`

**Change:** add `defaultLocation` to `TenantContext` so services can build valid tenant IDs without hardcoding a location.

```typescript
// packages/api/src/tenancy/index.ts
//
// TENANT ARCHITECTURE
// ───────────────────
// TenantId format: "<entity_slug>-<location_slug>"  e.g. "wki-wichita", "mtte-dodge-city"
//
// Every authenticated request resolves to exactly one TenantContext.
// The context flows through req.tenant and is injected into every
// repository method — no route or service ever manually adds { tenantId }.
//
// Scope resolution order:
//  1. If user is SUPER_ADMIN → tenantId = null (sees everything)
//  2. If user has CROSS_TENANT_ROLE + X-Tenant-Override header → use override
//  3. If user has CROSS_TENANT_ROLE + no header → tenantId = null (sees everything for their entity)
//  4. All other roles → tenantId = user.tenantId (hard-scoped to their location)

import type { Request, Response, NextFunction } from 'express';
import { CROSS_TENANT_ROLES } from '@mtte-core/shared';
import { env } from '../config/env.js';

export interface TenantContext {
  /** null = no filter applied (management/admin viewing all) */
  tenantId: string | null;
  /** The entity the request resolves to, for use in new-document creation */
  defaultEntity: string;
  /** The location the request resolves to, for use in new-document creation */
  defaultLocation: string;
  /** Whether this user is operating with elevated cross-tenant access */
  isCrossTenant: boolean;
  /** True only for SUPER_ADMIN_EMAILS users */
  isSuperAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: JwtPayload;
      tenant: TenantContext;
    }
  }
}

export interface JwtPayload {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  entity:   string;
  location: string;
  tenantId: string;
}

/**
 * Resolves tenant context after requireAuth.
 * Attach to all protected routes.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  const isSuperAdmin  = env.SUPER_ADMIN_EMAILS.includes(user.email);
  const isCrossTenant = isSuperAdmin || CROSS_TENANT_ROLES.includes(user.role as never);

  let tenantId: string | null = user.tenantId;

  if (isSuperAdmin) {
    tenantId = req.headers['x-tenant-override'] as string | null ?? null;
  } else if (isCrossTenant) {
    const override = req.headers['x-tenant-override'] as string | undefined;
    tenantId = override ?? null;
  }

  req.tenant = {
    tenantId,
    defaultEntity:   user.entity,
    defaultLocation: user.location,   // ← added
    isCrossTenant,
    isSuperAdmin,
  };

  next();
}

/**
 * Build the tenant filter for MongoDB queries.
 * Returns {} if no tenant scope (sees all), or { tenantId } if scoped.
 */
export function tenantFilter(ctx: TenantContext): Record<string, string> {
  return ctx.tenantId ? { tenantId: ctx.tenantId } : {};
}
```

---

### Fix 3 — `packages/api/src/services/DealService.ts`

**Bug:** `ctx.tenantId ?? ctx.defaultEntity` writes raw entity name (e.g., `"WKI"`) as a tenantId when a cross-tenant user creates a deal without an override header.

```typescript
// packages/api/src/services/DealService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository, type DealFilter } from '../repositories/DealRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateDealPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';
import { eventBus } from '../jobs/index.js';

export class DealService {
  async list(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    return DealRepository.listDeals(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const deal = await DealRepository.findById(db, ctx, id);
    if (!deal) throw new NotFoundError('Deal');
    return deal;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateDealPayload) {
    // Always derive a valid slug-format tenantId; never fall back to raw entity name
    const tenantId = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    return DealRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateDealPayload>) {
    const before = await DealRepository.findById(db, ctx, id);
    if (!before) throw new NotFoundError('Deal');

    const deal = await DealRepository.updateOne(db, ctx, id, payload as never);
    if (!deal) throw new NotFoundError('Deal');

    // Fire domain events on status transitions
    const tenantId = deal['tenantId'] as string;
    if (payload.status && payload.status !== before.status) {
      if (payload.status === 'Won') {
        void eventBus.emit({ type: 'deal.won', dealId: id, tenantId, amount: deal['amount'] as number }, db);
      } else if (payload.status === 'Approved') {
        void eventBus.emit({ type: 'deal.approved', dealId: id, approver: ctx.defaultEntity, tenantId }, db);
      } else if (payload.status === 'In Build') {
        void eventBus.emit({ type: 'deal.in_build', dealId: id, tenantId }, db);
      } else if (payload.status === 'Delivered') {
        void eventBus.emit({ type: 'deal.delivered', dealId: id, tenantId }, db);
      }
    }

    return deal;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await DealRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Deal');
  }
}

export const dealService = new DealService();
```

---

### Fix 3b — `packages/api/src/services/LeadService.ts`

**Same root cause:** hardcoded `'Wichita'` fallback — now uses `ctx.defaultLocation`.

```typescript
// packages/api/src/services/LeadService.ts
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { LeadRepository, type LeadFilter } from '../repositories/LeadRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import type { CreateLeadPayload } from '@mtte-core/shared';
import { buildTenantId } from '@mtte-core/shared';
import type { Entity, Location } from '@mtte-core/shared';
import { NotFoundError } from '../errors/index.js';

export class LeadService {
  async list(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    return LeadRepository.listLeads(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const lead = await LeadRepository.findById(db, ctx, id);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateLeadPayload) {
    // Always derive a valid slug-format tenantId; never fall back to a hardcoded location
    const tenantId = ctx.tenantId ?? buildTenantId(
      ctx.defaultEntity  as Entity,
      ctx.defaultLocation as Location,
    );
    return LeadRepository.insertOne(db, { ...ctx, tenantId }, {
      ...payload,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(db: Db, ctx: TenantContext, id: string, payload: Partial<CreateLeadPayload>) {
    const lead = await LeadRepository.updateOne(db, ctx, id, payload as never);
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async remove(db: Db, ctx: TenantContext, id: string) {
    const ok = await LeadRepository.deleteOne(db, ctx, id);
    if (!ok) throw new NotFoundError('Lead');
  }
}

export const leadService = new LeadService();
```

---

### Fix 4 — `packages/api/src/repositories/LeadRepository.ts`

**Security:** escape user-supplied search strings before passing to MongoDB `$regex` to prevent ReDoS.

```typescript
// packages/api/src/repositories/LeadRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { LeadStatus } from '@mtte-core/shared';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface LeadDoc extends Document {
  tenantId:    string;
  company:     string;
  contact:     string;
  email?:      string;
  phone?:      string;
  source?:     string;
  notes?:      string;
  assignedTo?: string;
  status:      LeadStatus;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface LeadFilter {
  status?:     LeadStatus;
  assignedTo?: string;
  search?:     string;
}

class LeadRepositoryClass extends BaseRepository<LeadDoc> {
  protected collectionName = 'leads';

  async listLeads(db: Db, ctx: TenantContext, filter: LeadFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status)     mongoFilter['status']     = filter.status;
    if (filter.assignedTo) mongoFilter['assignedTo'] = filter.assignedTo;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { company: { $regex: safe, $options: 'i' } },
        { contact: { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }
}

export const LeadRepository = new LeadRepositoryClass();
```

---

### Fix 5 — `packages/api/src/repositories/DealRepository.ts`

**Security:** same regex escape applied to deal search.

```typescript
// packages/api/src/repositories/DealRepository.ts
import type { Db, Document } from 'mongodb';
import { BaseRepository, type ListOptions } from './BaseRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import type { DealStatus } from '@mtte-core/shared';

/** Escape special regex characters to prevent ReDoS via user-supplied search strings */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface DealDoc extends Document {
  tenantId:    string;
  title:       string;
  company:     string;
  contact:     string;
  amount:      number;
  assignedTo?: string;
  leadId?:     string;
  unitId?:     string;
  notes?:      string;
  status:      DealStatus;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface DealFilter {
  status?:     DealStatus;
  assignedTo?: string;
  search?:     string;
}

class DealRepositoryClass extends BaseRepository<DealDoc> {
  protected collectionName = 'deals';

  async listDeals(db: Db, ctx: TenantContext, filter: DealFilter, options: ListOptions) {
    const mongoFilter: Record<string, unknown> = {};
    if (filter.status)     mongoFilter['status']     = filter.status;
    if (filter.assignedTo) mongoFilter['assignedTo'] = filter.assignedTo;
    if (filter.search) {
      const safe = escapeRegex(filter.search);
      mongoFilter['$or'] = [
        { company: { $regex: safe, $options: 'i' } },
        { title:   { $regex: safe, $options: 'i' } },
      ];
    }
    return this.list(db, ctx, mongoFilter as never, options);
  }

  async statusCounts(db: Db, ctx: TenantContext) {
    const pipeline = [
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } },
    ];
    return this.col(db).aggregate(this.scopedAggregate(ctx, pipeline)).toArray();
  }

  async byTenantCounts(db: Db) {
    return this.col(db).aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]).toArray();
  }
}

export const DealRepository = new DealRepositoryClass();
```

---

### Fix 6 — `packages/api/package.json`

**Add** `express-rate-limit` dependency (the only new library, explicitly permitted by the prompt).

```json
{
  "name": "@mtte-core/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev":       "tsx watch --env-file=../../.env src/server.ts",
    "build":     "tsc",
    "start":     "node --env-file=../../.env dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mtte-core/shared":   "*",
    "bcryptjs":            "^2.4.3",
    "cors":                "^2.8.5",
    "express":             "^4.18.2",
    "express-rate-limit":  "^7.5.0",
    "jsonwebtoken":        "^9.0.2",
    "mongodb":             "^6.3.0",
    "zod":                 "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs":     "^2.4.6",
    "@types/cors":         "^2.8.17",
    "@types/express":      "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node":         "^20.11.0",
    "tsx":                 "^4.7.0",
    "typescript":          "^5.4.0"
  }
}
```

---

### Fix 7 — `packages/api/src/routes/auth.ts`

**Security:** rate-limit login to 10 attempts/minute. Explicit `expiresIn` comment on response for clarity.

```typescript
// packages/api/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserRepository } from '../repositories/UserRepository.js';
import { getDB } from '../config/db.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

const router = Router();

// Limit login attempts — prevents brute-force attacks on credentials
const loginLimiter = rateLimit({
  windowMs:       60
```

