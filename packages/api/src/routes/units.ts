// packages/api/src/routes/units.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { unitService } from '../services/UnitService.js';
import { getDB } from '../config/db.js';
import { CreateUnitSchema, UNIT_STATUSES, CreateBuildSchema } from '@mtte-core/shared';
import { buildService } from '../services/BuildService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { status, search, companyId, assignedDealId, page = '1', limit = '25', sort = 'createdAt', order = 'desc' } = req.query as Record<string, string>;
    const result = await unitService.list(getDB(), req.tenant, { status: status as never, search, companyId, assignedDealId }, {
      page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc',
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
  try {
    res.json(await unitService.summary(getDB(), req.tenant));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await unitService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateUnitSchema), async (req, res, next) => {
  try {
    res.status(201).json(await unitService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id/status', validate(z.object({ status: z.enum(UNIT_STATUSES) })), async (req, res, next) => {
  try {
    res.json(await unitService.setStatus(getDB(), req.tenant, req.params['id']!, req.body.status));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await unitService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id/builds', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', sort = 'createdAt', order = 'desc' } = req.query as Record<string, string>;
    const out = await buildService.list(
      getDB(),
      req.tenant,
      { unitId: req.params['id']! },
      { page: +page, limit: Math.min(+limit, 200), sort, order: order as 'asc' | 'desc' },
    );
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/:id/builds', validate(CreateBuildSchema.omit({ unitId: true })), async (req, res, next) => {
  try {
    res.status(201).json(await buildService.create(getDB(), req.tenant, { ...req.body, unitId: req.params['id']! }));
  } catch (err) { next(err); }
});

export default router;
