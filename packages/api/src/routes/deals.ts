// packages/api/src/routes/deals.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { dealService } from '../services/DealService.js';
import { buildService } from '../services/BuildService.js';
import { unitService } from '../services/UnitService.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { getDB } from '../config/db.js';
import { CreateBuildSchema, CreateDealSchema } from '@hub-crm/shared';

const CreateDealBuildSchema = CreateBuildSchema.omit({ dealId: true, unitId: true }).extend({
  unitId: z.string().optional(),
  unit: z.object({
    companyId: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    stockNumber: z.string().optional(),
    vin: z.string().optional(),
  }).optional(),
});

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/pipeline-pressure', async (req, res, next) => {
  try {
    const {
      ownerUserId, stage, pressureLevel, q, companyId,
      page = '1', limit = '100',
    } = req.query as Record<string, string>;
    const result = await dealService.listPipelinePressure(
      getDB(),
      req.tenant,
      {
        ownerUserId: ownerUserId || undefined,
        stage: stage as never,
        pressureLevel: pressureLevel as never,
        q: q || undefined,
        company: companyId || undefined,
      },
      { page: +page, limit: Math.min(+limit, 200), sort: 'updatedAt', order: 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/forecast-review', async (req, res, next) => {
  try {
    const {
      ownerUserId, stage, confidence, forecastCategory, needsManagementReview, q, companyId,
      page = '1', limit = '100',
    } = req.query as Record<string, string>;
    const result = await dealService.listForecastReview(
      getDB(),
      req.tenant,
      {
        ownerUserId: ownerUserId || undefined,
        stage: stage as never,
        confidence: confidence as never,
        forecastCategory: forecastCategory as never,
        needsManagementReview: needsManagementReview === '1' || needsManagementReview === 'true'
          ? true
          : needsManagementReview === '0' || needsManagementReview === 'false'
            ? false
            : undefined,
        q: q || undefined,
        company: companyId || undefined,
      },
      { page: +page, limit: Math.min(+limit, 200), sort: 'updatedAt', order: 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, assignedTo, search, active, ownerUserId, stage, company, page = '1', limit = '25', sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>;
    const result = await dealService.list(getDB(), req.tenant, { status: status as never, assignedTo, search, activeOnly: active === 'true', ownerUserId, stage: stage as never, company }, {
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

router.get('/:id/interactions', async (req, res, next) => {
  try {
    res.json(await dealService.listInteractionsForDeal(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.get('/:id/builds', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', sort = 'createdAt', order = 'desc' } = req.query as Record<string, string>;
    res.json(await buildService.list(
      getDB(),
      req.tenant,
      { dealId: req.params['id']! },
      { page: +page, limit: Math.min(+limit, 200), sort, order: order as 'asc' | 'desc' },
    ));
  } catch (err) { next(err); }
});

router.post('/:id/builds', validate(CreateDealBuildSchema), async (req, res, next) => {
  try {
    const deal = await dealService.getById(getDB(), req.tenant, req.params['id']!);
    let unitId = (req.body as any).unitId as string | undefined;
    if (!unitId) {
      const companyRow = (req.body as any).unit?.companyId
        ? await CompanyRepository.findById(getDB(), req.tenant, (req.body as any).unit.companyId)
        : await CompanyRepository.search(getDB(), req.tenant, String((deal as any).company ?? ''), 1).then(x => x[0] ?? null);
      const created = await unitService.create(getDB(), req.tenant, {
        companyId: companyRow?._id ?? '',
        vin: (req.body as any).unit?.vin ?? '',
        stockNumber: (req.body as any).unit?.stockNumber,
        make: (req.body as any).unit?.make ?? 'Unknown',
        model: (req.body as any).unit?.model ?? 'TBD',
        year: (req.body as any).unit?.year,
        status: 'prospect',
        entity: req.tenant.defaultEntity as any,
        location: req.tenant.defaultLocation as any,
        assignedDealId: req.params['id']!,
      } as any);
      unitId = created._id;
    }
    const out = await buildService.create(getDB(), req.tenant, { ...req.body, dealId: req.params['id']!, unitId });
    res.status(201).json(out);
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
