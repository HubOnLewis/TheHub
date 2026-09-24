import { Router } from 'express';
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

router.post('/tasks', validate(VenueOpsTaskActionSchema), async (req, res, next) => {
  try {
    const deal = await venueOpsService.applyTaskAction(getDB(), req.tenant, req.body);
    res.json(deal);
  } catch (err) {
    next(err);
  }
});

export default router;
