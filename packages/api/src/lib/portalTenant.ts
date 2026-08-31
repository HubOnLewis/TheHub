import type { TenantContext } from '../tenancy/index.js';

/** Cross-tenant guest lookup — public portal routes have no staff JWT. */
export function portalTenantContext(): TenantContext {
  return {
    tenantId: null,
    defaultEntity: 'hub',
    defaultLocation: 'wichita',
    userId: 'portal',
    userRole: 'client',
    userName: 'portal',
    isCrossTenant: true,
    isSuperAdmin: false,
  };
}
