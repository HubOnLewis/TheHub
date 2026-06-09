import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { getDB } from '../config/db.js';
import { accountPlanService } from '../services/AccountPlanService.js';
import { CreateAccountPlanSchema, PatchAccountPlanSchema } from '@hub-crm/shared';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'admin', 'management', 'sales'), resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { ownerUserId, status, q, companyId, page = '1', limit = '50' } = req.query as Record<string, string>;
    const out = await accountPlanService.list(
      getDB(),
      req.tenant,
      {
        ownerUserId: ownerUserId || undefined,
        status: status as 'draft' | 'active' | 'paused' | 'completed' | undefined,
        q: q || undefined,
        companyId: companyId || undefined,
      },
      +page,
      Math.min(+limit, 100),
    );
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await accountPlanService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateAccountPlanSchema), async (req, res, next) => {
  try {
    const out = await accountPlanService.create(getDB(), req.tenant, req.body);
    res.status(201).json(out);
  } catch (err) { next(err); }
});

router.patch('/:id', validate(PatchAccountPlanSchema), async (req, res, next) => {
  try {
    res.json(await accountPlanService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

export default router;
