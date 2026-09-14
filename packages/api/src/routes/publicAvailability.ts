import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isIsoDate } from '@hub-crm/shared';
import { publicAvailabilityService } from '../services/PublicAvailabilityService.js';

const router = Router();

const availabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many availability checks — try again later' },
  skip: req => req.method === 'OPTIONS',
});

function firstString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

router.get('/', availabilityLimiter, async (req, res, next) => {
  try {
    const startDate = firstString(req.query.startDate);
    const endDate = firstString(req.query.endDate);
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      res.status(400).json({ error: 'startDate and endDate must be YYYY-MM-DD.' });
      return;
    }
    res.json(await publicAvailabilityService.listPublicRange(startDate, endDate));
  } catch (err) {
    next(err);
  }
});

export default router;
