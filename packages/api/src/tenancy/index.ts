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
  /** Authenticated user's ID — use for assignedTo defaults and audit fields */
  userId: string;
  /** Authenticated user's display name — use for assignedTo defaults */
  userName: string;
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
  const isSuperAdmin = env.SUPER_ADMIN_EMAILS.includes(user.email);
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
    defaultLocation: user.location,
    userId:          user.id,
    userName:        user.name,
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
