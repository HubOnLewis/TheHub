// packages/api/src/routes/companies.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { companyService } from '../services/CompanyService.js';
import { interactionService } from '../services/InteractionService.js';
import { accountPenetrationService } from '../services/AccountPenetrationService.js';
import { accountExpansionService } from '../services/AccountExpansionService.js';
import { accountPlanService } from '../services/AccountPlanService.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { buildService } from '../services/BuildService.js';
import { unitService } from '../services/UnitService.js';
import { getDB } from '../config/db.js';
import { deliveryService } from '../services/DeliveryService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

// ── GET /api/companies ────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      source,
      page  = '1',
      limit = '25',
      sort  = 'name',
      order = 'asc',
    } = req.query as Record<string, string>;

    const result = await companyService.list(
      getDB(),
      req.tenant,
      { search, source },
      { page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/companies/search  (MUST be before /:id) ─────────────
router.get('/search', async (req, res, next) => {
  try {
    const { q = '', limit = '10' } = req.query as Record<string, string>;
    if (!q.trim()) return res.json([]);
    const results = await companyService.search(getDB(), req.tenant, q.trim(), Math.min(+limit, 20));
    res.json(results);
  } catch (err) { next(err); }
});

// ── GET /api/companies/:id ────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await companyService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

// ── GET /api/companies/:id/interactions ─────────────────────────
router.get('/:id/interactions', async (req, res, next) => {
  try {
    const {
      page  = '1',
      limit = '20',
      type,
      status,
      ownerUserId,
      hasFollowUp,
      q,
    } = req.query as Record<string, string>;

    await companyService.getById(getDB(), req.tenant, req.params['id']!);

    const result = await interactionService.listForCompany(
      getDB(),
      req.tenant,
      req.params['id']!,
      {
        type: type || undefined,
        status: status || undefined,
        ownerUserId: ownerUserId || undefined,
        hasFollowUp: hasFollowUp === '1' || hasFollowUp === 'true'
          ? true
          : hasFollowUp === '0' || hasFollowUp === 'false'
            ? false
            : undefined,
        q: q?.trim() || undefined,
      },
      { page: +page, limit: Math.min(+limit, 100), sort: 'createdAt', order: 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/units', async (req, res, next) => {
  try {
    const company = await companyService.getById(getDB(), req.tenant, req.params['id']!);
    const out = await unitService.create(getDB(), req.tenant, {
      ...req.body,
      companyId: company._id,
      entity: req.body.entity ?? req.tenant.defaultEntity,
      location: req.body.location ?? req.tenant.defaultLocation,
      make: req.body.make ?? 'Unknown',
      model: req.body.model ?? 'TBD',
      status: req.body.status ?? 'prospect',
    });
    res.status(201).json(out);
  } catch (err) { next(err); }
});

router.post('/:id/builds', async (req, res, next) => {
  try {
    const company = await companyService.getById(getDB(), req.tenant, req.params['id']!);
    let unitId = req.body.unitId as string | undefined;
    if (!unitId) {
      const unit = await unitService.create(getDB(), req.tenant, {
        companyId: company._id,
        make: req.body.unit?.make ?? 'Unknown',
        model: req.body.unit?.model ?? 'TBD',
        year: req.body.unit?.year,
        stockNumber: req.body.unit?.stockNumber,
        vin: req.body.unit?.vin ?? '',
        status: 'prospect',
        entity: req.tenant.defaultEntity as any,
        location: req.tenant.defaultLocation as any,
      } as any);
      unitId = unit._id;
    }
    const out = await buildService.create(getDB(), req.tenant, {
      unitId,
      dealId: req.body.dealId,
      name: req.body.name,
      status: req.body.status ?? 'draft',
      estimatedPrice: req.body.estimatedPrice,
      actualPrice: req.body.actualPrice,
      specItems: req.body.specItems ?? [],
    });
    res.status(201).json(out);
  } catch (err) { next(err); }
});

router.get('/:id/account-plan', async (req, res, next) => {
  try {
    await companyService.getById(getDB(), req.tenant, req.params['id']!);
    const plan = await accountPlanService.getByCompanyId(getDB(), req.tenant, req.params['id']!);
    res.json(plan);
  } catch (err) { next(err); }
});

// ── GET /api/companies/:id/summary ───────────────────────────────
router.get('/:id/summary', async (req, res, next) => {
  try {
    const company = await companyService.getById(getDB(), req.tenant, req.params['id']!);
    const deals     = await DealRepository.listByCompanyId(getDB(), req.tenant, company._id);

    const openStatuses = new Set(['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build']);
    let openPipelineTotal = 0;
    let wonTotal = 0;
    for (const d of deals) {
      if (openStatuses.has(d.status)) openPipelineTotal += d.amount ?? 0;
      if (d.status === 'Won' || d.status === 'Delivered') wonTotal += d.amount ?? 0;
    }

    const nextI = await interactionService.getNextFollowUpForCompany(
      getDB(), req.tenant, req.params['id']!,
    );
    const engagementState = await interactionService.getEngagementStateForCompany(
      getDB(), req.tenant, req.params['id']!,
    );
    const coverage = await accountPenetrationService.byCompanyId(
      getDB(), req.tenant, req.params['id']!,
    );
    const expansion = await accountExpansionService.byCompanyId(
      getDB(), req.tenant, req.params['id']!,
    );
    const accountPlan = await accountPlanService.getByCompanyId(
      getDB(), req.tenant, req.params['id']!,
    );
    const customerDeliveryContext = await deliveryService.companyHandoffContext(
      getDB(), req.tenant, req.params['id']!,
    );
    const now   = new Date();
    const nextFollowUp = nextI && nextI.followUpAt
      ? {
        date:      nextI.followUpAt,
        summary:   nextI.summary,
        isOverdue: new Date(nextI.followUpAt).getTime() < now.getTime() && nextI.status !== 'completed',
        ownerName: nextI.ownerName,
      }
      : null;

    res.json({
      dealCount:          deals.length,
      openPipelineTotal,
      wonTotal,
      nextFollowUp,
      engagementState,
      accountPenetrationState: coverage?.accountPenetrationState,
      accountCoverageWarnings: coverage?.accountCoverageWarnings ?? [],
      accountExpansionState: expansion?.accountExpansionState,
      accountPlan: accountPlan ? {
        _id: accountPlan._id,
        status: accountPlan.status,
        ownerUserId: accountPlan.ownerUserId,
        ownerName: accountPlan.ownerName,
        objectives: accountPlan.objectives,
        opportunities: accountPlan.opportunities,
        risks: accountPlan.risks,
        nextSteps: accountPlan.nextSteps,
        reviewedAt: accountPlan.reviewedAt,
        reviewedByName: accountPlan.reviewedByName,
      } : null,
      customerDeliveryContext,
    });
  } catch (err) { next(err); }
});

export default router;
