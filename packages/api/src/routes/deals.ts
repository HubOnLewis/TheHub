// packages/api/src/routes/deals.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { dealService } from '../services/DealService.js';
import { getDB } from '../config/db.js';
import { CreateDealSchema } from '@mtte-core/shared';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { status, assignedTo, search, active, page = '1', limit = '25', sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>;
    const result = await dealService.list(getDB(), req.tenant, { status: status as never, assignedTo, search, activeOnly: active === 'true' }, {
      page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc',
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await dealService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateDealSchema), async (req, res, next) => {
  try {
    res.status(201).json(await dealService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await dealService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await dealService.remove(getDB(), req.tenant, req.params['id']!);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
