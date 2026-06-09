/**
 * Build public Render URLs from service names (default *.onrender.com).
 * Alpha service names are The-Hub and The-Hub-Api, whose expected URLs are:
 *   https://The-Hub.onrender.com
 *   https://The-Hub-Api.onrender.com
 *
 * Render may normalize public URL slugs to lowercase, so generated runtime
 * hostnames intentionally lowercase service names:
 *   https://the-hub.onrender.com
 *   https://the-hub-api.onrender.com
 *
 * Override with explicit CLIENT_URL / VITE_API_URL when using custom domains.
 */

export function onRenderServiceUrl(serviceName, root = 'onrender.com') {
  const name = String(serviceName ?? '').trim().toLowerCase();
  if (!name) return '';
  const domain = String(root).trim().replace(/^\./, '');
  return `https://${name}.${domain}`;
}

/**
 * @param {string | undefined} explicit - CLIENT_URL or VITE_API_URL if set
 * @param {string | undefined} serviceName - HUB_*_SERVICE_NAME
 * @param {string | undefined} root - RENDER_ONRENDER_ROOT
 */
export function resolveRenderPublicUrl(explicit, serviceName, root = 'onrender.com') {
  const direct = String(explicit ?? '').trim();
  if (direct) {
    let url = direct;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return url.replace(/\/$/, '');
  }
  return onRenderServiceUrl(serviceName, root);
}

/**
 * API base for the web client (includes /api).
 */
export function resolveViteApiUrl({ viteApiUrl, apiServiceName, root = 'onrender.com' }) {
  const base = resolveRenderPublicUrl(viteApiUrl, apiServiceName, root);
  if (!base) return '';
  return base.endsWith('/api') ? base : `${base}/api`;
}
