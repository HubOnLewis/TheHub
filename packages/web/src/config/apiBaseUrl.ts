/**
 * Resolves the API base URL for axios — dev proxy vs production absolute URL.
 * VITE_API_URL is baked in at build time on Render static sites.
 */

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

export type ApiBaseUrlResolution = {
  baseUrl: string;
  configError: string | null;
};

function normalizeBase(raw: string): string {
  let base = raw.trim().replace(/\/$/, '');
  if (!base.endsWith('/api')) base = `${base}/api`;
  return base;
}

function isLocalhostUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url);
}

export function resolveApiBaseUrl(): ApiBaseUrlResolution {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const trimmed = String(raw ?? '').trim();
  const isProduction = import.meta.env.PROD;

  if (isProduction) {
    if (!trimmed || isLocalhostUrl(trimmed)) {
      return {
        baseUrl: '',
        configError:
          'Production API URL is not configured. Set VITE_API_URL on the Render static site to the deployed API URL.',
      };
    }
    return { baseUrl: normalizeBase(trimmed), configError: null };
  }

  if (!trimmed) {
    return { baseUrl: '/api', configError: null };
  }

  return { baseUrl: normalizeBase(trimmed), configError: null };
}

/** User-facing message when login cannot reach the API (network failure). */
export function getApiNetworkErrorMessage(): string {
  if (import.meta.env.PROD) {
    return 'Cannot reach The Hub API. Please contact support or try again shortly.';
  }
  return (
    'Cannot reach the API. Start `npm run dev:api`, confirm MongoDB is running, and set ' +
    '`VITE_API_URL` to `http://localhost:3001/api` if you do not use the Vite proxy.'
  );
}

export function logApiBaseUrlDiagnostics(): void {
  const { baseUrl, configError } = resolveApiBaseUrl();
  if (import.meta.env.PROD) {
    if (configError) {
      console.error('[API]', configError);
      return;
    }
    try {
      console.info('[API] host:', new URL(baseUrl).host);
    } catch {
      console.info('[API] baseURL:', baseUrl);
    }
    return;
  }
  if (import.meta.env.DEV) {
    console.info('[API] dev baseURL:', baseUrl, configError ?? '');
  }
}
