import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { getDB } from '../config/db.js';
import { weeklyCadenceReviewService } from '../services/WeeklyCadenceReviewService.js';

const CreateWeeklyCadenceReviewSchema = z.object({
  ownerUserId: z.string().min(1),
  ownerName: z.string().optional(),
  weekStart: z.string().min(1),
  weekEnd: z.string().min(1),
  summary: z.string().optional(),
  priorities: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  commitments: z.array(z.string()).optional(),
});

const PatchWeeklyCadenceReviewSchema = z.object({
  ownerUserId: z.string().min(1).optional(),
  ownerName: z.string().optional(),
  weekStart: z.string().min(1).optional(),
  weekEnd: z.string().min(1).optional(),
  summary: z.string().optional(),
  priorities: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  commitments: z.array(z.string()).optional(),
});

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'admin', 'management'), resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const {
      ownerUserId,
      weekStart,
      weekEnd,
      reviewedByUserId,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;
    const out = await weeklyCadenceReviewService.list(
      getDB(),
      req.tenant,
      { ownerUserId, weekStart, weekEnd, reviewedByUserId },
      +page,
      Math.min(+limit, 100),
    );
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const out = await weeklyCadenceReviewService.getById(getDB(), req.tenant, req.params['id']!);
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/', validate(CreateWeeklyCadenceReviewSchema), async (req, res, next) => {
  try {
    const out = await weeklyCadenceReviewService.create(getDB(), req.tenant, req.body);
    res.status(201).json(out);
  } catch (err) { next(err); }
});

router.patch('/:id', validate(PatchWeeklyCadenceReviewSchema), async (req, res, next) => {
  try {
    const out = await weeklyCadenceReviewService.update(getDB(), req.tenant, req.params['id']!, req.body);
    res.json(out);
  } catch (err) { next(err); }
});

export default router;
