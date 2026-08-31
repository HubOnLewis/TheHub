import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PublicInquirySchema } from '@hub-crm/shared';
import { validate } from '../middleware/validate.js';
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

router.post('/', inquiryLimiter, validate(PublicInquirySchema), async (req, res, next) => {
  try {
    res.status(201).json(await inquiryService.create(getDB(), req.body));
  } catch (err) {
    next(err);
  }
});

export default router;