/** Resolve HuB on Lewis tenant id(s) for purge scripts. */

const CANONICAL_DEFAULT = 'hub-wichita';

const ALIASES = {
  'hub-wichita': ['hub-wichita', 'hub-on-lewis'],
  'hub-on-lewis': ['hub-on-lewis', 'hub-wichita'],
};

export function resolveHubTenantIds(argTenant) {
  const key = (argTenant || process.env.HUB_TENANT_ID || CANONICAL_DEFAULT).trim().toLowerCase();
  const ids = ALIASES[key] ?? [key];
  return [...new Set(ids)];
}

export function defaultHubTenantId() {
  return CANONICAL_DEFAULT;
}
