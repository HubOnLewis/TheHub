// packages/api/src/routes/leads.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { leadService } from '../services/LeadService.js';
import { getDB } from '../config/db.js';
import { CreateLeadSchema } from '@mtte-core/shared';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { status, assignedTo, search, active, page = '1', limit = '25', sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>;
    const result = await leadService.list(getDB(), req.tenant, { status: status as never, assignedTo, search, activeOnly: active === 'true' }, {
      page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc',
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await leadService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateLeadSchema), async (req, res, next) => {
  try {
    res.status(201).json(await leadService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await leadService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await leadService.remove(getDB(), req.tenant, req.params['id']!);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
