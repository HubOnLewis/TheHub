// packages/api/src/routes/aiJobs.ts
/** Staff JWT routes — create/poll local AI jobs (async). */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { getDB } from '../config/db.js';
import { aiJobService } from '../services/AiJobService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

const CreateSchema = z.object({
  agent: z.enum([
    'lead-intelligence',
    'event-operations',
    'follow-up-drafting',
    'daily-briefing',
    'data-quality',
  ]),
  recordType: z.enum(['lead', 'event', 'none']),
  recordId: z.string().min(1).optional().nullable(),
  taskType: z
    .enum(['analyze_lead', 'analyze_event', 'draft_follow_up', 'daily_briefing', 'data_quality_scan'])
    .optional(),
  input: z.record(z.unknown()).optional(),
});

router.post('/', validate(CreateSchema), async (req, res, next) => {
  try {
    const job = await aiJobService.create(getDB(), req.tenant, req.body);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await aiJobService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { recordType, recordId } = req.query as Record<string, string>;
    if ((recordType === 'lead' || recordType === 'event') && recordId) {
      res.json({ data: await aiJobService.listForRecord(getDB(), req.tenant, recordType, recordId) });
      return;
    }
    res.status(422).json({ error: 'recordType and recordId required' });
  } catch (err) {
    next(err);
  }
});

export default router;
