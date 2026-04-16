// packages/api/src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', issues: err.flatten().fieldErrors });
    return;
  }

  console.error('[ErrorHandler]', err);
  res.status(500).json({ error: 'Internal server error' });
}
