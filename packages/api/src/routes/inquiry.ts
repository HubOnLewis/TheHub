import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PublicInquiryAvailabilitySchema, PublicInquirySchema, isAssignedSpace } from '@hub-crm/shared';
import { inquiryService } from '../services/InquiryService.js';
import { getDB } from '../config/db.js';

const router = Router();

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many inquiries — try again later' },
  skip: req => req.method === 'OPTIONS',
});

function firstString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function parseAvailabilityInput(req: Request) {
  const source = (req.method === 'GET' ? req.query : req.body) as Record<string, unknown>;
  const startTime = firstString(source.startTime);
  const endTime = firstString(source.endTime);
  return PublicInquiryAvailabilitySchema.safeParse({
    eventDate: firstString(source.eventDate ?? source.date),
    space: firstString(source.space),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  });
}

async function handleAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseAvailabilityInput(req);
    if (!parsed.success) {
      res.status(422).json({
        error: 'Validation failed',
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    res.json(await inquiryService.checkAvailability(getDB(), parsed.data));
  } catch (err) {
    next(err);
  }
}

router.get('/availability', inquiryLimiter, handleAvailability);
router.post('/availability', inquiryLimiter, handleAvailability);

router.post('/', inquiryLimiter, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const space = firstString(body.space);
    const eventType = firstString(body.eventType);
    const eventDate = firstString(body.eventDate);
    if (!isAssignedSpace(space) || !eventType || !/^\d{4}-\d{2}-\d{2}/.test(eventDate)) {
      res.status(400).json({ error: 'Please pick a room, an event type, and a date.' });
      return;
    }
    const parsed = PublicInquirySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: 'Validation failed',
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    res.status(201).json(await inquiryService.create(getDB(), parsed.data));
  } catch (err) {
    next(err);
  }
});

export default router;
