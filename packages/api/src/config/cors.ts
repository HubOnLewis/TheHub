import type { CorsOptions } from 'cors';
import cors from 'cors';

/**
 * Dynamic CORS — reflects the request Origin when it matches the allowlist.
 * Required for credentials: true (cannot use Access-Control-Allow-Origin: *).
 */
export function createCorsMiddleware(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);

  const options: CorsOptions = {
    credentials: true,
    origin(origin, callback) {
      // Non-browser clients (curl, health checks) omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  };

  return cors(options);
}
