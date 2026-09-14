// packages/api/src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';
import { ZodError } from 'zod';
import {
  applyCorsHeadersIfAllowed,
  type createOriginMatcher,
} from '../config/cors.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
  corsMatcher?: ReturnType<typeof createOriginMatcher>,
): void {
  if (corsMatcher) {
    applyCorsHeadersIfAllowed(req, res, corsMatcher);
  }

  if (err instanceof AppError) {
    const payload: { error: string; code?: string } = { error: err.message };
    if ('code' in err && typeof (err as { code?: unknown }).code === 'string' && (err as { code: string }).code) {
      payload.code = (err as { code: string }).code;
    }
    res.status(err.statusCode).json(payload);
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', issues: err.flatten().fieldErrors });
    return;
  }

  console.error('[ErrorHandler]', err);
  res.status(500).json({ error: 'Internal server error' });
}
