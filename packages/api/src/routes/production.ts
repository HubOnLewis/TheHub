import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { CreateProductionJobSchema, PatchProductionJobSchema, CreateProductionTaskSchema, PatchProductionTaskSchema } from '@mtte-core/shared';
import { getDB } from '../config/db.js';
import { productionJobService } from '../services/ProductionJobService.js';
import { productionTaskService } from '../services/ProductionTaskService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { status, assignedTeam, buildId, unitId, q, page = '1', limit = '100', sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>;
    const out = await productionJobService.list(
      getDB(),
      req.tenant,
      { status: status as any, assignedTeam: assignedTeam || undefined, buildId: buildId || undefined, unitId: unitId || undefined, q: q || undefined },
      { page: +page, limit: Math.min(+limit, 200), sort, order: order as 'asc' | 'desc' },
    );
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await productionJobService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateProductionJobSchema), async (req, res, next) => {
  try {
    res.status(201).json(await productionJobService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id', validate(PatchProductionJobSchema), async (req, res, next) => {
  try {
    res.json(await productionJobService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id/tasks', async (req, res, next) => {
  try {
    res.json(await productionTaskService.listByProductionJobId(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/:id/tasks/generate-default', async (req, res, next) => {
  try {
    res.status(201).json(await productionTaskService.ensureGeneratedDefaults(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/tasks', validate(CreateProductionTaskSchema), async (req, res, next) => {
  try {
    res.status(201).json(await productionTaskService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/tasks/:taskId', validate(PatchProductionTaskSchema), async (req, res, next) => {
  try {
    res.json(await productionTaskService.update(getDB(), req.tenant, req.params['taskId']!, req.body));
  } catch (err) { next(err); }
});

export default router;
