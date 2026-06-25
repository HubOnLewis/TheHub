/**
 * Public browser-facing API URL for HuB on Lewis production.
 * Internal Render hostname (the-hub-api-c94d:10000) is not valid for browsers.
 */

export const HUB_API_PUBLIC_ORIGIN = String(
  process.env.HUB_API_PUBLIC_URL ?? 'https://api.hubonlewis.com',
)
  .trim()
  .replace(/\/$/, '');

export const HUB_API_PUBLIC_VITE_URL = `${HUB_API_PUBLIC_ORIGIN}/api`;

export function resolveProductionViteApiUrl(explicit) {
  const direct = String(explicit ?? '').trim();
  if (!direct) return HUB_API_PUBLIC_VITE_URL;
  let url = direct.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!url.endsWith('/api')) url = `${url}/api`;
  return url;
}
