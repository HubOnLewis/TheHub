// packages/api/src/middleware/requestAudit.ts
import type { Request, Response, NextFunction } from 'express';
import { getDB } from '../config/db.js';

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
    if (req.user && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      void getDB().collection('audit_events').insertOne({
        tenantId: req.tenant?.tenantId ?? req.user.tenantId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorEmail: req.user.email,
        timestamp: entry.timestamp,
        action: `${req.method} ${req.path}`,
        entityType: req.baseUrl.split('/')[2] || 'api',
        entityId: req.path.split('/')[1] || undefined,
        source: 'user',
        correlationId: req.headers['x-request-id'] ?? undefined,
        metadata: { status: res.statusCode, durationMs },
      }).catch(error => console.error('[API] audit event write failed:', error));
    }
  });

  next();
}
