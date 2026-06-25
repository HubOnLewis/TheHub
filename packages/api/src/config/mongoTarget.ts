/** Safe Mongo connection target for logs and admin diagnostics (no credentials). */

export function parseMongoHost(uri: string): string {
  const at = uri.match(/@([^/?]+)/)?.[1];
  if (at) return at;
  return uri.match(/mongodb(?:\+srv)?:\/\/([^/?]+)/)?.[1] ?? 'unknown';
}

export function parseMongoDbName(uri: string, configuredDbName: string): string {
  const fromUri = uri.match(/\/([^/?]+)(\?|$)/)?.[1];
  return configuredDbName?.trim() || fromUri || '(client default)';
}
