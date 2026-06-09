import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { CreateBuildSchema, PatchBuildSchema, CreateBuildVersionSchema, CreateChangeOrderSchema, PatchChangeOrderSchema } from '@hub-crm/shared';
import { getDB } from '../config/db.js';
import { buildService } from '../services/BuildService.js';
import { buildChangeService } from '../services/BuildChangeService.js';
import { BuildVersionRepository } from '../repositories/BuildVersionRepository.js';
import { buildDiffService } from '../services/BuildDiffService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const {
      unitId, dealId, status, q,
      marginRiskLevel, incompleteCosting, incompletePricing, hasSubstitutions,
      page = '1', limit = '50', sort = 'createdAt', order = 'desc',
    } = req.query as Record<string, string>;
    const out = await buildService.list(
      getDB(),
      req.tenant,
      {
        unitId: unitId || undefined,
        dealId: dealId || undefined,
        status: status as any,
        q: q || undefined,
        marginRiskLevel: marginRiskLevel as any,
        incompleteCosting: incompleteCosting === '1' || incompleteCosting === 'true'
          ? true
          : incompleteCosting === '0' || incompleteCosting === 'false'
            ? false
            : undefined,
        incompletePricing: incompletePricing === '1' || incompletePricing === 'true'
          ? true
          : incompletePricing === '0' || incompletePricing === 'false'
            ? false
            : undefined,
        hasSubstitutions: hasSubstitutions === '1' || hasSubstitutions === 'true'
          ? true
          : hasSubstitutions === '0' || hasSubstitutions === 'false'
            ? false
            : undefined,
      },
      { page: +page, limit: Math.min(+limit, 200), sort, order: order as 'asc' | 'desc' },
    );
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await buildService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateBuildSchema), async (req, res, next) => {
  try {
    res.status(201).json(await buildService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id', validate(PatchBuildSchema), async (req, res, next) => {
  try {
    res.json(await buildService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id/versions', async (req, res, next) => {
  try {
    res.json(await buildChangeService.listVersions(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/:id/versions', validate(CreateBuildVersionSchema), async (req, res, next) => {
  try {
    res.status(201).json(await buildChangeService.createVersion(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id/change-orders', async (req, res, next) => {
  try {
    res.json(await buildChangeService.listChangeOrders(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/:id/change-orders', validate(CreateChangeOrderSchema), async (req, res, next) => {
  try {
    res.status(201).json(await buildChangeService.createChangeOrder(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.patch('/change-orders/:changeOrderId', validate(PatchChangeOrderSchema), async (req, res, next) => {
  try {
    const status = (req.body as any).status;
    if (!status) return res.status(400).json({ error: 'status is required' });
    res.json(await buildChangeService.updateChangeOrderStatus(getDB(), req.tenant, req.params['changeOrderId']!, status));
  } catch (err) { next(err); }
});

router.get('/:id/diff', async (req, res, next) => {
  try {
    const { fromVersionId, toVersionId } = req.query as Record<string, string>;
    const [a, b] = await Promise.all([
      BuildVersionRepository.findById(getDB(), req.tenant, fromVersionId),
      BuildVersionRepository.findById(getDB(), req.tenant, toVersionId),
    ]);
    if (!a || !b || a.buildId !== req.params['id'] || b.buildId !== req.params['id']) {
      return res.status(404).json({ error: 'Version pair not found for this build' });
    }
    res.json(buildDiffService.compare(a as any, b as any));
  } catch (err) { next(err); }
});

export default router;
