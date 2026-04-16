// packages/api/src/routes/companies.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { resolveTenant } from '../tenancy/index.js';
import { companyService } from '../services/CompanyService.js';
import { activityService } from '../services/ActivityService.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { getDB } from '../config/db.js';
import { CreateInteractionSchema } from '@mtte-core/shared';

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

// ── GET /api/companies/:id/activities ────────────────────────────
router.get('/:id/activities', async (req, res, next) => {
  try {
    const {
      page  = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    // Verify company exists within this tenant before returning its activities
    await companyService.getById(getDB(), req.tenant, req.params['id']!);

    const result = await activityService.listForCompany(
      getDB(),
      req.tenant,
      req.params['id']!,
      { page: +page, limit: Math.min(+limit, 100), sort: 'createdAt', order: 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/companies/:id/activities ───────────────────────────
router.post('/:id/activities', validate(CreateInteractionSchema), async (req, res, next) => {
  try {
    const activity = await activityService.create(getDB(), req.tenant, {
      companyId:      req.params['id']!,
      activityType:   req.body.activityType,
      body:           req.body.body,
      title:          req.body.title,
      contactNameRaw: req.body.contactNameRaw,
      outcome:        req.body.outcome,
      followUpAt:     req.body.followUpAt || undefined,
      followUpNote:   req.body.followUpNote,
      relatedDealId:  req.body.relatedDealId,
    });
    res.status(201).json(activity);
  } catch (err) { next(err); }
});

// ── GET /api/companies/:id/summary ───────────────────────────────
router.get('/:id/summary', async (req, res, next) => {
  try {
    const company = await companyService.getById(getDB(), req.tenant, req.params['id']!);
    const deals = await DealRepository.listByCompanyName(getDB(), req.tenant, company.name);

    const openStatuses = new Set(['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build']);
    let openPipelineTotal = 0;
    let wonTotal = 0;
    for (const d of deals) {
      if (openStatuses.has(d.status)) openPipelineTotal += d.amount ?? 0;
      if (d.status === 'Won' || d.status === 'Delivered') wonTotal += d.amount ?? 0;
    }

    // Next follow-up: the nearest future followUpAt across all activities for this company
    const activitiesResult = await activityService.listForCompany(
      getDB(), req.tenant, req.params['id']!, { page: 1, limit: 200, sort: 'followUpAt', order: 'asc' },
    );
    const now = new Date();
    const nextFollowUp = (activitiesResult.data as Array<{ followUpAt?: Date | string; followUpNote?: string }>)
      .filter(a => a.followUpAt && new Date(a.followUpAt) >= now)
      .sort((a, b) => new Date(a.followUpAt!).getTime() - new Date(b.followUpAt!).getTime())[0];

    res.json({
      dealCount:          deals.length,
      openPipelineTotal,
      wonTotal,
      nextFollowUp:       nextFollowUp ? { date: nextFollowUp.followUpAt, note: nextFollowUp.followUpNote } : null,
    });
  } catch (err) { next(err); }
});

export default router;
