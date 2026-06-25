import type { NextFunction, Request, Response } from 'express';
import { createOriginMatcher, normalizeOrigin } from '../config/cors.js';

const ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOW_HEADERS =
  'Content-Type,Authorization,X-Requested-With,x-tenant-id,X-Tenant-ID,X-Tenant-Override,x-tenant-override';

/**
 * Plain Express CORS + global OPTIONS handler.
 * Must be the first middleware — never throws, always ends OPTIONS with 204.
 */
export function createManualCorsMiddleware(allowedOrigins: readonly string[]) {
  const matcher = createOriginMatcher(allowedOrigins);

  return function manualCors(req: Request, res: Response, next: NextFunction): void {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;

    if (origin && matcher.isAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    }

    if (req.method === 'OPTIONS') {
      if (origin && !matcher.isAllowed(origin)) {
        console.warn(`[CORS] Blocked OPTIONS preflight from origin: ${origin} ${req.originalUrl ?? req.url}`);
      }
      res.sendStatus(204);
      return;
    }

    next();
  };
}
