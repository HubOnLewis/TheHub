// packages/api/src/middleware/agentReadAuth.ts
/**
 * Machine auth for onsite companion → Hub CRM (read + job worker).
 * Server-only secret: HUB_AGENT_READ_TOKEN. Never expose to browser.
 */
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import type { JwtPayload } from '../tenancy/index.js';

function configuredToken(): string | null {
  const t = process.env['HUB_AGENT_READ_TOKEN']?.trim();
  return t || null;
}

export function isAgentReadTokenConfigured(): boolean {
  return Boolean(configuredToken());
}

/** Constant-time compare for equal-length secrets; length mismatch fails closed. */
export function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Still perform a compare to reduce trivial timing oracle on length alone.
    crypto.timingSafeEqual(a.length ? a : Buffer.alloc(1), Buffer.alloc(a.length || 1));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/** Synthetic principal — tenant-scoped, non-cross-tenant role. */
export function agentReaderPayload(): JwtPayload {
  const tenantId = (process.env['HUB_AGENT_TENANT_ID'] || 'hub-on-lewis').trim();
  const entity = (process.env['HUB_AGENT_ENTITY'] || 'Hub').trim();
  const location = (process.env['HUB_AGENT_LOCATION'] || 'On Lewis').trim();
  return {
    id: 'agent-reader',
    name: 'Hub Local Agent Reader',
    email: 'agent-reader@hub.local',
    role: 'sales',
    entity,
    location,
    tenantId,
  };
}

export function requireAgentReadToken(req: Request, _res: Response, next: NextFunction): void {
  const expected = configuredToken();
  if (!expected) {
    return next(new UnauthorizedError('Agent read token not configured on API'));
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Bearer token required'));
  }

  const token = header.slice(7).trim();
  if (!token || !tokensEqual(token, expected)) {
    return next(new UnauthorizedError('Invalid agent read token'));
  }

  req.user = agentReaderPayload();
  next();
}

/** Block mutations on agent-read surface. */
export function rejectNonGet(req: Request, _res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    return next(new ForbiddenError('Agent read surface is GET-only'));
  }
  next();
}
