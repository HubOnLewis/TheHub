import type { CorsOptions } from 'cors';
import cors from 'cors';

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/** Shared allowlist — used by CORS middleware and error handler. */
export function createOriginMatcher(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin));

  return {
    isAllowed(origin: string | undefined): boolean {
      if (!origin) return false;
      return allowed.has(normalizeOrigin(origin));
    },
    list: [...allowed],
  };
}

export function buildCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  const matcher = createOriginMatcher(allowedOrigins);

  return {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-Override',
      'x-tenant-override',
      'x-tenant-id',
    ],
    optionsSuccessStatus: 204,
    origin(origin, callback) {
      // curl, health checks, server-to-server — no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (matcher.isAllowed(origin)) {
        callback(null, true);
        return;
      }
      // Do not pass Error — that skips CORS headers and hits errorHandler as 500.
      callback(null, false);
    },
  };
}

export function createCorsSetup(allowedOrigins: readonly string[]) {
  const options = buildCorsOptions(allowedOrigins);
  const middleware = cors(options);
  const matcher = createOriginMatcher(allowedOrigins);
  return { options, middleware, matcher };
}

/** Apply CORS headers on error responses so browsers can read JSON error bodies. */
export function applyCorsHeadersIfAllowed(
  req: { headers: { origin?: string } },
  res: { setHeader(name: string, value: string): void },
  matcher: ReturnType<typeof createOriginMatcher>,
): void {
  const origin = req.headers.origin;
  if (origin && matcher.isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}
