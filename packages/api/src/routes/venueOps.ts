import { Router } from 'express';
import { z } from 'zod';
import { VenueOpsTaskActionSchema } from '@hub-crm/shared';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { getDB } from '../config/db.js';
import { venueOpsService } from '../services/VenueOpsService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/queue', async (req, res, next) => {
  try {
    res.json(await venueOpsService.listQueue(getDB(), req.tenant));
  } catch (err) {
    next(err);
  }
});


const AssignmentSchema = z.object({
  dealId: z.string().min(1),
  taskId: z.string().min(1),
  assignee: z.object({
    type: z.enum(['user', 'agent', 'unassigned']),
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  reason: z.string().max(500).optional(),
});

router.post('/tasks/assign', validate(AssignmentSchema), async (req, res, next) => {
  try {
    res.json(await venueOpsService.assignTask(getDB(), req.tenant, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/tasks', validate(VenueOpsTaskActionSchema), async (req, res, next) => {
  try {
    const deal = await venueOpsService.applyTaskAction(getDB(), req.tenant, req.body);
    res.json(deal);
  } catch (err) {
    next(err);
  }
});

export default router;
