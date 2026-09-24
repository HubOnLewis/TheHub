/**
 * Staging-only startup bootstrap.
 * Safe to keep in shared code: it is a no-op unless DB_NAME is exactly hub_crm_staging.
 * Never prints password values.
 */
if (process.env.DB_NAME !== 'hub_crm_staging') {
  process.exit(0);
}

await import('./render-bootstrap-admin.mjs');
