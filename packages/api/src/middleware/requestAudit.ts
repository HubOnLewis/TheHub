// packages/api/src/middleware/requestAudit.ts
import type { Request, Response, NextFunction } from 'express';

/**
 * Lightweight API usage audit — logs to server console only (no DB schema churn).
 */
export function requestAudit(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - started;
    const entry = {
      type: 'api_audit',
      route: req.originalUrl ?? req.url,
      method: req.method,
      status: res.statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
      user: req.user?.email ?? null,
      tenant: req.tenant?.tenantId ?? req.user?.tenantId ?? null,
      location: req.user?.location ?? null,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}
