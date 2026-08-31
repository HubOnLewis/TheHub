/**
 * Shared seed-operator planner for Jason (owner / super_admin) and Hannah (admin).
 * Used by seed-admin, render-bootstrap-admin, and reset-all-user-passwords.
 * Never log password values.
 */

export const JASON_DEFAULTS = {
  name: 'Jason Lavender',
  email: 'jason@hubonlewis.com',
  role: 'super_admin',
};

export const HANNAH_DEFAULTS = {
  name: 'Hannah Bayless',
  email: 'hannah@hubonlewis.com',
  role: 'admin',
};

/**
 * @param {(key: string, fallback: string) => string} pick
 * @param {{ localDefaultPassword?: string }} [opts]
 */
export function buildSeedUsers(pick, opts = {}) {
  const entity = pick('SEED_ADMIN_ENTITY', 'HUB');
  const location = pick('SEED_ADMIN_LOCATION', 'Wichita');
  const tenantId = pick('SEED_ADMIN_TENANT_ID', 'hub-wichita');
  const localDefaultPassword = opts.localDefaultPassword ?? '';
  const jasonPassword = pick('SEED_ADMIN_PASSWORD', localDefaultPassword);

  const jason = {
    key: 'jason',
    name: pick('SEED_ADMIN_NAME', JASON_DEFAULTS.name),
    email: String(pick('SEED_ADMIN_EMAIL', JASON_DEFAULTS.email)).toLowerCase().trim(),
    password: jasonPassword,
    role: JASON_DEFAULTS.role,
    entity,
    location,
    tenantId,
  };

  const hannah = {
    key: 'hannah',
    name: pick('SEED_HANNAH_NAME', HANNAH_DEFAULTS.name),
    email: String(pick('SEED_HANNAH_EMAIL', HANNAH_DEFAULTS.email)).toLowerCase().trim(),
    password: pick('SEED_HANNAH_PASSWORD', jasonPassword),
    role: HANNAH_DEFAULTS.role,
    entity: pick('SEED_HANNAH_ENTITY', entity),
    location: pick('SEED_HANNAH_LOCATION', location),
    tenantId: pick('SEED_HANNAH_TENANT_ID', tenantId),
  };

  return { jason, hannah, users: [jason, hannah] };
}

/**
 * Production-safe: never overwrite existing accounts.
 * Empty collection → create both. Jason present / Hannah missing → create Hannah.
 *
 * @param {string[]} existingEmails
 * @param {Array<{ email: string, role: string, password?: string }>} specs
 * @param {{ requirePassword?: boolean }} [opts]
 */
export function planBootstrap(existingEmails, specs, opts = {}) {
  const requirePassword = opts.requirePassword !== false;
  const existing = new Set(
    (existingEmails ?? []).map(e => String(e ?? '').toLowerCase().trim()).filter(Boolean),
  );
  const toCreate = [];
  const skipped = [];

  for (const spec of specs) {
    const email = String(spec.email ?? '').toLowerCase().trim();
    if (!email) {
      skipped.push({ email: '', role: spec.role, reason: 'invalid-email' });
      continue;
    }
    if (existing.has(email)) {
      skipped.push({ email, role: spec.role, reason: 'exists' });
      continue;
    }
    if (requirePassword && (!spec.password || String(spec.password).length < 8)) {
      skipped.push({ email, role: spec.role, reason: 'password-missing' });
      continue;
    }
    toCreate.push({ ...spec, email });
  }

  return { emptyDb: existing.size === 0, toCreate, skipped };
}

/**
 * Local seed-admin: upsert every spec (create missing, refresh existing).
 *
 * @param {string[]} existingEmails
 * @param {Array<{ email: string }>} specs
 */
export function planSeedUpsert(existingEmails, specs) {
  const existing = new Set(
    (existingEmails ?? []).map(e => String(e ?? '').toLowerCase().trim()).filter(Boolean),
  );
  return specs.map(spec => {
    const email = String(spec.email ?? '').toLowerCase().trim();
    return {
      spec: { ...spec, email },
      action: existing.has(email) ? 'update' : 'create',
    };
  });
}

export function userDocFromSpec(spec, passwordHash, now) {
  return {
    name: spec.name,
    email: spec.email,
    passwordHash,
    role: spec.role,
    entity: spec.entity,
    location: spec.location,
    tenantId: spec.tenantId,
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
}

export function userUpdateFromSpec(spec, passwordHash, now) {
  return {
    name: spec.name,
    passwordHash,
    role: spec.role,
    entity: spec.entity,
    location: spec.location,
    tenantId: spec.tenantId,
    active: true,
    updatedAt: now,
  };
}