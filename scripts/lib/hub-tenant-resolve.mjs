/** Resolve HuB on Lewis tenant id(s) for purge scripts. */

const CANONICAL_DEFAULT = 'hub-wichita';

const HUB_VENUE_TENANT_IDS = ['hub-wichita', 'hub-on-lewis'];

const ALIASES = {
  'hub-wichita': ['hub-wichita', 'hub-on-lewis'],
  'hub-on-lewis': ['hub-on-lewis', 'hub-wichita'],
};

export function resolveHubTenantIds(argTenant) {
  const key = (argTenant || process.env.HUB_TENANT_ID || CANONICAL_DEFAULT).trim().toLowerCase();
  const ids = ALIASES[key] ?? [key];
  return [...new Set(ids)];
}

/** Canonical tenant for production imports and user sessions. */
export function defaultHubTenantId() {
  return CANONICAL_DEFAULT;
}

export function resolvePrimaryHubTenant(argTenant) {
  const ids = resolveHubTenantIds(argTenant);
  if (ids.includes(CANONICAL_DEFAULT)) return CANONICAL_DEFAULT;
  return ids[0];
}

export function isHubVenueTenantAlias(tenantId) {
  return HUB_VENUE_TENANT_IDS.includes(String(tenantId ?? '').toLowerCase());
}

export function hubVenueTenantScope(tenantId) {
  const id = String(tenantId ?? '').toLowerCase();
  if (!id) return null;
  if (isHubVenueTenantAlias(id)) return HUB_VENUE_TENANT_IDS;
  return id;
}
