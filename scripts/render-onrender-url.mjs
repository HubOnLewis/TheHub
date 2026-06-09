/**
 * Build public Render URLs from service names (default *.onrender.com).
 * Override with explicit CLIENT_URL / VITE_API_URL when using custom domains.
 */

export function onRenderServiceUrl(serviceName, root = 'onrender.com') {
  const name = String(serviceName ?? '').trim();
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
